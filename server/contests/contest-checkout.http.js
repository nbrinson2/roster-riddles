/**
 * POST /api/v1/contests/:contestId/checkout-session — Phase 5 Story P5-D1.
 * Authenticated Stripe Checkout Session for paid contest entry (redirect flow).
 * @see docs/weekly-contests/weekly-contests-api-phase5.md
 * @see docs/weekly-contests/weekly-contests-phase5-entry-fees-adr.md
 */
import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { findBlockingOpenContestSameGameMode } from './contest-blocking-entry.js';
import { logContestCheckoutLine } from './contest-checkout-log.js';
import { getAdminFirestore } from '../lib/admin-firestore.js';
import {
  getStripeClient,
  isContestsPaymentsEnabled,
  sendStripeServiceUnavailable,
} from '../payments/stripe-server.js';

/** Phase 4 v1 — must match contest join / ADR. */
const BIO_BALL = 'bio-ball';

const contestIdParamSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const checkoutBodySchema = z
  .object({
    clientRequestId: z.string().min(8).max(200).optional(),
  })
  .strict();

/**
 * @param {FirebaseFirestore.DocumentData | undefined} c
 * @returns {c is Record<string, unknown>}
 */
function isRecord(c) {
  return c != null && typeof c === 'object' && !Array.isArray(c);
}

/**
 * @param {Record<string, unknown>} contest
 * @returns {number} Non-negative integer cents; `0` when absent or invalid.
 */
export function getEntryFeeCentsFromContest(contest) {
  const v = contest.entryFeeCents;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    return 0;
  }
  return Math.floor(v);
}

/**
 * @param {Record<string, unknown> | undefined} data — `entries/{uid}` document data
 * @returns {boolean} `true` when a new Checkout Session must be rejected (409).
 */
export function entryDataBlocksNewPaidCheckout(data) {
  if (!data) {
    return false;
  }
  const ps = data.paymentStatus;
  if (ps === 'failed') {
    return false;
  }
  if (
    ps === 'paid' ||
    ps === 'pending' ||
    ps === 'free' ||
    ps === 'refunded'
  ) {
    return true;
  }
  // Legacy Phase 4 rows (no `paymentStatus`) or unknown shape — treat as already entered.
  return true;
}

/**
 * @param {string | undefined} origin — no trailing slash
 * @param {string} contestId
 * @param {'success' | 'cancel'} kind
 */
export function buildStripeCheckoutReturnUrl(origin, contestId, kind) {
  const b = String(origin ?? '').replace(/\/$/, '');
  const checkout = kind === 'success' ? 'success' : 'cancel';
  const q = new URLSearchParams({
    contestId,
    checkout,
  });
  return `${b}/bio-ball/mlb?${q.toString()}`;
}

/**
 * @type {import('express').RequestHandler}
 */
export async function postContestCheckoutSession(req, res) {
  const startMs = Date.now();
  const requestId = req.requestId ?? 'unknown';
  const uid = req.user?.uid;
  if (!uid) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 401,
      outcome: 'unauthenticated',
      latencyMs: Date.now() - startMs,
    });
    return res.status(401).json({
      error: { code: 'unauthenticated', message: 'Authentication required.' },
    });
  }

  const rl = await req.consumeContestJoinRateLimit?.();
  if (rl && rl.allowed === false) {
    const retry = rl.retryAfterSec ?? null;
    if (retry != null) {
      res.setHeader('Retry-After', String(retry));
    }
    logContestCheckoutLine({
      requestId,
      httpStatus: 429,
      outcome: 'rate_limited',
      latencyMs: Date.now() - startMs,
    });
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many checkout session requests.',
        ...(retry != null ? { retryAfterSec: retry } : {}),
      },
    });
  }

  if (!isContestsPaymentsEnabled()) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 503,
      outcome: 'payments_disabled',
      latencyMs: Date.now() - startMs,
    });
    return res.status(503).json({
      error: {
        code: 'contest_payments_disabled',
        message: 'Contest entry payments are not enabled on this server.',
      },
    });
  }

  /** @type {import('stripe').default | null} */
  let stripe;
  try {
    stripe = getStripeClient();
  } catch (e) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 503,
      outcome: 'stripe_key_missing',
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return sendStripeServiceUnavailable(res);
  }
  if (!stripe) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 503,
      outcome: 'stripe_unavailable',
      latencyMs: Date.now() - startMs,
    });
    return sendStripeServiceUnavailable(res);
  }

  let contestIdRaw = req.params.contestId;
  if (typeof contestIdRaw !== 'string') {
    contestIdRaw = String(contestIdRaw ?? '');
  }
  contestIdRaw = decodeURIComponent(contestIdRaw.trim());
  const parsedId = contestIdParamSchema.safeParse(contestIdRaw);
  if (!parsedId.success) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 400,
      outcome: 'invalid_contest_id',
      latencyMs: Date.now() - startMs,
    });
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid contest id.',
      },
    });
  }
  const contestId = parsedId.data;

  const bodyParse = checkoutBodySchema.safeParse(req.body ?? {});
  if (!bodyParse.success) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 400,
      outcome: 'validation_error',
      latencyMs: Date.now() - startMs,
    });
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request body.',
        details: bodyParse.error.flatten(),
      },
    });
  }
  const { clientRequestId } = bodyParse.data;

  const appOrigin = process.env.CONTESTS_CHECKOUT_APP_ORIGIN?.trim();
  if (!appOrigin) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 503,
      outcome: 'checkout_origin_missing',
      latencyMs: Date.now() - startMs,
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message:
          'Set CONTESTS_CHECKOUT_APP_ORIGIN to the public web app base URL (e.g. http://localhost:4300).',
      },
    });
  }
  const originBase = appOrigin.replace(/\/$/, '');

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 503,
      outcome: 'firestore_init_failed',
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server is not configured for contests.',
      },
    });
  }

  const contestRef = db.doc(`contests/${contestId}`);
  let contestSnap;
  try {
    contestSnap = await contestRef.get();
  } catch (e) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 500,
      outcome: 'contest_read_failed',
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not load contest.' },
    });
  }

  if (!contestSnap.exists) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 404,
      outcome: 'contest_not_found',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(404).json({
      error: { code: 'contest_not_found', message: 'Contest not found.' },
    });
  }

  const contest = contestSnap.data();
  if (!isRecord(contest)) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 500,
      outcome: 'contest_invalid_shape',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Contest data is invalid.' },
    });
  }

  const status = contest.status;
  if (status !== 'open') {
    logContestCheckoutLine({
      requestId,
      httpStatus: 400,
      outcome: 'contest_not_open',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(400).json({
      error: {
        code: 'contest_not_open',
        message: 'Contest is not open for entry.',
      },
    });
  }

  if (contest.gameMode !== BIO_BALL) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 400,
      outcome: 'wrong_game_mode',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(400).json({
      error: {
        code: 'wrong_game_mode',
        message: 'This contest is not available for the current game mode.',
      },
    });
  }

  const entryFeeCents = getEntryFeeCentsFromContest(contest);
  if (entryFeeCents <= 0) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 400,
      outcome: 'no_entry_fee',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(400).json({
      error: {
        code: 'contest_no_entry_fee',
        message:
          'This contest has no entry fee. Use POST /api/v1/contests/:contestId/join instead.',
      },
    });
  }

  const ws = contest.windowStart;
  const we = contest.windowEnd;
  const now = Timestamp.now();
  if (
    !(ws instanceof Timestamp) ||
    !(we instanceof Timestamp) ||
    now.toMillis() < ws.toMillis() ||
    now.toMillis() >= we.toMillis()
  ) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 400,
      outcome: 'join_window_closed',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(400).json({
      error: {
        code: 'join_window_closed',
        message: 'Contest entry window is not active.',
      },
    });
  }

  const rulesVersion = contest.rulesVersion;
  const rulesAcceptedStr =
    rulesVersion !== undefined && rulesVersion !== null
      ? String(rulesVersion)
      : '1';

  const entryRef = db.doc(`contests/${contestId}/entries/${uid}`);
  let existingSnap;
  try {
    existingSnap = await entryRef.get();
  } catch (e) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 500,
      outcome: 'entry_read_failed',
      latencyMs: Date.now() - startMs,
      contestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not check entry.' },
    });
  }

  if (existingSnap.exists) {
    const existing = existingSnap.data();
    const ex = isRecord(existing) ? existing : undefined;
    if (ex && entryDataBlocksNewPaidCheckout(ex)) {
      logContestCheckoutLine({
        requestId,
        httpStatus: 409,
        outcome: 'already_entered',
        latencyMs: Date.now() - startMs,
        contestId,
      });
      return res.status(409).json({
        error: {
          code: 'already_entered',
          message:
            'You already have an entry for this contest (or checkout is already in progress).',
        },
      });
    }
  }

  const gameMode = typeof contest.gameMode === 'string' ? contest.gameMode : '';
  let blockingContestId;
  try {
    blockingContestId = await findBlockingOpenContestSameGameMode(
      db,
      uid,
      contestId,
      gameMode,
    );
  } catch (e) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 500,
      outcome: 'blocking_query_failed',
      latencyMs: Date.now() - startMs,
      contestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Could not verify existing contest entries.',
      },
    });
  }

  if (blockingContestId) {
    logContestCheckoutLine({
      requestId,
      httpStatus: 409,
      outcome: 'already_in_open_contest',
      latencyMs: Date.now() - startMs,
      contestId,
      existingContestId: blockingContestId,
    });
    return res.status(409).json({
      error: {
        code: 'already_in_open_contest',
        message:
          'You are already entered in another open contest for this game type. You can only be in one open contest at a time per game type.',
        existingContestId: blockingContestId,
      },
    });
  }

  const title =
    typeof contest.title === 'string' && contest.title.trim()
      ? contest.title.trim()
      : 'Contest entry';

  const successUrl = buildStripeCheckoutReturnUrl(
    originBase,
    contestId,
    'success',
  );
  const cancelUrl = buildStripeCheckoutReturnUrl(
    originBase,
    contestId,
    'cancel',
  );

  const metadata = {
    contestId,
    uid,
    rulesAcceptedVersion: rulesAcceptedStr,
    ...(clientRequestId ? { clientRequestId } : {}),
    entryFeeCents: String(entryFeeCents),
  };

  try {
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: `${contestId}:${uid}`.slice(0, 200),
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: entryFeeCents,
            product_data: {
              name: title,
            },
          },
        },
      ],
      success_url: successUrl,
      cancel_url: cancelUrl,
      metadata,
      payment_intent_data: {
        metadata,
      },
    });

    const url = session.url;
    if (!url) {
      logContestCheckoutLine({
        requestId,
        httpStatus: 500,
        outcome: 'stripe_missing_url',
        latencyMs: Date.now() - startMs,
        contestId,
      });
      return res.status(500).json({
        error: {
          code: 'internal_error',
          message: 'Checkout session did not return a URL.',
        },
      });
    }

    logContestCheckoutLine({
      requestId,
      httpStatus: 200,
      outcome: 'ok',
      latencyMs: Date.now() - startMs,
      contestId,
    });

    return res.status(200).json({
      schemaVersion: 1,
      url,
      sessionId: session.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logContestCheckoutLine({
      requestId,
      httpStatus: 502,
      outcome: 'stripe_checkout_failed',
      latencyMs: Date.now() - startMs,
      contestId,
      message: msg,
    });
    return res.status(502).json({
      error: {
        code: 'stripe_checkout_failed',
        message: 'Could not create Stripe Checkout session.',
      },
    });
  }
}
