import test from 'node:test';
import assert from 'node:assert/strict';
import { Attempt } from '../src/domain/attempt.js';
import { SubmissionContent } from '../src/domain/submissionContent.js';

test('Attempt allows the documented lifecycle transitions', () => {
  assert.equal(new Attempt('draft').assertTransition('submitted'), 'submitted');
  assert.equal(new Attempt('draft').assertTransition('failed'), 'failed');
  assert.equal(new Attempt('submitted').assertTransition('evaluating'), 'evaluating');
  assert.equal(new Attempt('evaluating').assertTransition('completed'), 'completed');
  assert.equal(new Attempt('evaluating').assertTransition('failed'), 'failed');
  assert.equal(new Attempt('evaluating').assertTransition('submitted'), 'submitted');
  assert.equal(new Attempt('failed').assertTransition('submitted'), 'submitted');
});

test('Attempt rejects illegal transitions with a 409', () => {
  assert.throws(() => new Attempt('draft').assertTransition('evaluating'), /Cannot move attempt/);
  assert.throws(() => new Attempt('completed').assertTransition('evaluating'), /Cannot move attempt/);
  try {
    new Attempt('draft').assertTransition('completed');
    assert.fail('expected a throw');
  } catch (error) {
    assert.equal(error.statusCode, 409);
  }
});

test('SubmissionContent normalizes missing/malformed input to safe defaults', () => {
  const content = new SubmissionContent({});
  assert.equal(content.textContent, '');
  assert.deepEqual(content.diagram, { nodes: [], edges: [] });

  const malformed = new SubmissionContent({ textContent: 42, diagram: { nodes: 'nope', edges: null } });
  assert.equal(malformed.textContent, '42');
  assert.deepEqual(malformed.diagram, { nodes: [], edges: [] });
});

test('SubmissionContent.serializeDiagram renders labeled nodes and edges as a text relationship map', () => {
  const content = new SubmissionContent({
    diagram: {
      nodes: [
        { id: 'n1', data: { label: 'ParkingLot', details: 'owns spots' } },
        { id: 'n2', data: { label: 'Ticket' } },
      ],
      edges: [{ source: 'n1', target: 'n2', label: 'issues' }],
    },
  });
  const text = content.serializeDiagram();
  assert.match(text, /ParkingLot — owns spots/);
  assert.match(text, /ParkingLot --\s*\[issues\]→ Ticket/);
});

test('SubmissionContent.detectedCode mirrors the shared code-detection heuristic', () => {
  const code = new SubmissionContent({ textContent: 'class Ticket { return fee; } const x = () => 1;' });
  const prose = new SubmissionContent({ textContent: 'The class should own a ticket and explain why.' });
  assert.equal(code.detectedCode, true);
  assert.equal(prose.detectedCode, false);
});
