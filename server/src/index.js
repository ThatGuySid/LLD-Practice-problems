import express from 'express';
import cors from 'cors';
import { env } from './config/env.js';
import { pool } from './db/pool.js';
import { problemsRouter } from './routes/problems.js';
import { attemptsRouter } from './routes/attempts.js';
import { createSubmissionsRouter } from './routes/submissions.js';
import { GeminiEvaluator } from './evaluation/geminiEvaluator.js';
import { EvaluationService } from './evaluation/service.js';

const app = express();
app.use(cors({ origin: env.clientOrigin, credentials: false }));
app.use(express.json({ limit: '1mb' }));

const evaluationService = new EvaluationService({ evaluator: new GeminiEvaluator() });

app.get('/api/health', async (_req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true, database: 'connected', geminiConfigured: Boolean(env.geminiApiKey) });
  } catch {
    res.status(503).json({ ok: false, database: 'unavailable', geminiConfigured: Boolean(env.geminiApiKey) });
  }
});

app.use('/api/problems', problemsRouter);
app.use('/api/attempts', attemptsRouter);
app.use('/api/submissions', createSubmissionsRouter({ evaluationService }));

app.use((error, _req, res, _next) => {
  const status = error.statusCode || 500;
  console.error(error);
  res.status(status).json({ error: error.message || 'Internal server error.' });
});

const server = app.listen(env.port, () => {
  console.log(`API listening on http://localhost:${env.port}`);
  evaluationService.recoverStuckEvaluations().catch((error) => console.error('Recovery failed:', error.message));
});

process.on('SIGTERM', async () => {
  server.close();
  await pool.end();
});
