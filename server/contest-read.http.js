/**
 * GET /api/v1/contests and GET /api/v1/contests/:contestId — Story D2.
 * @see docs/weekly-contests-api-d2.md
 */
import { z } from 'zod';
import { getAdminFirestore } from './admin-firestore.js';
import { mapContestDocumentToPublic } from './contest-public.js';
import { logContestReadLine } from './contest-read-log.js';

const contestIdParamSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const DEFAULT_LIST_LIMIT = 25;
const MAX_LIST_LIMIT = 50;

/**
 * @param {import('express').Request} req
 */
function parseListLimit(req) {
  const raw = req.query.limit;
  const s =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw)
        ? String(raw[0] ?? '')
        : '';
  const n = Number.parseInt(s, 10);
  if (!Number.isFinite(n) || n < 1) return DEFAULT_LIST_LIMIT;
  return Math.min(n, MAX_LIST_LIMIT);
}

/**
 * @param {import('express').Request} req
 * @returns {{ ok: true, filter: Set<string> | null } | { ok: false }}
 */
function parseStatusFilter(req) {
  const raw = req.query.status;
  const s =
    typeof raw === 'string'
      ? raw
      : Array.isArray(raw)
        ? String(raw[0] ?? '')
        : '';
  if (!s.trim()) {
    return { ok: true, filter: null };
  }
  const parts = s
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  const allowed = new Set(['open', 'scheduled']);
  const out = new Set();
  for (const p of parts) {
    if (allowed.has(p)) {
      out.add(p);
    }
  }
  if (out.size === 0) {
    return { ok: false };
  }
  return { ok: true, filter: out };
}

/**
 * @param {Record<string, unknown>} a
 * @param {Record<string, unknown>} b
 * @returns {number}
 */
function sortPublicContests(a, b) {
  const sa = typeof a.status === 'string' ? a.status : '';
  const sb = typeof b.status === 'string' ? b.status : '';
  const pri = (s) => (s === 'open' ? 0 : s === 'scheduled' ? 1 : 2);
  const dp = pri(sa) - pri(sb);
  if (dp !== 0) {
    return dp;
  }
  const wa = Date.parse(String(a.windowEnd ?? ''));
  const wb = Date.parse(String(b.windowEnd ?? ''));
  if (sa === 'open' && sb === 'open' && !Number.isNaN(wa) && !Number.isNaN(wb)) {
    return wa - wb;
  }
  const wsa = Date.parse(String(a.windowStart ?? ''));
  const wsb = Date.parse(String(b.windowStart ?? ''));
  if (!Number.isNaN(wsa) && !Number.isNaN(wsb)) {
    return wsa - wsb;
  }
  return String(a.contestId ?? '').localeCompare(String(b.contestId ?? ''));
}

/**
 * @type {import('express').RequestHandler}
 */
export async function getContestList(req, res) {
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
      route: 'list',
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
      route: 'list',
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server is not configured for Firestore.',
      },
    });
  }

  const limit = parseListLimit(req);
  const parsedStatus = parseStatusFilter(req);
  if (!parsedStatus.ok) {
    logContestReadLine({
      requestId,
      outcome: 'invalid_status_filter',
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
      route: 'list',
    });
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message:
          'Invalid status filter. Use comma-separated open and/or scheduled (e.g. open,scheduled).',
      },
    });
  }
  const statusFilter = parsedStatus.filter;

  try {
    const needOpen = !statusFilter || statusFilter.has('open');
    const needScheduled = !statusFilter || statusFilter.has('scheduled');

    const tasks = [];
    if (needOpen) {
      tasks.push(
        db
          .collection('contests')
          .where('status', '==', 'open')
          .orderBy('windowStart', 'desc')
          .limit(50)
          .get(),
      );
    }
    if (needScheduled) {
      tasks.push(
        db
          .collection('contests')
          .where('status', '==', 'scheduled')
          .limit(50)
          .get(),
      );
    }

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
    rows.sort(sortPublicContests);
    rows = rows.slice(0, limit);

    logContestReadLine({
      requestId,
      outcome: 'ok',
      httpStatus: 200,
      latencyMs: Date.now() - startMs,
      route: 'list',
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
      route: 'list',
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
export async function getContestDetail(req, res) {
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
      route: 'detail',
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

  let contestIdRaw = req.params.contestId;
  if (typeof contestIdRaw !== 'string') {
    contestIdRaw = String(contestIdRaw ?? '');
  }
  contestIdRaw = decodeURIComponent(contestIdRaw.trim());
  const parsedId = contestIdParamSchema.safeParse(contestIdRaw);
  if (!parsedId.success) {
    logContestReadLine({
      requestId,
      outcome: 'invalid_contest_id',
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
      route: 'detail',
    });
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
      route: 'detail',
      contestId,
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server is not configured for Firestore.',
      },
    });
  }

  try {
    const snap = await db.doc(`contests/${contestId}`).get();
    if (!snap.exists) {
      logContestReadLine({
        requestId,
        outcome: 'contest_not_found',
        httpStatus: 404,
        latencyMs: Date.now() - startMs,
        route: 'detail',
        contestId,
      });
      return res.status(404).json({
        error: { code: 'contest_not_found', message: 'Contest not found.' },
      });
    }

    const pub = mapContestDocumentToPublic(contestId, snap.data());
    if (!pub) {
      logContestReadLine({
        requestId,
        outcome: 'wrong_game_mode',
        httpStatus: 400,
        latencyMs: Date.now() - startMs,
        route: 'detail',
        contestId,
      });
      return res.status(400).json({
        error: {
          code: 'wrong_game_mode',
          message: 'This contest is not available for Bio Ball in this API version.',
        },
      });
    }

    logContestReadLine({
      requestId,
      outcome: 'ok',
      httpStatus: 200,
      latencyMs: Date.now() - startMs,
      route: 'detail',
      contestId,
      uid: uid ?? null,
    });

    return res.status(200).json({
      schemaVersion: 1,
      contest: pub,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : String(e);
    logContestReadLine({
      requestId,
      outcome: 'read_failed',
      httpStatus: 500,
      latencyMs: Date.now() - startMs,
      route: 'detail',
      contestId,
      message: msg,
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not load contest.' },
    });
  }
}
