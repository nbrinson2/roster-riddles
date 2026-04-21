/**
 * POST /api/internal/v1/contests/:contestId/transition — Story D1 (operator / cron secret).
 * @see docs/weekly-contests-ops-d1.md
 */
import { z } from 'zod';
import { getAdminFirestore } from './admin-firestore.js';
import { resolveSecretFromEnv } from './contest-internal-auth.js';
import { runContestStatusTransition } from './contest-transition-run.js';
import {
  sendContestTransitionHttpResult,
  sendContestTransitionTransactionError,
} from './contest-transition-http-shared.js';

const contestIdParamSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const bodySchema = z
  .object({
    to: z.enum(['open', 'scoring', 'paid', 'cancelled']),
    /**
     * When true: skips `windowEnd` for `open`→`scoring`, and allows `paid`→`cancelled`|`scoring` (Story F2).
     */
    force: z.boolean().optional(),
    /** Optional audit hint when a human invokes the hook (still requires secret). */
    adminUid: z.string().min(1).max(128).optional(),
    /** Optional note for logs (e.g. why dry-run was voided or re-scored). Story F2. */
    reason: z.string().max(500).optional(),
  })
  .strict();

function getOperatorSecret() {
  return resolveSecretFromEnv('CONTESTS_OPERATOR_SECRET');
}

/**
 * @param {import('express').Request} req
 */
function extractBearerSecret(req) {
  const h = req.headers.authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return '';
  return h.slice('Bearer '.length).trim();
}

/**
 * @type {import('express').RequestHandler}
 */
export async function postContestTransition(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();

  const secret = getOperatorSecret();
  if (!secret) {
    logContestTransitionLine({
      requestId,
      outcome: 'not_configured',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message:
          'Contest transitions are disabled until CONTESTS_OPERATOR_SECRET is configured.',
      },
    });
  }

  const provided =
    extractBearerSecret(req) ||
    (typeof req.headers['x-contests-operator-secret'] === 'string'
      ? req.headers['x-contests-operator-secret'].trim()
      : '');

  if (provided !== secret) {
    logContestTransitionLine({
      requestId,
      outcome: 'unauthorized',
      httpStatus: 401,
      latencyMs: Date.now() - startMs,
    });
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid or missing operator credentials.',
      },
    });
  }

  let contestIdRaw = req.params.contestId;
  if (typeof contestIdRaw !== 'string') {
    contestIdRaw = String(contestIdRaw ?? '');
  }
  contestIdRaw = decodeURIComponent(contestIdRaw.trim());
  const parsedId = contestIdParamSchema.safeParse(contestIdRaw);
  if (!parsedId.success) {
    logContestTransitionLine({
      requestId,
      outcome: 'invalid_contest_id',
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
    });
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid contest id.' },
    });
  }
  const contestId = parsedId.data;

  const bodyParse = bodySchema.safeParse(req.body ?? {});
  if (!bodyParse.success) {
    logContestTransitionLine({
      requestId,
      outcome: 'validation_error',
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request body.',
        details: bodyParse.error.flatten(),
      },
    });
  }

  const { to: targetTo, force = false, adminUid, reason } = bodyParse.data;
  const actorType = adminUid ? 'admin' : 'system';

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logContestTransitionLine({
      requestId,
      outcome: 'firestore_init_failed',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      contestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server is not configured for Firestore.',
      },
    });
  }

  const nowMs = Date.now();

  try {
    const outcome = await runContestStatusTransition(db, {
      contestId,
      targetTo,
      force,
      nowMs,
    });

    return sendContestTransitionHttpResult(res, {
      outcome,
      requestId,
      startMs,
      contestId,
      targetTo,
      force,
      adminUid,
      reason,
      actorType,
    });
  } catch (e) {
    return sendContestTransitionTransactionError(res, {
      requestId,
      startMs,
      contestId,
      err: e,
    });
  }
}
