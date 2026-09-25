import { env } from '../config/env.js';
import { Evaluator } from './evaluator.js';
import { evaluationShape, normalizeEvaluation } from './schema.js';
import { RUBRIC } from '../domain/rubric.js';

export class GeminiEvaluator extends Evaluator {
  constructor({ apiKey = env.geminiApiKey, model = env.geminiModel } = {}) {
    super();
    this.apiKey = apiKey;
    this.model = model;
  }

  async evaluate(context) {
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured.');
    }

    const prompt = this.buildPrompt(context);
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(this.model)}:generateContent`;
    const generationConfig = {
      responseMimeType: 'application/json',
      responseSchema: evaluationShape,
      temperature: 0.2,
    };

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'x-goog-api-key': this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig,
      }),
      signal: AbortSignal.timeout(200_000),
    });

    const body = await response.text();
    if (!response.ok) throw new Error(`Gemini API ${response.status}: ${body.slice(0, 500)}`);

    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error('Gemini API returned a non-JSON HTTP payload.');
    }

    const text = payload?.candidates?.[0]?.content?.parts?.find((part) => typeof part.text === 'string')?.text;
    if (!text) throw new Error('Gemini response did not contain evaluation text.');

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new Error('Gemini evaluation text was not valid JSON.');
    }

    return normalizeEvaluation(parsed);
  }

  buildPrompt({ problem, submission, precheck }) {
    const rubricText = RUBRIC.map(
      (criterion, index) => `${index + 1}. ${criterion.title} (${criterion.key}): ${criterion.description}`,
    ).join('\n');

    return `You are evaluating a learner's Low-Level Design submission. Evaluate the design fairly rather than rewarding a single canonical architecture. Multiple valid designs can earn strong ratings when their trade-offs are justified.

PROBLEM
Title: ${problem.title}
Summary: ${problem.summary}
Prompt: ${problem.prompt}
Requirements:\n${problem.requirements.map((req) => `- ${req}`).join('\n')}

LEARNER SUBMISSION
Text:
${submission.textContent || '(no text)'}

Detected code: ${submission.detectedCode ? 'yes' : 'no'}
Serialized diagram:
${submission.serializedDiagram || '(no diagram)'}

DETERMINISTIC PRECHECK HINTS
${precheck.hints.length ? precheck.hints.map((hint) => `- ${hint.message}`).join('\n') : '- None'}

RUBRIC
${rubricText}

OUTPUT RULES
Return JSON matching the provided schema.
For each criterion provide:
- rating: exactly one of Strong, Adequate, Needs work, Not addressed
- evidence: concrete evidence from the learner's submission; do not invent classes or relationships
- concern: the most meaningful limitation, or state that no major concern is visible
- suggestion: one actionable improvement
- confidence: High, Medium, or Low

Do not produce an overall numeric score. Do not compare the learner to other learners. Do not assume a pattern is required when a simpler design is justified. Focus on the evidence in this submission and explain uncertainty through confidence.`;
  }
}
