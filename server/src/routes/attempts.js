import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';
import { runCommonMistakeCheck } from '../evaluation/commonMistakes.js';
import { SubmissionContent } from '../domain/submissionContent.js';

export const attemptsRouter = Router();

function learnerId(req) {
  const value = String(req.header('x-learner-id') || '').trim();
  return value.length >= 10 && value.length <= 100 ? value : null;
}

attemptsRouter.get('/', async (req, res, next) => {
  try {
    const id = String(req.query.learnerId || learnerId(req) || '').trim();
    if (!id) return res.status(400).json({ error: 'learnerId is required.' });
    const { rows } = await query(
      `SELECT a.id, a.problem_id, p.title, p.slug, a.status, a.started_at, a.submitted_at, a.updated_at,
              e.status AS evaluation_status, e.error_message, e.result_json
       FROM attempts a
       JOIN problems p ON p.id=a.problem_id
       LEFT JOIN submissions s ON s.attempt_id=a.id
       LEFT JOIN evaluations e ON e.submission_id=s.id
       WHERE a.learner_id=$1
       ORDER BY a.updated_at DESC`,
      [id],
    );
    res.json({ attempts: rows });
  } catch (error) { next(error); }
});

attemptsRouter.post('/', async (req, res, next) => {
  try {
    const id = learnerId(req);
    const problemId = String(req.body.problemId || '').trim();
    if (!id || !problemId) return res.status(400).json({ error: 'problemId and a valid learner ID are required.' });

    const { rows } = await query(
      `INSERT INTO attempts(learner_id, problem_id) VALUES($1,$2)
       RETURNING id, learner_id, problem_id, status, started_at, updated_at`,
      [id, problemId],
    );
    res.status(201).json({ attempt: rows[0] });
  } catch (error) { next(error); }
});

attemptsRouter.get('/:id', async (req, res, next) => {
  try {
    const id = learnerId(req);
    if (!id) return res.status(400).json({ error: 'A valid learner ID is required.' });
    const { rows } = await query(
      `SELECT a.id, a.learner_id, a.problem_id, a.status, a.started_at, a.submitted_at, a.updated_at,
              p.slug, p.title, p.summary, p.prompt, p.requirements,
              s.id AS submission_id, s.text_content, s.diagram_json, s.serialized_diagram, s.detected_code,
              e.id AS evaluation_id, e.status AS evaluation_status, e.result_json, e.precheck_json, e.error_message,
              e.attempt_count, e.started_at AS evaluation_started_at, e.completed_at AS evaluation_completed_at
       FROM attempts a
       JOIN problems p ON p.id=a.problem_id
       LEFT JOIN submissions s ON s.attempt_id=a.id
       LEFT JOIN evaluations e ON e.submission_id=s.id
       WHERE a.id=$1 AND a.learner_id=$2`,
      [req.params.id, id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Attempt not found.' });
    res.json({ attempt: rows[0] });
  } catch (error) { next(error); }
});

attemptsRouter.patch('/:id/draft', async (req, res, next) => {
  try {
    const id = learnerId(req);
    if (!id) return res.status(400).json({ error: 'A valid learner ID is required.' });
    const content = new SubmissionContent(req.body || {});

    const { rows } = await withTransaction(async (client) => {
      const attempt = await client.query(
        `SELECT a.id, a.status, p.slug FROM attempts a JOIN problems p ON p.id=a.problem_id WHERE a.id=$1 AND a.learner_id=$2 FOR UPDATE OF a`,
        [req.params.id, id],
      );
      if (!attempt.rows[0]) throw Object.assign(new Error('Attempt not found.'), { statusCode: 404 });
      if (attempt.rows[0].status !== 'draft') throw Object.assign(new Error('Only draft attempts can be edited.'), { statusCode: 409 });
      const precheck = runCommonMistakeCheck({
        problemSlug: attempt.rows[0].slug,
        text: content.textContent,
        diagram: content.diagram,
        diagramText: content.serializeDiagram(),
      });
      const result = await client.query(
        `INSERT INTO submissions(attempt_id, text_content, diagram_json, serialized_diagram, detected_code)
         VALUES($1,$2,$3::jsonb,$4,$5)
         ON CONFLICT(attempt_id) DO UPDATE SET
           text_content=EXCLUDED.text_content,
           diagram_json=EXCLUDED.diagram_json,
           serialized_diagram=EXCLUDED.serialized_diagram,
           detected_code=EXCLUDED.detected_code,
           updated_at=NOW()
         RETURNING id, text_content, diagram_json, serialized_diagram, detected_code, updated_at`,
        [req.params.id, content.textContent, JSON.stringify(content.diagram), content.serializeDiagram(), precheck.detectedCode],
      );
      await client.query('UPDATE attempts SET updated_at=NOW() WHERE id=$1', [req.params.id]);
      return { rows: [{ submission: result.rows[0] }] };
    });
    res.json(rows[0]);
  } catch (error) { next(error); }
});
