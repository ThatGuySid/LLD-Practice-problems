import test from 'node:test';
import assert from 'node:assert/strict';
import { detectCode, runCommonMistakeCheck } from '../src/evaluation/commonMistakes.js';
import { normalizeEvaluation } from '../src/evaluation/schema.js';
import { RUBRIC } from '../src/domain/rubric.js';

test('hard-fails an empty submission', () => {
  const result = runCommonMistakeCheck({ problemSlug: 'parking-lot', text: '', diagram: { nodes: [], edges: [] } });
  assert.equal(result.hardFailures[0].code, 'EMPTY_SUBMISSION');
});

test('returns non-fatal hints for a thin parking-lot submission', () => {
  const result = runCommonMistakeCheck({ problemSlug: 'parking-lot', text: 'Vehicle parks.', diagram: { nodes: [], edges: [] } });
  assert.equal(result.hardFailures.length, 0);
  assert.ok(result.hints.length > 0);
});

test('detects code when several code-like signals are present', () => {
  assert.equal(detectCode('class Ticket { return fee; } const x = () => 1;'), true);
  assert.equal(detectCode('The class should own a ticket and explain why.'), false);
});

test('rejects an incomplete evaluator response', () => {
  assert.throws(() => normalizeEvaluation({ summary: 'ok', criteria: [] }), /omitted rubric criteria/);
});

test('normalizes criteria in fixed rubric order', () => {
  const raw = {
    summary: 'A structured review.',
    criteria: RUBRIC.slice().reverse().map((criterion) => ({
      criterion_key: criterion.key,
      rating: 'Adequate',
      evidence: 'Evidence.',
      concern: 'Concern.',
      suggestion: 'Suggestion.',
      confidence: 'High',
    })),
  };
  const result = normalizeEvaluation(raw);
  assert.deepEqual(result.criteria.map((x) => x.criterion_key), RUBRIC.map((x) => x.key));
});
