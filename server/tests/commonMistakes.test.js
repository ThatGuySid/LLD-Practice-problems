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

test('diagram-aware precheck: a diagram-only submission does not get false MISSING_CLASS hints', () => {
  // No explanation text at all — everything lives in the diagram, serialized
  // the same way SubmissionContent would.
  const diagramText = [
    'Vehicle — has a license plate',
    'ParkingSpot — sized for a vehicle type',
    'Ticket — issued at entry',
    'Vehicle --[parks in]→ ParkingSpot',
    'Ticket --[charges a]→ Fee',
  ].join('\n');

  const result = runCommonMistakeCheck({
    problemSlug: 'parking-lot',
    text: 'Diagram only, see attached class diagram for the design.',
    diagram: { nodes: [{ id: 'n1' }, { id: 'n2' }, { id: 'n3' }], edges: [{ source: 'n1', target: 'n2' }] },
    diagramText,
  });

  const missingCodes = result.hints.map((hint) => hint.code);
  assert.ok(!missingCodes.includes('MISSING_VEHICLE'), 'vehicle is present in the diagram');
  assert.ok(!missingCodes.includes('MISSING_PARKING-SPOT'), 'parking spot is present in the diagram');
  assert.ok(!missingCodes.includes('MISSING_TICKET'), 'ticket is present in the diagram');
  assert.ok(!missingCodes.includes('MISSING_PRICING'), 'fee/pricing is present in the diagram');
});

test('diagram-aware precheck: without diagramText, diagram-only evidence is still invisible to class checks', () => {
  // Documents the previous (buggy) behavior for contrast: omitting
  // diagramText means only `text` is searched, so the same diagram content
  // produces false MISSING_* findings.
  const result = runCommonMistakeCheck({
    problemSlug: 'parking-lot',
    text: 'Diagram only, see attached class diagram for the design and why it works.',
    diagram: { nodes: [{ id: 'n1' }, { id: 'n2' }], edges: [{ source: 'n1', target: 'n2' }] },
  });
  const missingCodes = result.hints.map((hint) => hint.code);
  assert.ok(missingCodes.includes('MISSING_VEHICLE'));
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
