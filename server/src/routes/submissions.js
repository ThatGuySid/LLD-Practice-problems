import { Router } from 'express';
import { EvaluationService } from '../evaluation/service.js';

export function createSubmissionsRouter({ evaluationService }) {
  const router = Router();

  router.post('/:attemptId/submit', async (req, res, next) => {
    try {
      const result = await evaluationService.submitAttempt(req.params.attemptId, req.body || {});
      res.status(202).json({
        attemptId: req.params.attemptId,
        status: result.precheck.hardFailures.length ? 'failed' : 'submitted',
        precheck: result.precheck,
      });
    } catch (error) { next(error); }
  });

  return router;
}

export { EvaluationService };
