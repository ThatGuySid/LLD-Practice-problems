import { Router } from 'express';
import { query } from '../db/pool.js';

export const problemsRouter = Router();

problemsRouter.get('/', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, slug, title, summary, prompt, requirements, created_at
       FROM problems ORDER BY title`,
    );
    res.json({ problems: rows });
  } catch (error) { next(error); }
});

problemsRouter.get('/:id', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, slug, title, summary, prompt, requirements, created_at
       FROM problems WHERE id=$1`,
      [req.params.id],
    );
    if (!rows[0]) return res.status(404).json({ error: 'Problem not found.' });
    res.json({ problem: rows[0] });
  } catch (error) { next(error); }
});
