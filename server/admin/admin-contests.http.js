/**
 * Admin weekly contests — list, create, transition (Firebase `admin: true` claim).
 * @see docs/admin/admin-dashboard-security.md
 */
import { randomBytes } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminFirestore } from '../lib/admin-firestore.js';
import { mapContestDocumentToPublic } from '../contests/contest-public.js';
import { logContestReadLine } from '../contests/contest-read-log.js';
import { runContestPayoutExecuteJob } from '../contests/contest-payout-execute.job.js';
import { runContestScoringJob } from '../contests/contest-scoring-job.js';
import { runContestStatusTransition } from '../contests/contest-transition-run.js';
import {
  sendContestTransitionHttpResult,
  sendContestTransitionTransactionError,
} from '../contests/contest-transition-http-shared.js';
import {
  getStripeClient,
  isContestsPaymentsEnabled,
  sendStripeServiceUnavailable,
} from '../payments/stripe-server.js';

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

const adminCreateBodySchema = z
  .object({
    /** Omit or empty to let the server assign `bb-<ms>-<hex>` (unique, URL-safe). */
    contestId: z.union([contestIdParamSchema, z.literal('')]).optional(),
    status: z.enum(['scheduled', 'open']),
    windowStart: z.string().min(1).max(80),
    windowEnd: z.string().min(1).max(80),
    leagueGamesN: z.number().int().min(1).max(100),
    rulesVersion: z.union([z.number(), z.string().min(1).max(32)]).optional(),
    title: z.string().max(200).optional(),
    /** Optional UI / dry-run display (cents). */
    prizePoolCents: z.number().int().min(0).max(100_000_000).optional(),
    entryFeeCents: z.number().int().min(0).max(10_000_000).optional(),
    maxEntries: z.number().int().min(1).max(10_000_000).optional(),
  })
  .strict();

/**
 * @returns {string} — matches `contestIdParamSchema`; collision probability negligible.
 */
function generateAdminContestId() {
  return `bb-${Date.now()}-${randomBytes(4).toString('hex')}`;
}

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

/** `POST /api/v1/admin/contests` — create Bio Ball contest (Admin SDK). */
export async function postAdminContestCreate(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();
  const uid = req.user?.uid ?? null;

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
      route: 'admin_create',
      uid,
    });
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many requests.',
        ...(retry != null ? { retryAfterSec: retry } : {}),
      },
    });
  }

  const bodyParse = adminCreateBodySchema.safeParse(req.body ?? {});
  if (!bodyParse.success) {
    logContestReadLine({
      requestId,
      outcome: 'validation_error',
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
      route: 'admin_create',
      uid,
    });
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request body.',
        details: bodyParse.error.flatten(),
      },
    });
  }

  const {
    contestId: contestIdRaw,
    status,
    windowStart: wsRaw,
    windowEnd: weRaw,
    leagueGamesN,
    rulesVersion: rulesVersionIn,
    title: titleIn,
    prizePoolCents: prizePoolCentsIn,
    entryFeeCents: entryFeeCentsIn,
    maxEntries: maxEntriesIn,
  } = bodyParse.data;

  let contestId =
    typeof contestIdRaw === 'string' && contestIdRaw.trim()
      ? contestIdRaw.trim()
      : generateAdminContestId();

  const wsMs = Date.parse(wsRaw);
  const weMs = Date.parse(weRaw);
  if (!Number.isFinite(wsMs) || !Number.isFinite(weMs)) {
    logContestReadLine({
      requestId,
      outcome: 'invalid_window',
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
      route: 'admin_create',
      contestId: contestId ?? null,
      uid,
    });
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'windowStart and windowEnd must be valid ISO 8601 date strings.',
      },
    });
  }
  if (wsMs >= weMs) {
    logContestReadLine({
      requestId,
      outcome: 'invalid_window_order',
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
      route: 'admin_create',
      contestId,
      uid,
    });
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'windowStart must be before windowEnd.',
      },
    });
  }

  let rulesVersion = rulesVersionIn ?? 1;
  if (typeof rulesVersion === 'number') {
    if (!Number.isFinite(rulesVersion)) {
      rulesVersion = 1;
    }
  } else {
    rulesVersion = String(rulesVersion).trim() || '1';
  }

  const titleTrim =
    typeof titleIn === 'string' && titleIn.trim() ? titleIn.trim() : '';

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logContestReadLine({
      requestId,
      outcome: 'firestore_init_failed',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      route: 'admin_create',
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

  try {
    const existing = await ref.get();
    if (existing.exists) {
      logContestReadLine({
        requestId,
        outcome: 'contest_id_conflict',
        httpStatus: 409,
        latencyMs: Date.now() - startMs,
        route: 'admin_create',
        contestId,
        uid,
      });
      return res.status(409).json({
        error: {
          code: 'contest_id_exists',
          message: 'A contest with this id already exists.',
        },
      });
    }

    await ref.set({
      schemaVersion: 1,
      status,
      gameMode: 'bio-ball',
      rulesVersion,
      windowStart: Timestamp.fromMillis(wsMs),
      windowEnd: Timestamp.fromMillis(weMs),
      leagueGamesN,
      title: titleTrim || contestId,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      metadata: {
        createdByAdminUid: uid,
        source: 'admin_api_create_v1',
      },
      ...(typeof prizePoolCentsIn === 'number' ? { prizePoolCents: prizePoolCentsIn } : {}),
      ...(typeof entryFeeCentsIn === 'number' ? { entryFeeCents: entryFeeCentsIn } : {}),
      ...(typeof maxEntriesIn === 'number' ? { maxEntries: maxEntriesIn } : {}),
    });

    const snap = await ref.get();
    const pub = mapContestDocumentToPublic(contestId, snap.data());
    if (!pub) {
      logContestReadLine({
        requestId,
        outcome: 'create_projection_failed',
        httpStatus: 500,
        latencyMs: Date.now() - startMs,
        route: 'admin_create',
        contestId,
        uid,
      });
      return res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Contest was created but could not be read back.',
        },
      });
    }

    logContestReadLine({
      requestId,
      outcome: 'ok',
      httpStatus: 201,
      latencyMs: Date.now() - startMs,
      route: 'admin_create',
      contestId,
      uid,
    });

    return res.status(201).json({
      schemaVersion: 1,
      contest: pub,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : String(e);
    logContestReadLine({
      requestId,
      outcome: 'create_failed',
      httpStatus: 500,
      latencyMs: Date.now() - startMs,
      route: 'admin_create',
      contestId,
      message: msg,
      uid,
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not create contest.' },
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

/**
 * POST /api/v1/admin/contests/:contestId/run-scoring — Story E2 job; Firebase `admin: true` only.
 * Same work as internal `POST /api/internal/v1/contests/run-scoring` without operator secret.
 */
export async function postAdminContestRunScoring(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();
  const uid = req.user?.uid ?? null;

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
      route: 'admin_run_scoring',
      uid,
    });
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many requests.',
        ...(retry != null ? { retryAfterSec: retry } : {}),
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
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid contest id.' },
    });
  }
  const contestId = parsedId.data;

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logContestReadLine({
      requestId,
      outcome: 'firestore_init_failed',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      route: 'admin_run_scoring',
      message: e instanceof Error ? e.message : String(e),
      contestId,
      uid,
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server is not configured for Firestore.',
      },
    });
  }

  const result = await runContestScoringJob({
    db,
    contestId,
    requestId,
  });

  if (!result.ok) {
    logContestReadLine({
      requestId,
      outcome: 'scoring_failed',
      httpStatus: result.httpStatus,
      latencyMs: Date.now() - startMs,
      route: 'admin_run_scoring',
      contestId,
      uid,
      code: result.code,
    });
    return res.status(result.httpStatus).json({
      error: { code: result.code, message: result.message },
    });
  }

  logContestReadLine({
    requestId,
    outcome: 'ok',
    httpStatus: 200,
    latencyMs: Date.now() - startMs,
    route: 'admin_run_scoring',
    contestId,
    uid,
    scoringJobId: result.scoringJobId,
    transitioned: result.transitioned,
    standingsCount: result.standingsCount,
  });

  return res.status(200).json({
    ok: true,
    contestId,
    scoringJobId: result.scoringJobId,
    transitioned: result.transitioned,
    standingsCount: result.standingsCount,
  });
}

const adminPayoutExecuteBodySchema = z
  .object({
    payoutJobId: z.string().min(8).max(200).optional(),
  })
  .strict();

/**
 * POST /api/v1/admin/contests/:contestId/payout-execute — Phase 6 P6-D3; Firebase `admin: true` only.
 * Same work as internal `POST /api/internal/v1/contests/:contestId/payouts/execute` without operator secret.
 */
export async function postAdminContestPayoutExecute(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();
  const uid = req.user?.uid ?? null;

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
      route: 'admin_payout_execute',
      uid,
    });
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many requests.',
        ...(retry != null ? { retryAfterSec: retry } : {}),
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
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid contest id.' },
    });
  }
  const contestId = parsedId.data;

  const bodyParse = adminPayoutExecuteBodySchema.safeParse(req.body ?? {});
  if (!bodyParse.success) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request body.',
        details: bodyParse.error.flatten(),
      },
    });
  }

  if (!isContestsPaymentsEnabled()) {
    logContestReadLine({
      requestId,
      outcome: 'payments_disabled',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      route: 'admin_payout_execute',
      contestId,
      uid,
    });
    return res.status(503).json({
      error: {
        code: 'contest_payments_disabled',
        message: 'CONTESTS_PAYMENTS_ENABLED is not true.',
      },
    });
  }

  let stripe;
  try {
    stripe = getStripeClient();
  } catch (e) {
    logContestReadLine({
      requestId,
      outcome: 'stripe_key_error',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      route: 'admin_payout_execute',
      contestId,
      uid,
      message: e instanceof Error ? e.message : String(e),
    });
    return sendStripeServiceUnavailable(res);
  }
  if (!stripe) {
    logContestReadLine({
      requestId,
      outcome: 'stripe_unavailable',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      route: 'admin_payout_execute',
      contestId,
      uid,
    });
    return sendStripeServiceUnavailable(res);
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
      route: 'admin_payout_execute',
      contestId,
      uid,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server is not configured for Firestore.',
      },
    });
  }

  const result = await runContestPayoutExecuteJob({
    db,
    stripe,
    contestId,
    requestId,
    payoutJobId: bodyParse.data.payoutJobId,
    startMs,
  });

  const ok = result.httpStatus >= 200 && result.httpStatus < 300;
  const errPayload = 'error' in result.json ? result.json.error : undefined;
  const errCode =
    errPayload && typeof errPayload === 'object' && errPayload !== null && 'code' in errPayload
      ? String(/** @type {Record<string, unknown>} */ (errPayload).code ?? '')
      : '';
  logContestReadLine({
    requestId,
    outcome: ok ? 'ok' : 'payout_execute_failed',
    httpStatus: result.httpStatus,
    latencyMs: Date.now() - startMs,
    route: 'admin_payout_execute',
    contestId,
    uid,
    ...(errCode !== '' ? { code: errCode } : {}),
  });

  return res.status(result.httpStatus).json(result.json);
}
