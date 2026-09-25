import test from 'node:test';
import assert from 'node:assert/strict';
import { EvaluationService } from '../src/evaluation/service.js';
import { createFakeDb, waitFor } from './support/fakeDb.js';
import { buildSeed, fakeEvaluationResult } from './support/fixtures.js';

test('failed-evaluation retry: re-runs an evaluator failure without losing the original submission', async () => {
  const originalText = 'ParkingLot assigns a Ticket and delegates pricing to a Strategy because rules vary by vehicle.';
  const { seed, ids } = buildSeed({
    attempts: [{
      attemptStatus: 'failed',
      evaluationStatus: 'failed',
      errorMessage: 'Gemini API 503: overloaded',
      textContent: originalText,
    }],
  });
  const db = createFakeDb(seed);
  let evaluateCalls = 0;
  const evaluator = { evaluate: async () => { evaluateCalls += 1; return fakeEvaluationResult('Solid second pass.'); } };
  const svc = new EvaluationService({ evaluator, query: db.query, withTransaction: db.withTransaction });

  const { submissionId } = await svc.rerunFailedEvaluation(ids[0].attemptId);
  assert.equal(submissionId, ids[0].submissionId);

  await waitFor(() => db.state.evaluations.find((e) => e.id === ids[0].evaluationId).status === 'completed');

  const evaluation = db.state.evaluations.find((e) => e.id === ids[0].evaluationId);
  const submission = db.state.submissions.find((s) => s.id === ids[0].submissionId);
  const attempt = db.state.attempts.find((a) => a.id === ids[0].attemptId);

  assert.equal(evaluateCalls, 1);
  assert.equal(evaluation.error_message, null);
  assert.equal(evaluation.result_json.summary, 'Solid second pass.');
  assert.equal(attempt.status, 'completed');
  // The original submission content is untouched — a rerun only retries the
  // evaluator call, it never re-collects or rewrites what the learner wrote.
  assert.equal(submission.text_content, originalText);
});

test('failed-evaluation retry: rejects a rerun when the evaluation is not failed', async () => {
  const { seed, ids } = buildSeed({ attempts: [{ attemptStatus: 'submitted', evaluationStatus: 'pending' }] });
  const db = createFakeDb(seed);
  const svc = new EvaluationService({ evaluator: { evaluate: async () => fakeEvaluationResult() }, query: db.query, withTransaction: db.withTransaction });

  await assert.rejects(() => svc.rerunFailedEvaluation(ids[0].attemptId), /Only a failed evaluation can be re-run/);
});

test('failed-evaluation retry: rejects a rerun for a hard-precheck failure (nothing to re-run)', async () => {
  // A hard precheck failure never reached the evaluator, so error_message is
  // null. The submission needs to change, not the evaluator call — the
  // learner should start a new attempt instead.
  const { seed, ids } = buildSeed({
    attempts: [{ attemptStatus: 'failed', evaluationStatus: 'failed', errorMessage: null }],
  });
  const db = createFakeDb(seed);
  const svc = new EvaluationService({ evaluator: { evaluate: async () => fakeEvaluationResult() }, query: db.query, withTransaction: db.withTransaction });

  await assert.rejects(() => svc.rerunFailedEvaluation(ids[0].attemptId), /Start a new attempt/);
});

test('failed-evaluation retry: double-clicking rerun only queues one re-evaluation', async () => {
  const { seed, ids } = buildSeed({
    attempts: [{ attemptStatus: 'failed', evaluationStatus: 'failed', errorMessage: 'timeout' }],
  });
  const db = createFakeDb(seed);
  let evaluateCalls = 0;
  const evaluator = { evaluate: async () => { evaluateCalls += 1; return fakeEvaluationResult(); } };
  const svc = new EvaluationService({ evaluator, query: db.query, withTransaction: db.withTransaction });

  const results = await Promise.allSettled([
    svc.rerunFailedEvaluation(ids[0].attemptId),
    svc.rerunFailedEvaluation(ids[0].attemptId),
  ]);

  assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1, 'the second click should be rejected, not silently duplicated');
  await waitFor(() => db.state.evaluations.find((e) => e.id === ids[0].evaluationId).status === 'completed');
  assert.equal(evaluateCalls, 1);
});
