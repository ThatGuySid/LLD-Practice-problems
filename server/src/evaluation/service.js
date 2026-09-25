import { withTransaction, query } from '../db/pool.js';
import { runCommonMistakeCheck } from './commonMistakes.js';

export class EvaluationService {
  constructor({ evaluator }) {
    this.evaluator = evaluator;
  }

  async submitAttempt(attemptId, payload) {
    const result = await withTransaction(async (client) => {
      const attemptResult = await client.query(
        `SELECT a.*, p.slug, p.title, p.summary, p.prompt, p.requirements
         FROM attempts a
         JOIN problems p ON p.id = a.problem_id
         WHERE a.id = $1
         FOR UPDATE`,
        [attemptId],
      );
      const attempt = attemptResult.rows[0];
      if (!attempt) throw Object.assign(new Error('Attempt not found.'), { statusCode: 404 });
      if (attempt.status !== 'draft') {
        throw Object.assign(new Error('This attempt is no longer editable.'), { statusCode: 409 });
      }

      const textContent = String(payload.textContent ?? '');
      const diagram = payload.diagram && typeof payload.diagram === 'object'
        ? payload.diagram
        : { nodes: [], edges: [] };
      const precheck = runCommonMistakeCheck({ problemSlug: attempt.slug, text: textContent, diagram });

      await client.query(
        `INSERT INTO submissions(attempt_id, text_content, diagram_json, serialized_diagram, detected_code)
         VALUES ($1, $2, $3::jsonb, $4, $5)
         ON CONFLICT (attempt_id) DO UPDATE SET
           text_content = EXCLUDED.text_content,
           diagram_json = EXCLUDED.diagram_json,
           serialized_diagram = EXCLUDED.serialized_diagram,
           detected_code = EXCLUDED.detected_code,
           updated_at = NOW()`,
        [attemptId, textContent, JSON.stringify(diagram), serializeDiagram(diagram), precheck.detectedCode],
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
        [submissionId, precheck.hardFailures.length ? 'failed' : 'pending', JSON.stringify(precheck)],
      );

      await client.query(
        `UPDATE attempts SET status = $2, submitted_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [attemptId, precheck.hardFailures.length ? 'failed' : 'submitted'],
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

  async processPendingEvaluation(submissionId) {
    const claimed = await this.claimEvaluation(submissionId);
    if (!claimed) return false;

    try {
      const result = await this.evaluator.evaluate({
        problem: claimed.problem,
        submission: claimed.submission,
        precheck: claimed.precheck,
      });

      await withTransaction(async (client) => {
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
      await withTransaction(async (client) => {
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
    return withTransaction(async (client) => {
      const result = await client.query(
        `SELECT e.id evaluation_id, e.precheck_json, s.text_content, s.serialized_diagram, s.detected_code,
                p.title, p.summary, p.prompt, p.requirements, p.slug
         FROM evaluations e
         JOIN submissions s ON s.id = e.submission_id
         JOIN attempts a ON a.id = s.attempt_id
         JOIN problems p ON p.id = a.problem_id
         WHERE e.submission_id = $1 AND e.status = 'pending'
         FOR UPDATE SKIP LOCKED`,
        [submissionId],
      );
      const row = result.rows[0];
      if (!row) return null;

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

  async recoverStuckEvaluations(maxAgeMinutes = 5) {
    const { rows } = await query(
      `UPDATE evaluations
       SET status='pending', locked_at=NULL, updated_at=NOW()
       WHERE status='evaluating' AND locked_at < NOW() - ($1 || ' minutes')::interval
       RETURNING submission_id`,
      [maxAgeMinutes],
    );
    for (const row of rows) {
      await query(
        `UPDATE attempts a SET status='submitted', updated_at=NOW()
         FROM submissions s WHERE s.attempt_id=a.id AND s.id=$1`,
        [row.submission_id],
      );
      this.processPendingEvaluation(row.submission_id).catch((error) => console.error('Recovery evaluation failed:', error.message));
    }
    return rows.length;
  }
}

export function serializeDiagram(diagram) {
  const nodes = Array.isArray(diagram?.nodes) ? diagram.nodes : [];
  const edges = Array.isArray(diagram?.edges) ? diagram.edges : [];
  const lines = [];
  for (const node of nodes) {
    const label = String(node?.data?.label || node?.data?.title || node?.id || 'Unnamed node').trim();
    const details = String(node?.data?.details || '').trim();
    lines.push(`${label}${details ? ` — ${details}` : ''}`);
  }
  const lookup = new Map(nodes.map((node) => [node.id, String(node?.data?.label || node?.data?.title || node?.id || 'Unknown')]));
  for (const edge of edges) {
    const source = lookup.get(edge.source) || edge.source;
    const target = lookup.get(edge.target) || edge.target;
    const label = edge?.label ? ` [${edge.label}]` : '';
    lines.push(`${source} --${label}→ ${target}`);
  }
  return lines.join('\n');
}
