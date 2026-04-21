/**
 * POST /api/internal/v1/contests/run-scoring — Story E2 (secured; E1 webhook target).
 * @see docs/weekly-contests-ops-e2.md
 */
import { z } from 'zod';
import { getAdminFirestore } from '../lib/admin-firestore.js';
import {
  extractBearerOrHeaderSecret,
  getContestsOperatorOrCronSecret,
} from '../lib/contest-internal-auth.js';
import { runContestScoringJob } from './contest-scoring-job.js';
import { logContestScoringLine } from './contest-scoring-log.js';

const bodySchema = z
  .object({
    contestId: z.string().min(1).max(128).regex(/^[a-zA-Z0-9_-]+$/),
    scoringJobId: z.string().min(8).max(200).optional(),
    /** Echo from E1 webhook for log correlation. */
    trigger: z.string().max(64).optional(),
    requestId: z.string().max(128).optional(),
  })
  .strict();

/**
 * @type {import('express').RequestHandler}
 */
export async function postContestRunScoring(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();

  const configured = getContestsOperatorOrCronSecret();
  if (!configured) {
    logContestScoringLine({
      requestId,
      phase: 'http_run_scoring',
      outcome: 'not_configured',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message:
          'Set CONTEST_WINDOW_CRON_SECRET or CONTESTS_OPERATOR_SECRET for this hook.',
      },
    });
  }

  const provided = extractBearerOrHeaderSecret(req);
  if (provided !== configured) {
    logContestScoringLine({
      requestId,
      phase: 'http_run_scoring',
      outcome: 'unauthorized',
      httpStatus: 401,
      latencyMs: Date.now() - startMs,
    });
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid or missing credentials.',
      },
    });
  }

  const parsed = bodySchema.safeParse(req.body ?? {});
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid body (need contestId).',
        details: parsed.error.flatten(),
      },
    });
  }

  const { contestId, scoringJobId } = parsed.data;

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    return res.status(503).json({
      error: { code: 'server_misconfigured', message: 'Firestore not configured.' },
    });
  }

  const result = await runContestScoringJob({
    db,
    contestId,
    scoringJobId,
    requestId,
  });

  if (!result.ok) {
    return res.status(result.httpStatus).json({
      error: { code: result.code, message: result.message },
    });
  }

  return res.status(200).json({
    ok: true,
    contestId,
    scoringJobId: result.scoringJobId,
    transitioned: result.transitioned,
    standingsCount: result.standingsCount,
  });
}
