import { CONFIDENCES, RATINGS, RUBRIC } from '../domain/rubric.js';

export const evaluationShape = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    criteria: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          criterion_key: { type: 'string', enum: RUBRIC.map((x) => x.key) },
          rating: { type: 'string', enum: RATINGS },
          evidence: { type: 'string' },
          concern: { type: 'string' },
          suggestion: { type: 'string' },
          confidence: { type: 'string', enum: CONFIDENCES },
        },
        required: ['criterion_key', 'rating', 'evidence', 'concern', 'suggestion', 'confidence'],
      },
    },
  },
  required: ['summary', 'criteria'],
};

export function normalizeEvaluation(raw) {
  if (!raw || typeof raw !== 'object') throw new Error('Evaluator returned a non-object result.');
  if (typeof raw.summary !== 'string' || !raw.summary.trim()) throw new Error('Evaluation summary is missing.');
  if (!Array.isArray(raw.criteria)) throw new Error('Evaluation criteria are missing.');

  const allowedKeys = new Set(RUBRIC.map((x) => x.key));
  const result = new Map();
  for (const item of raw.criteria) {
    if (!allowedKeys.has(item.criterion_key)) continue;
    if (!RATINGS.includes(item.rating)) continue;
    if (!CONFIDENCES.includes(item.confidence)) continue;
    result.set(item.criterion_key, {
      criterion_key: item.criterion_key,
      rating: item.rating,
      evidence: String(item.evidence || '').trim(),
      concern: String(item.concern || '').trim(),
      suggestion: String(item.suggestion || '').trim(),
      confidence: item.confidence,
    });
  }

  const missing = RUBRIC.filter((criterion) => !result.has(criterion.key));
  if (missing.length) throw new Error(`Evaluator omitted rubric criteria: ${missing.map((x) => x.key).join(', ')}`);

  return {
    summary: raw.summary.trim(),
    criteria: RUBRIC.map((criterion) => result.get(criterion.key)),
  };
}
