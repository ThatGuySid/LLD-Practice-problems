import { runCommonMistakeCheck } from './commonMistakes.js';
import { Attempt } from '../domain/attempt.js';
import { SubmissionContent } from '../domain/submissionContent.js';

export class EvaluationService {
  // `query`/`withTransaction` are injected (rather than importing db/pool.js
  // directly) so this class can be unit-tested against an in-memory fake
  // driver without a real PostgreSQL connection. src/index.js wires the real
  // pg-backed pool in.
  constructor({ evaluator, query, withTransaction }) {
    if (!query || !withTransaction) {
      throw new Error('EvaluationService requires query and withTransaction.');
    }
    this.evaluator = evaluator;
    this.query = query;
    this.withTransaction = withTransaction;
  }

  async submitAttempt(attemptId, payload) {
    const result = await this.withTransaction(async (client) => {
      const attemptResult = await client.query(
        `SELECT a.*, p.slug, p.title, p.summary, p.prompt, p.requirements
         FROM attempts a
         JOIN problems p ON p.id = a.problem_id
         WHERE a.id = $1
         FOR UPDATE OF a`,
        [attemptId],
      );
      const attempt = attemptResult.rows[0];
      if (!attempt) throw Object.assign(new Error('Attempt not found.'), { statusCode: 404 });

      const content = new SubmissionContent(payload);
      const precheck = runCommonMistakeCheck({
        problemSlug: attempt.slug,
        text: content.textContent,
        diagram: content.diagram,
        diagramText: content.serializeDiagram(),
      });
      const nextStatus = precheck.hardFailures.length ? 'failed' : 'submitted';
      new Attempt(attempt.status).assertTransition(nextStatus);

      await client.query(
        `INSERT INTO submissions(attempt_id, text_content, diagram_json, serialized_diagram, detected_code)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         ON CONFLICT (attempt_id) DO UPDATE SET
           text_content = EXCLUDED.text_content,
           diagram_json = EXCLUDED.diagram_json,
           serialized_diagram = EXCLUDED.serialized_diagram,
           detected_code = EXCLUDED.detected_code,
           updated_at = NOW()`,
        [attemptId, content.textContent, JSON.stringify(content.diagram), content.serializeDiagram(), precheck.detectedCode],
      );

      const submission = await client.query('SELECT id FROM submissions WHERE attempt_id = $1', [attemptId]);
      const submissionId = submission.rows[0].id;

      await client.query(
        `INSERT INTO evaluations(submission_id, status, precheck_json)
         VALUES ($1, $2, $3::jsonb)
         ON CONFLICT (submission_id) DO UPDATE SET
           status = EXCLUDED.status,
           precheck_json = EXCLUDED.precheck_json,
           result_json = NULL,
           error_message = NULL,
           updated_at = NOW()`,
        [submissionId, nextStatus === 'failed' ? 'failed' : 'pending', JSON.stringify(precheck)],
      );

      await client.query(
        `UPDATE attempts SET status = $2, submitted_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [attemptId, nextStatus],
      );

      return { attempt, submissionId, precheck };
    });

    if (!result.precheck.hardFailures.length) {
      queueMicrotask(() => this.processPendingEvaluation(result.submissionId).catch((error) => {
        console.error('Background evaluation failed:', error.message);
      }));
    }

    return result;
  }

  // Re-run an evaluation that previously failed (evaluator error, e.g. Gemini
  // outage) without creating a new attempt/submission. The original
  // submission text/diagram is untouched; only the evaluation record resets.
  async rerunFailedEvaluation(attemptId) {
    const claim = await this.withTransaction(async (client) => {
      const result = await client.query(
        `SELECT e.id evaluation_id, e.status evaluation_status, e.error_message, s.id submission_id, a.status attempt_status
         FROM attempts a
         JOIN submissions s ON s.attempt_id = a.id
         JOIN evaluations e ON e.submission_id = s.id
         WHERE a.id = $1
         FOR UPDATE OF e`,
        [attemptId],
      );
      const row = result.rows[0];
      if (!row) throw Object.assign(new Error('Attempt has no submission to re-run.'), { statusCode: 404 });
      if (row.evaluation_status !== 'failed') {
        throw Object.assign(new Error('Only a failed evaluation can be re-run.'), { statusCode: 409 });
      }
      // A failure with no error_message never reached the evaluator — it was
      // stopped by a hard precheck failure (e.g. empty submission). The
      // submission content itself needs to change, so re-running the same
      // evaluator call would just waste a call; the learner should edit and
      // start a fresh attempt instead.
      if (!row.error_message) {
        throw Object.assign(
          new Error('This submission failed a precheck before evaluation ran. Start a new attempt instead of re-running.'),
          { statusCode: 409 },
        );
      }
      new Attempt(row.attempt_status).assertTransition('submitted');

      await client.query(
        `UPDATE evaluations SET status='pending', error_message=NULL, result_json=NULL, updated_at=NOW() WHERE id=$1`,
        [row.evaluation_id],
      );
      await client.query(
        `UPDATE attempts SET status='submitted', updated_at=NOW() WHERE id=$1`,
        [attemptId],
      );
      return { submissionId: row.submission_id };
    });

    queueMicrotask(() => this.processPendingEvaluation(claim.submissionId).catch((error) => {
      console.error('Rerun evaluation failed:', error.message);
    }));

    return claim;
  }

  async processPendingEvaluation(submissionId) {
    const claimed = await this.claimEvaluation(submissionId);
    if (!claimed) return false;

    try {
      const result = await this.evaluator.evaluate({
        problem: claimed.problem,
        submission: claimed.submission,
        precheck: claimed.precheck,
      });

      await this.withTransaction(async (client) => {
        await client.query(
          `UPDATE evaluations
           SET status = 'completed', result_json = $2::jsonb, completed_at = NOW(), updated_at = NOW()
           WHERE id = $1`,
          [claimed.evaluationId, JSON.stringify(result)],
        );
        await client.query('DELETE FROM feedback WHERE evaluation_id = $1', [claimed.evaluationId]);
        for (const criterion of result.criteria) {
          await client.query(
            `INSERT INTO feedback(evaluation_id, criterion_key, rating, evidence, concern, suggestion, confidence)
             VALUES ($1,$2,$3,$4,$5,$6,$7)`,
            [claimed.evaluationId, criterion.criterion_key, criterion.rating, criterion.evidence, criterion.concern, criterion.suggestion, criterion.confidence],
          );
        }
        await client.query(
          `UPDATE attempts a SET status='completed', updated_at=NOW()
           FROM submissions s
           WHERE s.attempt_id = a.id AND s.id = $1`,
          [submissionId],
        );
      });
      return true;
    } catch (error) {
      await this.withTransaction(async (client) => {
        await client.query(
          `UPDATE evaluations SET status='failed', error_message=$2, updated_at=NOW() WHERE id=$1`,
          [claimed.evaluationId, error.message.slice(0, 1000)],
        );
        await client.query(
          `UPDATE attempts a SET status='failed', updated_at=NOW()
           FROM submissions s WHERE s.attempt_id=a.id AND s.id=$1`,
          [submissionId],
        );
      });
      return false;
    }
  }

  async claimEvaluation(submissionId) {
    return this.withTransaction(async (client) => {
      // `FOR UPDATE OF e` scopes the row lock (and SKIP LOCKED's skip check)
      // to the evaluations row alone. Without "OF e", Postgres locks every
      // row contributed by the join — including the shared `problems` row —
      // so two learners submitting the same problem concurrently could have
      // one claim spuriously skipped (and left "pending" forever) purely
      // because an unrelated evaluation's transaction happened to be
      // touching the same problem row. Scoping to `e` also means a duplicate
      // claim attempt for the *same* submission (a double-click, or a rerun
      // racing an in-flight background job) is skipped instead of blocking.
      const result = await client.query(
        `SELECT e.id evaluation_id, e.precheck_json, a.status attempt_status,
                s.text_content, s.serialized_diagram, s.detected_code,
                p.title, p.summary, p.prompt, p.requirements, p.slug
         FROM evaluations e
         JOIN submissions s ON s.id = e.submission_id
         JOIN attempts a ON a.id = s.attempt_id
         JOIN problems p ON p.id = a.problem_id
         WHERE e.submission_id = $1 AND e.status = 'pending'
         FOR UPDATE OF e SKIP LOCKED`,
        [submissionId],
      );
      const row = result.rows[0];
      if (!row) return null;

      new Attempt(row.attempt_status).assertTransition('evaluating');

      await client.query(
        `UPDATE evaluations
         SET status='evaluating', locked_at=NOW(), started_at=NOW(), attempt_count=attempt_count+1, updated_at=NOW()
         WHERE id=$1`,
        [row.evaluation_id],
      );
      await client.query(
        `UPDATE attempts a SET status='evaluating', updated_at=NOW()
         FROM submissions s WHERE s.attempt_id=a.id AND s.id=$1`,
        [submissionId],
      );

      return {
        evaluationId: row.evaluation_id,
        precheck: row.precheck_json,
        submission: {
          textContent: row.text_content,
          serializedDiagram: row.serialized_diagram,
          detectedCode: row.detected_code,
        },
        problem: {
          title: row.title,
          summary: row.summary,
          prompt: row.prompt,
          requirements: row.requirements,
          slug: row.slug,
        },
      };
    });
  }

  // Runs at server startup. Two kinds of evaluation can be stranded by a
  // process restart or crash, since the in-process queueMicrotask() that
  // normally drives evaluation forward does not survive a restart:
  //   - "evaluating" jobs whose worker died mid-flight (locked_at is stale).
  //   - "pending" jobs that were inserted but never got their microtask
  //     scheduled/run before the process went away (or were starved by the
  //     claim-locking bug fixed above).
  // Both are simply requeued through the normal claim/process pipeline.
  async recoverStuckEvaluations(maxEvaluatingAgeMinutes = 5) {
    const stale = await this.query(
      `UPDATE evaluations
       SET status='pending', locked_at=NULL, updated_at=NOW()
       WHERE status='evaluating' AND locked_at < NOW() - ($1 || ' minutes')::interval
       RETURNING submission_id`,
      [maxEvaluatingAgeMinutes],
    );
    for (const row of stale.rows) {
      await this.query(
        `UPDATE attempts a SET status='submitted', updated_at=NOW()
         FROM submissions s WHERE s.attempt_id=a.id AND s.id=$1`,
        [row.submission_id],
      );
    }

    const orphanedPending = await this.query(
      `SELECT submission_id FROM evaluations WHERE status='pending'`,
    );

    const submissionIds = new Set([...stale.rows, ...orphanedPending.rows].map((row) => row.submission_id));
    for (const submissionId of submissionIds) {
      this.processPendingEvaluation(submissionId).catch((error) => console.error('Recovery evaluation failed:', error.message));
    }
    return submissionIds.size;
  }
}
