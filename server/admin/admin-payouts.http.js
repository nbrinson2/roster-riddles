/**
 * Phase 6 Story P6-G1 — Admin read APIs: payout status per contest / per user (masked Connect ids).
 * Phase 6 Story P6-G2 — Admin hold / resume / retry failed payout lines (+ ledger audit).
 * @see docs/admin/admin-dashboard-security.md
 */
import { z } from 'zod';
import {
  runContestPayoutHoldAuthorized,
  runContestPayoutResumeAuthorized,
  runContestPayoutRetryFailedLinesAuthorized,
} from '../contests/contest-payout-admin-actions.job.js';
import { getAdminFirestore } from '../lib/admin-firestore.js';
import {
  getStripeClient,
  isContestsPaymentsEnabled,
  sendStripeServiceUnavailable,
} from '../payments/stripe-server.js';
import { logContestReadLine } from '../contests/contest-read-log.js';

const contestIdParamSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const targetUidParamSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const LEDGER_LINES_FOR_USER = 80;

const adminPayoutHoldBodySchema = z
  .object({
    force: z.literal(true),
    reason: z.string().min(4).max(500),
  })
  .strict();

const adminPayoutResumeBodySchema = z
  .object({
    force: z.literal(true),
    reason: z.string().max(500).optional(),
  })
  .strict();

const adminPayoutRetryBodySchema = z
  .object({
    force: z.literal(true),
    reason: z.string().min(4).max(500),
    rank: z.number().int().positive().optional(),
    uid: z
      .string()
      .min(1)
      .max(128)
      .regex(/^[a-zA-Z0-9_-]+$/)
      .optional(),
  })
  .strict();

/**
 * @param {import('express').Request} req
 * @returns {string | null}
 */
function parseAdminContestIdParam(req) {
  let raw = req.params.contestId;
  if (typeof raw !== 'string') {
    raw = String(raw ?? '');
  }
  raw = decodeURIComponent(raw.trim());
  const parsed = contestIdParamSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

/**
 * Stripe-style ids (`acct_…`, `tr_…`, `ch_…`, `pi_…`) — show prefix + last 4 for admin support.
 * @param {string | null | undefined} id
 * @returns {string | null}
 */
export function maskStripeResourceId(id) {
  if (id == null || typeof id !== 'string') return null;
  const t = id.trim();
  if (t.length < 8) return t.length ? '…' : null;
  const u = t.indexOf('_');
  if (u < 1 || u >= t.length - 5) {
    return `…${t.slice(-4)}`;
  }
  return `${t.slice(0, u + 1)}…${t.slice(-4)}`;
}

/**
 * @param {unknown} v
 * @returns {string | null}
 */
function timestampToIso(v) {
  if (v == null) return null;
  if (
    typeof v === 'object' &&
    v !== null &&
    'toDate' in v &&
    typeof v.toDate === 'function'
  ) {
    try {
      return v.toDate().toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<boolean>} true if allowed to proceed
 */
async function consumeContestReadRateLimit(req, res) {
  const rl = await req.consumeContestReadRateLimit?.();
  if (rl && rl.allowed === false) {
    const retry = rl.retryAfterSec ?? null;
    if (retry != null) {
      res.setHeader('Retry-After', String(retry));
    }
    res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many requests.',
        ...(retry != null ? { retryAfterSec: retry } : {}),
      },
    });
    return false;
  }
  return true;
}

/**
 * @param {Record<string, unknown>} userData
 */
function pickConnectSummaryForAdmin(userData) {
  const acct = userData.stripeConnectAccountId;
  return {
    stripeConnectAccountIdMasked: maskStripeResourceId(
      typeof acct === 'string' ? acct : null,
    ),
    stripeConnectAccountType:
      typeof userData.stripeConnectAccountType === 'string'
        ? userData.stripeConnectAccountType
        : null,
    stripeConnectChargesEnabled:
      typeof userData.stripeConnectChargesEnabled === 'boolean'
        ? userData.stripeConnectChargesEnabled
        : null,
    stripeConnectPayoutsEnabled:
      typeof userData.stripeConnectPayoutsEnabled === 'boolean'
        ? userData.stripeConnectPayoutsEnabled
        : null,
    stripeConnectDetailsSubmitted:
      typeof userData.stripeConnectDetailsSubmitted === 'boolean'
        ? userData.stripeConnectDetailsSubmitted
        : null,
    stripeConnectRequirementsCurrentlyDueCount:
      typeof userData.stripeConnectRequirementsCurrentlyDueCount === 'number'
        ? userData.stripeConnectRequirementsCurrentlyDueCount
        : null,
    stripePayoutLastWebhookType:
      typeof userData.stripePayoutLastWebhookType === 'string'
        ? userData.stripePayoutLastWebhookType
        : null,
    stripePayoutLastFailurePublicCode:
      typeof userData.stripePayoutLastFailurePublicCode === 'string'
        ? userData.stripePayoutLastFailurePublicCode
        : null,
  };
}

/**
 * @param {Record<string, unknown> | undefined} line
 * @param {boolean} realMoney
 */
export function prizePaidFromExecutionLine(line, realMoney) {
  if (!line || typeof line !== 'object') {
    return {
      paid: false,
      code: 'no_line',
      detail: 'User has no row on payouts/final.lines.',
    };
  }
  const status = typeof line.status === 'string' ? line.status : '';
  const amount =
    typeof line.amountCents === 'number' && Number.isFinite(line.amountCents)
      ? line.amountCents
      : 0;
  const tr =
    typeof line.stripeTransferId === 'string' ? line.stripeTransferId : null;

  if (amount <= 0) {
    return {
      paid: false,
      code: 'zero_or_missing_amount',
      detail: 'Dry-run line has no prize cents for this uid.',
    };
  }
  if (status === 'skipped') {
    return {
      paid: false,
      code: 'skipped',
      detail: 'Payout line was skipped (ineligibility / policy).',
    };
  }
  if (status === 'succeeded') {
    if (realMoney && !tr) {
      return {
        paid: false,
        code: 'succeeded_missing_transfer_id',
        detail: 'Real-money final line succeeded but has no tr_ id (data issue).',
      };
    }
    return {
      paid: true,
      code: 'succeeded',
      detail: realMoney
        ? 'Stripe Transfer succeeded (tr_ present).'
        : 'Staging / notRealMoney: line marked succeeded.',
    };
  }
  if (status === 'failed') {
    return {
      paid: false,
      code: 'failed',
      detail: 'Transfer or execution failed for this line.',
    };
  }
  return {
    paid: false,
    code: 'not_terminal_success',
    detail: `Line status is "${status || 'unknown'}" (not a succeeded payout yet).`,
  };
}

/**
 * @param {unknown} line
 */
function maskFinalLine(line) {
  if (!line || typeof line !== 'object') return null;
  const o = /** @type {Record<string, unknown>} */ (line);
  return {
    rank: typeof o.rank === 'number' ? o.rank : null,
    uid: typeof o.uid === 'string' ? o.uid : null,
    amountCents:
      typeof o.amountCents === 'number' ? o.amountCents : null,
    status: typeof o.status === 'string' ? o.status : null,
    stripeTransferIdMasked: maskStripeResourceId(
      typeof o.stripeTransferId === 'string' ? o.stripeTransferId : null,
    ),
    failureCode: typeof o.failureCode === 'string' ? o.failureCode : null,
    failurePublicCode:
      typeof o.failurePublicCode === 'string' ? o.failurePublicCode : null,
  };
}

/**
 * GET /api/v1/admin/contests/:contestId/payout-status
 * @type {import('express').RequestHandler}
 */
export async function getAdminContestPayoutStatus(req, res) {
  const startMs = Date.now();
  const requestId = req.requestId ?? 'unknown';
  const adminUid = req.user?.uid ?? null;

  if (!(await consumeContestReadRateLimit(req, res))) return;

  const parsed = contestIdParamSchema.safeParse(req.params.contestId);
  if (!parsed.success) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid contestId.',
      },
    });
  }
  const contestId = parsed.data;

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logContestReadLine({
      requestId,
      outcome: 'server_misconfigured',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      route: 'admin_contest_payout_status',
      uid: adminUid,
      contestId,
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message:
          e instanceof Error ? e.message : 'Firestore is not configured.',
      },
    });
  }

  const contestRef = db.doc(`contests/${contestId}`);
  const dryRunRef = db.doc(`contests/${contestId}/payouts/dryRun`);
  const finalRef = db.doc(`contests/${contestId}/payouts/final`);

  let contestSnap;
  let dryRunSnap;
  let finalSnap;
  try {
    [contestSnap, dryRunSnap, finalSnap] = await Promise.all([
      contestRef.get(),
      dryRunRef.get(),
      finalRef.get(),
    ]);
  } catch (e) {
    logContestReadLine({
      requestId,
      outcome: 'firestore_error',
      httpStatus: 500,
      latencyMs: Date.now() - startMs,
      route: 'admin_contest_payout_status',
      uid: adminUid,
      contestId,
    });
    return res.status(500).json({
      error: {
        code: 'firestore_read_failed',
        message:
          e instanceof Error ? e.message.slice(0, 200) : 'Firestore error.',
      },
    });
  }

  if (!contestSnap.exists) {
    logContestReadLine({
      requestId,
      outcome: 'not_found',
      httpStatus: 404,
      latencyMs: Date.now() - startMs,
      route: 'admin_contest_payout_status',
      uid: adminUid,
      contestId,
    });
    return res.status(404).json({
      error: { code: 'contest_not_found', message: 'Contest does not exist.' },
    });
  }

  const cdata = contestSnap.data() ?? {};
  const prizePayoutStatus =
    typeof cdata.prizePayoutStatus === 'string'
      ? cdata.prizePayoutStatus
      : null;
  const contestStatus =
    typeof cdata.status === 'string' ? cdata.status : null;

  const dryRun = dryRunSnap.exists ? dryRunSnap.data() : null;
  const finalDoc = finalSnap.exists ? finalSnap.data() : null;

  /** @type {Record<string, unknown> | null} */
  const dryRunOut =
    dryRun && typeof dryRun === 'object'
      ? {
          exists: true,
          schemaVersion:
            typeof dryRun.schemaVersion === 'number'
              ? dryRun.schemaVersion
              : null,
          notRealMoney:
            typeof dryRun.notRealMoney === 'boolean'
              ? dryRun.notRealMoney
              : null,
          currency:
            typeof dryRun.currency === 'string' ? dryRun.currency : null,
          lines: Array.isArray(dryRun.lines)
            ? dryRun.lines.map((row) => {
                if (!row || typeof row !== 'object') return null;
                const r = /** @type {Record<string, unknown>} */ (row);
                return {
                  rank: typeof r.rank === 'number' ? r.rank : null,
                  uid: typeof r.uid === 'string' ? r.uid : null,
                  amountCents:
                    typeof r.amountCents === 'number' ? r.amountCents : null,
                };
              })
            : [],
        }
      : { exists: false };

  /** @type {Record<string, unknown> | null} */
  let finalOut = null;
  if (finalDoc && typeof finalDoc === 'object') {
    const fd = /** @type {Record<string, unknown>} */ (finalDoc);
    const lines = Array.isArray(fd.lines) ? fd.lines : [];
    finalOut = {
      exists: true,
      schemaVersion:
        typeof fd.schemaVersion === 'number' ? fd.schemaVersion : null,
      contestId:
        typeof fd.contestId === 'string' ? fd.contestId : contestId,
      currency: typeof fd.currency === 'string' ? fd.currency : null,
      notRealMoney:
        typeof fd.notRealMoney === 'boolean' ? fd.notRealMoney : null,
      scoringJobId:
        typeof fd.scoringJobId === 'string' ? fd.scoringJobId : null,
      payoutJobId:
        typeof fd.payoutJobId === 'string' ? fd.payoutJobId : null,
      lockedAt: timestampToIso(fd.lockedAt),
      aggregateStatus:
        typeof fd.aggregateStatus === 'string' ? fd.aggregateStatus : null,
      lines: lines.map((ln) => maskFinalLine(ln)),
    };
  } else {
    finalOut = { exists: false };
  }

  logContestReadLine({
    requestId,
    outcome: 'ok',
    httpStatus: 200,
    latencyMs: Date.now() - startMs,
    route: 'admin_contest_payout_status',
    uid: adminUid,
    contestId,
  });

  return res.status(200).json({
    schemaVersion: 1,
    contestId,
    contestStatus,
    prizePayoutStatus,
    dryRun: dryRunOut,
    final: finalOut,
  });
}

/**
 * GET /api/v1/admin/contests/:contestId/users/:targetUid/payout-status
 * @type {import('express').RequestHandler}
 */
export async function getAdminContestUserPayoutStatus(req, res) {
  const startMs = Date.now();
  const requestId = req.requestId ?? 'unknown';
  const adminUid = req.user?.uid ?? null;

  if (!(await consumeContestReadRateLimit(req, res))) return;

  const cidParse = contestIdParamSchema.safeParse(req.params.contestId);
  const uidParse = targetUidParamSchema.safeParse(req.params.targetUid);
  if (!cidParse.success || !uidParse.success) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid contestId or targetUid.',
      },
    });
  }
  const contestId = cidParse.data;
  const targetUid = uidParse.data;

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logContestReadLine({
      requestId,
      outcome: 'server_misconfigured',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      route: 'admin_contest_user_payout_status',
      uid: adminUid,
      contestId,
      targetUid,
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message:
          e instanceof Error ? e.message : 'Firestore is not configured.',
      },
    });
  }

  const contestRef = db.doc(`contests/${contestId}`);
  const entryRef = db.doc(`contests/${contestId}/entries/${targetUid}`);
  const dryRunRef = db.doc(`contests/${contestId}/payouts/dryRun`);
  const finalRef = db.doc(`contests/${contestId}/payouts/final`);
  const userRef = db.doc(`users/${targetUid}`);

  let contestSnap;
  let entrySnap;
  let dryRunSnap;
  let finalSnap;
  let userSnap;
  try {
    [contestSnap, entrySnap, dryRunSnap, finalSnap, userSnap] =
      await Promise.all([
        contestRef.get(),
        entryRef.get(),
        dryRunRef.get(),
        finalRef.get(),
        userRef.get(),
      ]);
  } catch (e) {
    logContestReadLine({
      requestId,
      outcome: 'firestore_error',
      httpStatus: 500,
      latencyMs: Date.now() - startMs,
      route: 'admin_contest_user_payout_status',
      uid: adminUid,
      contestId,
      targetUid,
    });
    return res.status(500).json({
      error: {
        code: 'firestore_read_failed',
        message:
          e instanceof Error ? e.message.slice(0, 200) : 'Firestore error.',
      },
    });
  }

  if (!contestSnap.exists) {
    logContestReadLine({
      requestId,
      outcome: 'not_found',
      httpStatus: 404,
      latencyMs: Date.now() - startMs,
      route: 'admin_contest_user_payout_status',
      uid: adminUid,
      contestId,
      targetUid,
    });
    return res.status(404).json({
      error: { code: 'contest_not_found', message: 'Contest does not exist.' },
    });
  }

  const cdata = contestSnap.data() ?? {};
  const contestStatus =
    typeof cdata.status === 'string' ? cdata.status : null;
  const prizePayoutStatus =
    typeof cdata.prizePayoutStatus === 'string'
      ? cdata.prizePayoutStatus
      : null;

  const entry = entrySnap.exists ? entrySnap.data() : null;
  const paymentStatus =
    entry && typeof entry === 'object' && typeof entry.paymentStatus === 'string'
      ? entry.paymentStatus
      : null;
  const entryFeePaidOrWaived =
    paymentStatus === 'paid' || paymentStatus === 'free';

  const dryRun = dryRunSnap.exists ? dryRunSnap.data() : null;
  let dryRunLine = null;
  if (dryRun && typeof dryRun === 'object' && Array.isArray(dryRun.lines)) {
    const hit = dryRun.lines.find(
      (row) =>
        row &&
        typeof row === 'object' &&
        /** @type {Record<string, unknown>} */ (row).uid === targetUid,
    );
    if (hit && typeof hit === 'object') {
      const r = /** @type {Record<string, unknown>} */ (hit);
      dryRunLine = {
        rank: typeof r.rank === 'number' ? r.rank : null,
        amountCents:
          typeof r.amountCents === 'number' ? r.amountCents : null,
      };
    }
  }

  const finalDoc = finalSnap.exists ? finalSnap.data() : null;
  /** @type {Record<string, unknown> | undefined} */
  let rawLine;
  if (finalDoc && typeof finalDoc === 'object') {
    const lines = Array.isArray(finalDoc.lines) ? finalDoc.lines : [];
    rawLine = lines.find(
      (row) =>
        row &&
        typeof row === 'object' &&
        /** @type {Record<string, unknown>} */ (row).uid === targetUid,
    );
  }

  const realMoney =
    !finalDoc ||
    typeof finalDoc !== 'object' ||
    /** @type {Record<string, unknown>} */ (finalDoc).notRealMoney !== true;

  const prizeEval = prizePaidFromExecutionLine(rawLine, realMoney);
  const prizeLineMasked = maskFinalLine(rawLine);

  /** @type {Record<string, unknown>[]} */
  let recentLedgerLines = [];
  try {
    const q = await db
      .collection('ledgerEntries')
      .where('uid', '==', targetUid)
      .orderBy('createdAt', 'desc')
      .limit(LEDGER_LINES_FOR_USER)
      .get();
    for (const doc of q.docs) {
      const d = doc.data();
      if (d.contestId !== contestId) continue;
      recentLedgerLines.push({
        ledgerEntryId: doc.id,
        lineType: typeof d.lineType === 'string' ? d.lineType : null,
        direction: typeof d.direction === 'string' ? d.direction : null,
        amountCents:
          typeof d.amountCents === 'number' ? d.amountCents : null,
        currency: typeof d.currency === 'string' ? d.currency : null,
        source: typeof d.source === 'string' ? d.source : null,
        createdAt: timestampToIso(d.createdAt),
        stripeEventId:
          typeof d.stripeEventId === 'string' ? d.stripeEventId : null,
        stripeObjectType:
          typeof d.stripeObjectType === 'string' ? d.stripeObjectType : null,
        stripeObjectIdMasked: maskStripeResourceId(
          typeof d.stripeObjectId === 'string' ? d.stripeObjectId : null,
        ),
      });
    }
  } catch {
    recentLedgerLines = [];
  }

  const userData =
    userSnap.exists && userSnap.data() && typeof userSnap.data() === 'object'
      ? /** @type {Record<string, unknown>} */ (userSnap.data())
      : {};

  const supportOneLiner = prizeEval.paid
    ? `Prize payout for this user: YES (${prizeEval.code}).`
    : `Prize payout for this user: NO (${prizeEval.code}). ${prizeEval.detail}`;

  logContestReadLine({
    requestId,
    outcome: 'ok',
    httpStatus: 200,
    latencyMs: Date.now() - startMs,
    route: 'admin_contest_user_payout_status',
    uid: adminUid,
    contestId,
    targetUid,
  });

  return res.status(200).json({
    schemaVersion: 1,
    contestId,
    targetUid,
    contestStatus,
    prizePayoutStatus,
    entry: entrySnap.exists
      ? {
          exists: true,
          paymentStatus,
          entryFeePaidOrWaived,
        }
      : { exists: false, paymentStatus: null, entryFeePaidOrWaived: null },
    dryRunLine,
    prize: {
      prizePaidOutViaStripeTransfer: prizeEval.paid,
      evaluationCode: prizeEval.code,
      evaluationDetail: prizeEval.detail,
      executionLine: prizeLineMasked,
      notRealMoney:
        finalDoc &&
        typeof finalDoc === 'object' &&
        /** @type {Record<string, unknown>} */ (finalDoc).notRealMoney === true,
    },
    connect: userSnap.exists ? pickConnectSummaryForAdmin(userData) : null,
    recentLedgerLinesForContest: recentLedgerLines,
    supportOneLiner,
  });
}

/**
 * POST /api/v1/admin/contests/:contestId/payout-hold — P6-G2
 * @type {import('express').RequestHandler}
 */
export async function postAdminContestPayoutHold(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();
  const actorUid = req.user?.uid ?? null;
  if (!actorUid) {
    return res.status(401).json({
      error: { code: 'unauthenticated', message: 'Authentication required.' },
    });
  }
  if (!(await consumeContestReadRateLimit(req, res))) return;

  const contestId = parseAdminContestIdParam(req);
  if (!contestId) {
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid contest id.' },
    });
  }

  const body = adminPayoutHoldBodySchema.safeParse(req.body ?? {});
  if (!body.success) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request body.',
        details: body.error.flatten(),
      },
    });
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message:
          e instanceof Error ? e.message : 'Firestore is not configured.',
      },
    });
  }

  const result = await runContestPayoutHoldAuthorized({
    db,
    contestId,
    requestId,
    actorUid,
    reason: body.data.reason,
    force: body.data.force,
  });

  logContestReadLine({
    requestId,
    outcome: result.httpStatus < 400 ? 'ok' : 'admin_payout_hold_failed',
    httpStatus: result.httpStatus,
    latencyMs: Date.now() - startMs,
    route: 'admin_payout_hold',
    uid: actorUid,
    contestId,
  });

  return res.status(result.httpStatus).json(result.json);
}

/**
 * POST /api/v1/admin/contests/:contestId/payout-resume — P6-G2
 * @type {import('express').RequestHandler}
 */
export async function postAdminContestPayoutResume(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();
  const actorUid = req.user?.uid ?? null;
  if (!actorUid) {
    return res.status(401).json({
      error: { code: 'unauthenticated', message: 'Authentication required.' },
    });
  }
  if (!(await consumeContestReadRateLimit(req, res))) return;

  const contestId = parseAdminContestIdParam(req);
  if (!contestId) {
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid contest id.' },
    });
  }

  const body = adminPayoutResumeBodySchema.safeParse(req.body ?? {});
  if (!body.success) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request body.',
        details: body.error.flatten(),
      },
    });
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message:
          e instanceof Error ? e.message : 'Firestore is not configured.',
      },
    });
  }

  const result = await runContestPayoutResumeAuthorized({
    db,
    contestId,
    requestId,
    actorUid,
    reason: body.data.reason,
    force: body.data.force,
  });

  logContestReadLine({
    requestId,
    outcome: result.httpStatus < 400 ? 'ok' : 'admin_payout_resume_failed',
    httpStatus: result.httpStatus,
    latencyMs: Date.now() - startMs,
    route: 'admin_payout_resume',
    uid: actorUid,
    contestId,
  });

  return res.status(result.httpStatus).json(result.json);
}

/**
 * POST /api/v1/admin/contests/:contestId/payout-retry-failed — P6-G2
 * @type {import('express').RequestHandler}
 */
export async function postAdminContestPayoutRetryFailed(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();
  const actorUid = req.user?.uid ?? null;
  if (!actorUid) {
    return res.status(401).json({
      error: { code: 'unauthenticated', message: 'Authentication required.' },
    });
  }
  if (!(await consumeContestReadRateLimit(req, res))) return;

  const contestId = parseAdminContestIdParam(req);
  if (!contestId) {
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid contest id.' },
    });
  }

  const body = adminPayoutRetryBodySchema.safeParse(req.body ?? {});
  if (!body.success) {
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request body.',
        details: body.error.flatten(),
      },
    });
  }

  if (!isContestsPaymentsEnabled()) {
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
  } catch {
    return sendStripeServiceUnavailable(res);
  }
  if (!stripe) {
    return sendStripeServiceUnavailable(res);
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message:
          e instanceof Error ? e.message : 'Firestore is not configured.',
      },
    });
  }

  const result = await runContestPayoutRetryFailedLinesAuthorized({
    db,
    stripe,
    contestId,
    requestId,
    actorUid,
    reason: body.data.reason,
    force: body.data.force,
    targetRank: body.data.rank,
    targetUid: body.data.uid,
    startMs,
  });

  logContestReadLine({
    requestId,
    outcome: result.httpStatus < 400 ? 'ok' : 'admin_payout_retry_failed',
    httpStatus: result.httpStatus,
    latencyMs: Date.now() - startMs,
    route: 'admin_payout_retry_failed',
    uid: actorUid,
    contestId,
  });

  return res.status(result.httpStatus).json(result.json);
}
