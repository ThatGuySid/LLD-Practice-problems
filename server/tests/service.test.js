import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { EvaluationService } from '../src/evaluation/service.js';
import { createFakeDb, waitFor } from './support/fakeDb.js';
import { buildSeed, fakeEvaluationResult } from './support/fixtures.js';

function service(seed, evaluator) {
  const db = createFakeDb(seed);
  return { service: new EvaluationService({ evaluator, query: db.query, withTransaction: db.withTransaction }), db };
}

test('claimEvaluation query locks the evaluation row only (FOR UPDATE OF e SKIP LOCKED)', () => {
  const source = fs.readFileSync(new URL('../src/evaluation/service.js', import.meta.url), 'utf8');
  assert.match(source, /FOR UPDATE OF e SKIP LOCKED/);
});

test('double-submit: two concurrent claims for the same submission — only one wins', async () => {
  const { seed, ids } = buildSeed();
  let evaluateCalls = 0;
  const evaluator = { evaluate: async () => { evaluateCalls += 1; return fakeEvaluationResult(); } };
  const { service: svc } = service(seed, evaluator);

  const [first, second] = await Promise.all([
    svc.claimEvaluation(ids[0].submissionId),
    svc.claimEvaluation(ids[0].submissionId),
  ]);

  const claims = [first, second].filter(Boolean);
  assert.equal(claims.length, 1, 'exactly one concurrent claim should succeed');
});

test('double-submit: two rapid processPendingEvaluation calls only evaluate once', async () => {
  const { seed, ids } = buildSeed();
  let evaluateCalls = 0;
  const evaluator = { evaluate: async () => { evaluateCalls += 1; return fakeEvaluationResult(); } };
  const { service: svc, db } = service(seed, evaluator);

  await Promise.all([
    svc.processPendingEvaluation(ids[0].submissionId),
    svc.processPendingEvaluation(ids[0].submissionId),
  ]);

  assert.equal(evaluateCalls, 1);
  const evaluation = db.state.evaluations.find((e) => e.id === ids[0].evaluationId);
  assert.equal(evaluation.status, 'completed');
});

test('claims for two different submissions of the same problem do not starve each other', async () => {
  // This is exactly the bug FOR UPDATE (without "OF e") caused: locking the
  // shared `problems` row for the duration of one claim would make a
  // concurrent claim for a sibling submission of the same problem skip and
  // return null, leaving it "pending" forever.
  const { seed, ids } = buildSeed({ attempts: [{}, {}] });
  const evaluator = { evaluate: async () => fakeEvaluationResult() };
  const { service: svc } = service(seed, evaluator);

  const [a, b] = await Promise.all([
    svc.claimEvaluation(ids[0].submissionId),
    svc.claimEvaluation(ids[1].submissionId),
  ]);

  assert.ok(a, 'first sibling claim should succeed');
  assert.ok(b, 'second sibling claim should succeed instead of being starved by the shared problem row');
});

test('evaluator failure marks the evaluation and attempt as failed with an error message', async () => {
  const { seed, ids } = buildSeed();
  const evaluator = { evaluate: async () => { throw new Error('Gemini API 503: overloaded'); } };
  const { service: svc, db } = service(seed, evaluator);

  const ok = await svc.processPendingEvaluation(ids[0].submissionId);

  assert.equal(ok, false);
  const evaluation = db.state.evaluations.find((e) => e.id === ids[0].evaluationId);
  const attempt = db.state.attempts.find((a) => a.id === ids[0].attemptId);
  assert.equal(evaluation.status, 'failed');
  assert.match(evaluation.error_message, /Gemini API 503/);
  assert.equal(attempt.status, 'failed');
});

test('recovery requeues a stale "evaluating" evaluation and an orphaned "pending" evaluation', async () => {
  const staleLockedAt = new Date(Date.now() - 10 * 60_000); // 10 minutes ago
  const { seed, ids } = buildSeed({
    attempts: [
      { evaluationStatus: 'evaluating', lockedAt: staleLockedAt, attemptStatus: 'evaluating' },
      { evaluationStatus: 'pending', attemptStatus: 'submitted' }, // e.g. left behind by a server restart
    ],
  });
  const evaluator = { evaluate: async () => fakeEvaluationResult() };
  const { service: svc, db } = service(seed, evaluator);

  const requeued = await svc.recoverStuckEvaluations(5);
  assert.equal(requeued, 2);

  await waitFor(() => db.state.evaluations.every((e) => e.status === 'completed'));
  assert.ok(db.state.attempts.every((a) => a.status === 'completed'));
});

test('recovery leaves a fresh "evaluating" job (not yet stale) alone', async () => {
  const { seed, ids } = buildSeed({
    attempts: [{ evaluationStatus: 'evaluating', lockedAt: new Date(), attemptStatus: 'evaluating' }],
  });
  const evaluator = { evaluate: async () => fakeEvaluationResult() };
  const { service: svc, db } = service(seed, evaluator);

  const requeued = await svc.recoverStuckEvaluations(5);
  assert.equal(requeued, 0);
  assert.equal(db.state.evaluations.find((e) => e.id === ids[0].evaluationId).status, 'evaluating');
});
