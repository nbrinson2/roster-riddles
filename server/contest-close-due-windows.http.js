/**
 * POST /api/internal/v1/contests/close-due-windows — Story E1 (cron / secured hook).
 * Finds `open` contests whose `windowEnd` has passed, moves them to `scoring`, optionally POSTs to a worker URL.
 * @see docs/weekly-contests-ops-e1.md
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from './admin-firestore.js';
import { evaluateTransitionGuards, isContestStatus } from './contest-transitions.js';
import { logContestScoringLine } from './contest-scoring-log.js';

const BIO_BALL = 'bio-ball';

/**
 * Prefer dedicated cron secret; fall back to operator secret for small deployments.
 */
function getWindowCronSecret() {
  return (
    process.env.CONTEST_WINDOW_CRON_SECRET?.trim() ||
    process.env.CONTESTS_OPERATOR_SECRET?.trim() ||
    ''
  );
}

/**
 * @param {import('express').Request} req
 */
function extractBearerSecret(req) {
  const h = req.headers.authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return '';
  return h.slice('Bearer '.length).trim();
}

function parseBatchSize() {
  const raw = process.env.CONTEST_CLOSE_WINDOW_BATCH_SIZE?.trim() ?? '';
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1) return 25;
  return Math.min(n, 100);
}

/**
 * @param {unknown} c
 * @returns {c is Record<string, unknown>}
 */
function isRecord(c) {
  return c != null && typeof c === 'object' && !Array.isArray(c);
}

/**
 * @param {string} contestId
 * @param {string} requestId
 * @returns {Promise<{ ok: boolean; skipped?: boolean; httpStatus?: number }>}
 */
async function postScoringWebhook(contestId, requestId) {
  const url = process.env.CONTEST_SCORING_WEBHOOK_URL?.trim() ?? '';
  if (!url) {
    logContestScoringLine({
      requestId,
      contestId,
      phase: 'enqueue',
      outcome: 'skipped_no_webhook_url',
    });
    return { ok: true, skipped: true };
  }

  const secret = process.env.CONTEST_SCORING_WEBHOOK_SECRET?.trim() ?? '';
  const body = JSON.stringify({
    contestId,
    trigger: 'window_closed',
    requestId,
  });

  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(secret ? { Authorization: `Bearer ${secret}` } : {}),
      },
      body,
    });

    const text = await r.text().catch(() => '');

    if (!r.ok) {
      logContestScoringLine({
        requestId,
        contestId,
        phase: 'enqueue',
        outcome: 'webhook_http_error',
        httpStatus: r.status,
        detail: text.slice(0, 240),
      });
      return { ok: false, httpStatus: r.status };
    }

    logContestScoringLine({
      requestId,
      contestId,
      phase: 'enqueue',
      outcome: 'webhook_ok',
      httpStatus: r.status,
    });
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 400) : String(e);
    logContestScoringLine({
      requestId,
      contestId,
      phase: 'enqueue',
      outcome: 'webhook_fetch_failed',
      message: msg,
    });
    return { ok: false };
  }
}

/**
 * @type {import('express').RequestHandler}
 */
export async function postContestCloseDueWindows(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();

  const configured = getWindowCronSecret();
  if (!configured) {
    logContestScoringLine({
      requestId,
      phase: 'close_due_windows',
      outcome: 'not_configured',
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

  const provided =
    extractBearerSecret(req) ||
    (typeof req.headers['x-contest-window-cron-secret'] === 'string'
      ? req.headers['x-contest-window-cron-secret'].trim()
      : '');

  if (provided !== configured) {
    logContestScoringLine({
      requestId,
      phase: 'close_due_windows',
      outcome: 'unauthorized',
      httpStatus: 401,
      latencyMs: Date.now() - startMs,
    });
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid or missing cron credentials.',
      },
    });
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logContestScoringLine({
      requestId,
      phase: 'close_due_windows',
      outcome: 'firestore_init_failed',
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server is not configured for Firestore.',
      },
    });
  }

  const batchSize = parseBatchSize();
  const now = Timestamp.now();
  const nowMs = Date.now();

  let snap;
  try {
    snap = await db
      .collection('contests')
      .where('status', '==', 'open')
      .where('windowEnd', '<=', now)
      .orderBy('windowEnd', 'asc')
      .limit(batchSize)
      .get();
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : String(e);
    logContestScoringLine({
      requestId,
      phase: 'close_due_windows',
      outcome: 'query_failed',
      latencyMs: Date.now() - startMs,
      message: msg,
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not query contests.' },
    });
  }

  const transitioned = [];
  const skipped = [];
  const webhookFailures = [];

  for (const doc of snap.docs) {
    const contestId = doc.id;

    try {
      const txResult = await db.runTransaction(async (t) => {
        const ref = db.doc(`contests/${contestId}`);
        const s = await t.get(ref);
        if (!s.exists) {
          return { type: 'missing' };
        }
        const data = s.data();
        if (!isRecord(data)) {
          return { type: 'bad_doc' };
        }

        const cur = data.status;
        if (!isContestStatus(cur) || cur !== 'open') {
          return { type: 'not_open', current: cur };
        }

        if (data.gameMode !== BIO_BALL) {
          return { type: 'wrong_game_mode' };
        }

        const g = evaluateTransitionGuards({
          from: 'open',
          to: 'scoring',
          contestData: data,
          nowMs,
          force: false,
        });
        if (!g.ok) {
          return { type: 'guard', code: g.code, message: g.message };
        }

        t.update(ref, {
          status: 'scoring',
          updatedAt: FieldValue.serverTimestamp(),
        });
        return { type: 'updated' };
      });

      if (txResult.type === 'updated') {
        transitioned.push(contestId);
        logContestScoringLine({
          requestId,
          contestId,
          phase: 'transition',
          outcome: 'open_to_scoring',
        });

        const wh = await postScoringWebhook(contestId, requestId);
        if (!wh.ok && !wh.skipped) {
          webhookFailures.push(contestId);
        }
      } else if (txResult.type === 'not_open') {
        skipped.push({ contestId, reason: 'not_open', current: txResult.current });
        logContestScoringLine({
          requestId,
          contestId,
          phase: 'transition',
          outcome: 'skipped_concurrent_state',
          currentStatus: txResult.current,
        });
      } else if (txResult.type === 'wrong_game_mode') {
        skipped.push({ contestId, reason: 'wrong_game_mode' });
        logContestScoringLine({
          requestId,
          contestId,
          phase: 'transition',
          outcome: 'skipped_wrong_game_mode',
        });
      } else if (txResult.type === 'guard') {
        skipped.push({ contestId, reason: txResult.code });
        logContestScoringLine({
          requestId,
          contestId,
          phase: 'transition',
          outcome: txResult.code,
          message: txResult.message,
        });
      } else if (txResult.type === 'missing' || txResult.type === 'bad_doc') {
        skipped.push({ contestId, reason: txResult.type });
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message.slice(0, 400) : String(e);
      logContestScoringLine({
        requestId,
        contestId,
        phase: 'transition',
        outcome: 'transaction_failed',
        message: msg,
      });
      skipped.push({ contestId, reason: 'transaction_failed' });
    }
  }

  logContestScoringLine({
    requestId,
    phase: 'close_due_windows',
    outcome: 'batch_complete',
    latencyMs: Date.now() - startMs,
    examined: snap.size,
    transitionedCount: transitioned.length,
    webhookFailureCount: webhookFailures.length,
  });

  return res.status(200).json({
    ok: true,
    examined: snap.size,
    transitioned,
    skipped,
    webhookFailures,
    hasMore: snap.size >= batchSize,
  });
}
