/**
 * POST /api/internal/v1/contests/:contestId/transition — Story D1 (operator / cron secret).
 * @see docs/weekly-contests-ops-d1.md
 */
import { FieldValue } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminFirestore } from './admin-firestore.js';
import { resolveSecretFromEnv } from './contest-internal-auth.js';
import {
  evaluateTransitionGuards,
  isContestStatus,
} from './contest-transitions.js';
import { logContestTransitionLine } from './contest-transition-log.js';

const contestIdParamSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const bodySchema = z
  .object({
    to: z.enum(['open', 'scoring', 'paid', 'cancelled']),
    /** When true, allows `open` → `scoring` before `windowEnd` (trusted ops only). */
    force: z.boolean().optional(),
    /** Optional audit hint when a human invokes the hook (still requires secret). */
    adminUid: z.string().min(1).max(128).optional(),
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
 * @param {unknown} c
 * @returns {c is Record<string, unknown>}
 */
function isRecord(c) {
  return c != null && typeof c === 'object' && !Array.isArray(c);
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

  const { to: targetTo, force = false, adminUid } = bodyParse.data;
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

  const ref = db.doc(`contests/${contestId}`);
  const nowMs = Date.now();

  try {
    const outcome = await db.runTransaction(async (t) => {
      const snap = await t.get(ref);
      if (!snap.exists) {
        return { type: 'missing' };
      }
      const data = snap.data();
      if (!isRecord(data)) {
        return { type: 'bad_doc' };
      }

      const curRaw = data.status;
      if (!isContestStatus(curRaw)) {
        return { type: 'bad_status' };
      }
      const cur = curRaw;

      if (cur === targetTo) {
        return { type: 'idempotent', status: cur };
      }

      const g = evaluateTransitionGuards({
        from: cur,
        to: targetTo,
        contestData: data,
        nowMs,
        force,
      });
      if (!g.ok) {
        return {
          type: 'guard',
          code: g.code,
          message: g.message,
          from: cur,
        };
      }

      t.update(ref, {
        status: targetTo,
        updatedAt: FieldValue.serverTimestamp(),
      });

      return { type: 'updated', from: cur, to: targetTo };
    });

    if (outcome.type === 'missing') {
      logContestTransitionLine({
        requestId,
        outcome: 'contest_not_found',
        httpStatus: 404,
        latencyMs: Date.now() - startMs,
        contestId,
        actorType,
        adminUid: adminUid ?? null,
        targetStatus: targetTo,
      });
      return res.status(404).json({
        error: { code: 'contest_not_found', message: 'Contest not found.' },
      });
    }

    if (outcome.type === 'bad_doc' || outcome.type === 'bad_status') {
      logContestTransitionLine({
        requestId,
        outcome: 'contest_invalid_shape',
        httpStatus: 500,
        latencyMs: Date.now() - startMs,
        contestId,
        actorType,
      });
      return res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Contest document is invalid.',
        },
      });
    }

    if (outcome.type === 'guard') {
      logContestTransitionLine({
        requestId,
        outcome: outcome.code,
        httpStatus: 400,
        latencyMs: Date.now() - startMs,
        contestId,
        actorType,
        adminUid: adminUid ?? null,
        from: outcome.from,
        targetStatus: targetTo,
        force,
      });
      return res.status(400).json({
        error: {
          code: outcome.code,
          message: outcome.message,
        },
      });
    }

    if (outcome.type === 'idempotent') {
      logContestTransitionLine({
        requestId,
        outcome: 'idempotent',
        httpStatus: 200,
        latencyMs: Date.now() - startMs,
        contestId,
        actorType,
        adminUid: adminUid ?? null,
        status: outcome.status,
        targetStatus: targetTo,
      });
      return res.status(200).json({
        idempotentReplay: true,
        contestId,
        status: outcome.status,
      });
    }

    logContestTransitionLine({
      requestId,
      outcome: 'ok',
      httpStatus: 200,
      latencyMs: Date.now() - startMs,
      contestId,
      actorType,
      adminUid: adminUid ?? null,
      from: outcome.from,
      to: outcome.to,
      force: force || undefined,
    });

    return res.status(200).json({
      contestId,
      from: outcome.from,
      to: outcome.to,
      actorType,
      adminUid: adminUid ?? null,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : String(e);
    logContestTransitionLine({
      requestId,
      outcome: 'transaction_failed',
      httpStatus: 500,
      latencyMs: Date.now() - startMs,
      contestId,
      message: msg,
    });
    return res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Could not update contest status.',
      },
    });
  }
}
