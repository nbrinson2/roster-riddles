/**
 * Admin weekly contests — list all lifecycle statuses + transition via Firebase admin claim.
 * @see docs/admin-dashboard-security.md
 */
import { z } from 'zod';
import { getAdminFirestore } from './admin-firestore.js';
import { mapContestDocumentToPublic } from './contest-public.js';
import { logContestReadLine } from './contest-read-log.js';
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

const ALL_STATUSES = ['scheduled', 'open', 'scoring', 'paid', 'cancelled'];

const adminTransitionBodySchema = z
  .object({
    to: z.enum(['open', 'scoring', 'paid', 'cancelled']),
    force: z.boolean().optional(),
    reason: z.string().max(500).optional(),
  })
  .strict();

const DEFAULT_ADMIN_LIST_LIMIT = 50;
const MAX_ADMIN_LIST_LIMIT = 100;

/**
 * @param {import('express').Request} req
 */
function parseAdminListLimit(req) {
  const raw = req.query.limit;
  const s =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw)
        ? String(raw[0] ?? '')
        : '';
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_ADMIN_LIST_LIMIT;
  return Math.min(n, MAX_ADMIN_LIST_LIMIT);
}

/**
 * @type {import('express').RequestHandler}
 */
export async function getAdminContestList(req, res) {
  const startMs = Date.now();
  const requestId = req.requestId ?? 'unknown';
  const uid = req.user?.uid;

  const rl = await req.consumeContestReadRateLimit?.();
  if (rl && rl.allowed === false) {
    const retry = rl.retryAfterSec ?? null;
    if (retry != null) {
      res.setHeader('Retry-After', String(retry));
    }
    logContestReadLine({
      requestId,
      outcome: 'rate_limited',
      httpStatus: 429,
      latencyMs: Date.now() - startMs,
      route: 'admin_list',
      uid: uid ?? null,
    });
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many requests.',
        ...(retry != null ? { retryAfterSec: retry } : {}),
      },
    });
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logContestReadLine({
      requestId,
      outcome: 'firestore_init_failed',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      route: 'admin_list',
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server is not configured for Firestore.',
      },
    });
  }

  const limit = parseAdminListLimit(req);

  try {
    const tasks = ALL_STATUSES.map((status) =>
      db.collection('contests').where('status', '==', status).limit(50).get(),
    );
    const snaps = await Promise.all(tasks);
    const byId = new Map();
    for (const snap of snaps) {
      snap.forEach((doc) => {
        const pub = mapContestDocumentToPublic(doc.id, doc.data());
        if (pub) {
          byId.set(doc.id, pub);
        }
      });
    }

    let rows = Array.from(byId.values());
    rows.sort((a, b) => {
      const wa = String(a.windowStart ?? '');
      const wb = String(b.windowStart ?? '');
      const c = wb.localeCompare(wa);
      if (c !== 0) {
        return c;
      }
      return String(a.contestId ?? '').localeCompare(String(b.contestId ?? ''));
    });
    rows = rows.slice(0, limit);

    logContestReadLine({
      requestId,
      outcome: 'ok',
      httpStatus: 200,
      latencyMs: Date.now() - startMs,
      route: 'admin_list',
      uid: uid ?? null,
      count: rows.length,
    });

    return res.status(200).json({
      schemaVersion: 1,
      contests: rows,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : String(e);
    logContestReadLine({
      requestId,
      outcome: 'query_failed',
      httpStatus: 500,
      latencyMs: Date.now() - startMs,
      route: 'admin_list',
      message: msg,
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not load contests.' },
    });
  }
}

/**
 * @type {import('express').RequestHandler}
 */
export async function postAdminContestTransition(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();

  let contestIdRaw = req.params.contestId;
  if (typeof contestIdRaw !== 'string') {
    contestIdRaw = String(contestIdRaw ?? '');
  }
  contestIdRaw = decodeURIComponent(contestIdRaw.trim());
  const parsedId = contestIdParamSchema.safeParse(contestIdRaw);
  if (!parsedId.success) {
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid contest id.' },
    });
  }
  const contestId = parsedId.data;

  const bodyParse = adminTransitionBodySchema.safeParse(req.body ?? {});
  if (!bodyParse.success) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request body.',
        details: bodyParse.error.flatten(),
      },
    });
  }

  const { to: targetTo, force = false, reason } = bodyParse.data;
  const adminUid = req.user?.uid ?? null;
  const actorType = 'admin';

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
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
