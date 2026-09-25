// A tiny in-memory stand-in for `db/pool.js`'s `query`/`withTransaction`,
// used only in tests. It understands exactly the query shapes
// EvaluationService issues (matched by a distinguishing prefix after
// whitespace-normalizing the SQL) and models real row-level locking:
// FOR UPDATE blocks until the lock is free; FOR UPDATE ... SKIP LOCKED
// returns no rows immediately if the lock is held. Locking honors an
// explicit `FOR UPDATE OF <alias>` the same way Postgres does — scoping the
// lock (and the skip check) to that one table instead of every joined row —
// which is exactly the behavior the claimEvaluation fix depends on.
//
// This exists because this sandbox has no network access to install `pg` or
// run PostgreSQL; it is not a substitute for testing against real Postgres.

let counter = 0;
function nextId(prefix) {
  counter += 1;
  return `${prefix}_${counter}`;
}

export function createFakeDb(seed = {}) {
  const state = {
    problems: [...(seed.problems || [])],
    attempts: [...(seed.attempts || [])],
    submissions: [...(seed.submissions || [])],
    evaluations: [...(seed.evaluations || [])],
    feedback: [...(seed.feedback || [])],
  };

  const rowLocks = new Map(); // key -> array of waiter resolvers ([] = locked, no waiters)

  function isLocked(key) {
    return rowLocks.has(key);
  }

  function release(key) {
    const waiters = rowLocks.get(key);
    if (!waiters) return;
    if (waiters.length === 0) { rowLocks.delete(key); return; }
    waiters.shift()();
  }

  async function lockRows(keys, { skipLocked = false } = {}) {
    if (skipLocked) {
      if (keys.some(isLocked)) return null;
      keys.forEach((key) => rowLocks.set(key, []));
      return () => keys.forEach(release);
    }
    for (const key of keys) {
      if (isLocked(key)) await new Promise((resolve) => rowLocks.get(key).push(resolve));
      else rowLocks.set(key, []);
    }
    return () => keys.forEach(release);
  }

  const findAttempt = (id) => state.attempts.find((a) => a.id === id);
  const findProblem = (id) => state.problems.find((p) => p.id === id);
  const findSubmission = (id) => state.submissions.find((s) => s.id === id);
  const findSubmissionByAttempt = (attemptId) => state.submissions.find((s) => s.attempt_id === attemptId);
  const findEvaluationBySubmission = (submissionId) => state.evaluations.find((e) => e.submission_id === submissionId);

  async function runQuery(sqlRaw, params, heldLocks) {
    const sql = sqlRaw.replace(/\s+/g, ' ').trim();

    if (sql.startsWith('SELECT a.*, p.slug')) {
      const [attemptId] = params;
      heldLocks.push(await lockRows([`attempts:${attemptId}`]));
      const attempt = findAttempt(attemptId);
      if (!attempt) return { rows: [] };
      return { rows: [{ ...attempt, ...findProblem(attempt.problem_id) }] };
    }

    if (sql.startsWith('INSERT INTO submissions')) {
      const [attemptId, textContent, diagramJson, serializedDiagram, detectedCode] = params;
      let submission = findSubmissionByAttempt(attemptId);
      const patch = {
        text_content: textContent,
        diagram_json: JSON.parse(diagramJson),
        serialized_diagram: serializedDiagram,
        detected_code: detectedCode,
      };
      if (submission) Object.assign(submission, patch);
      else {
        submission = { id: nextId('sub'), attempt_id: attemptId, ...patch };
        state.submissions.push(submission);
      }
      return { rows: [submission] };
    }

    if (sql.startsWith('SELECT id FROM submissions WHERE attempt_id')) {
      const submission = findSubmissionByAttempt(params[0]);
      return { rows: submission ? [{ id: submission.id }] : [] };
    }

    if (sql.startsWith('INSERT INTO evaluations')) {
      const [submissionId, status, precheckJson] = params;
      let evaluation = findEvaluationBySubmission(submissionId);
      const patch = { status, precheck_json: JSON.parse(precheckJson), result_json: null, error_message: null };
      if (evaluation) Object.assign(evaluation, patch);
      else {
        evaluation = { id: nextId('eval'), submission_id: submissionId, attempt_count: 0, locked_at: null, ...patch };
        state.evaluations.push(evaluation);
      }
      return { rows: [evaluation] };
    }

    if (sql.startsWith('UPDATE attempts SET status = $2')) {
      const [attemptId, status] = params;
      const attempt = findAttempt(attemptId);
      if (attempt) attempt.status = status;
      return { rows: [] };
    }

    if (sql.startsWith('SELECT e.id evaluation_id, e.status evaluation_status, e.error_message')) {
      const [attemptId] = params;
      heldLocks.push(await lockRows([`rerun:${attemptId}`]));
      const attempt = findAttempt(attemptId);
      const submission = attempt && findSubmissionByAttempt(attemptId);
      const evaluation = submission && findEvaluationBySubmission(submission.id);
      if (!evaluation) return { rows: [] };
      return {
        rows: [{
          evaluation_id: evaluation.id,
          evaluation_status: evaluation.status,
          error_message: evaluation.error_message,
          submission_id: submission.id,
          attempt_status: attempt.status,
        }],
      };
    }

    if (sql.startsWith("UPDATE evaluations SET status='pending', error_message=NULL")) {
      const evaluation = state.evaluations.find((e) => e.id === params[0]);
      if (evaluation) Object.assign(evaluation, { status: 'pending', error_message: null, result_json: null });
      return { rows: [] };
    }

    if (sql.startsWith("UPDATE attempts SET status='submitted', updated_at=NOW() WHERE id=$1")) {
      const attempt = findAttempt(params[0]);
      if (attempt) attempt.status = 'submitted';
      return { rows: [] };
    }

    if (sql.startsWith('SELECT e.id evaluation_id, e.precheck_json')) {
      const [submissionId] = params;
      const submission = findSubmission(submissionId);
      const evaluation = submission && findEvaluationBySubmission(submissionId);
      if (!evaluation || evaluation.status !== 'pending') return { rows: [] };

      const skipLocked = /SKIP LOCKED/.test(sql);
      const alias = /FOR UPDATE OF (\w+)/.exec(sql)?.[1];
      const attempt = findAttempt(submission.attempt_id);
      const keys = alias === 'e'
        ? [`evaluations:${evaluation.id}`]
        : [`evaluations:${evaluation.id}`, `submissions:${submission.id}`, `attempts:${attempt.id}`, `problems:${attempt.problem_id}`];
      const release = await lockRows(keys, { skipLocked });
      if (!release) return { rows: [] };
      heldLocks.push(release);

      const problem = findProblem(attempt.problem_id);
      return {
        rows: [{
          evaluation_id: evaluation.id,
          precheck_json: evaluation.precheck_json,
          attempt_status: attempt.status,
          text_content: submission.text_content,
          serialized_diagram: submission.serialized_diagram,
          detected_code: submission.detected_code,
          title: problem.title,
          summary: problem.summary,
          prompt: problem.prompt,
          requirements: problem.requirements,
          slug: problem.slug,
        }],
      };
    }

    if (sql.startsWith("UPDATE evaluations SET status='evaluating'")) {
      const evaluation = state.evaluations.find((e) => e.id === params[0]);
      if (evaluation) Object.assign(evaluation, { status: 'evaluating', locked_at: new Date(), attempt_count: (evaluation.attempt_count || 0) + 1 });
      return { rows: [] };
    }

    for (const [prefix, status] of [
      ["UPDATE attempts a SET status='evaluating'", 'evaluating'],
      ["UPDATE attempts a SET status='completed'", 'completed'],
      ["UPDATE attempts a SET status='failed'", 'failed'],
      ["UPDATE attempts a SET status='submitted'", 'submitted'],
    ]) {
      if (sql.startsWith(prefix)) {
        const submission = findSubmission(params[0]);
        const attempt = submission && findAttempt(submission.attempt_id);
        if (attempt) attempt.status = status;
        return { rows: [] };
      }
    }

    if (sql.startsWith("UPDATE evaluations SET status = 'completed'")) {
      const [evaluationId, resultJson] = params;
      const evaluation = state.evaluations.find((e) => e.id === evaluationId);
      if (evaluation) Object.assign(evaluation, { status: 'completed', result_json: JSON.parse(resultJson), completed_at: new Date() });
      return { rows: [] };
    }

    if (sql.startsWith('DELETE FROM feedback')) {
      state.feedback = state.feedback.filter((f) => f.evaluation_id !== params[0]);
      return { rows: [] };
    }

    if (sql.startsWith('INSERT INTO feedback')) {
      const [evaluationId, criterionKey, rating, evidence, concern, suggestion, confidence] = params;
      state.feedback.push({ evaluation_id: evaluationId, criterion_key: criterionKey, rating, evidence, concern, suggestion, confidence });
      return { rows: [] };
    }

    if (sql.startsWith("UPDATE evaluations SET status='failed'")) {
      const [evaluationId, errorMessage] = params;
      const evaluation = state.evaluations.find((e) => e.id === evaluationId);
      if (evaluation) Object.assign(evaluation, { status: 'failed', error_message: errorMessage });
      return { rows: [] };
    }

    if (sql.startsWith("UPDATE evaluations SET status='pending', locked_at=NULL")) {
      const [maxAgeMinutes] = params;
      const cutoff = Date.now() - Number(maxAgeMinutes) * 60_000;
      const rows = [];
      for (const evaluation of state.evaluations) {
        if (evaluation.status === 'evaluating' && evaluation.locked_at && evaluation.locked_at.getTime() < cutoff) {
          evaluation.status = 'pending';
          evaluation.locked_at = null;
          rows.push({ submission_id: evaluation.submission_id });
        }
      }
      return { rows };
    }

    if (sql.startsWith("SELECT submission_id FROM evaluations WHERE status='pending'")) {
      return { rows: state.evaluations.filter((e) => e.status === 'pending').map((e) => ({ submission_id: e.submission_id })) };
    }

    throw new Error(`fakeDb: unrecognized query: ${sql.slice(0, 90)}`);
  }

  async function withTransaction(callback) {
    const heldLocks = [];
    const client = { query: (text, params = []) => runQuery(text, params, heldLocks) };
    try {
      return await callback(client);
    } finally {
      heldLocks.splice(0).forEach((fn) => fn && fn());
    }
  }

  async function query(text, params = []) {
    return withTransaction((client) => client.query(text, params));
  }

  return { query, withTransaction, state };
}

export async function waitFor(predicate, { timeout = 500, interval = 5 } = {}) {
  const start = Date.now();
  while (!predicate()) {
    if (Date.now() - start > timeout) throw new Error('waitFor: condition never became true.');
    await new Promise((resolve) => setTimeout(resolve, interval));
  }
}
