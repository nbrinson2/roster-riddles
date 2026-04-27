/**
 * POST /api/internal/v1/contests/:contestId/payouts/execute — Phase 6 Story P6-D2.
 * Operator / cron: Stripe Transfers to winners + `payouts/final` + `ledgerEntries`.
 * @see docs/weekly-contests/weekly-contests-ops-p6-payout-execute.md
 */
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { z } from 'zod';
import { getPayoutExecuteSecret } from '../lib/contest-internal-auth.js';
import { getAdminFirestore } from '../lib/admin-firestore.js';
import { assertValidContestLedgerEntryPayload } from '../payments/contest-ledger-entry-validate.js';
import {
  getStripeClient,
  isContestsPaymentsEnabled,
  sendStripeServiceUnavailable,
} from '../payments/stripe-server.js';
import { buildPayoutLinesFromFinal } from './contest-payout-compute.js';
import {
  entryEligibleForAutomatedPrizePayout,
  stripePayoutTransferIdempotencyKey,
  userConnectReadyForPayoutTransfer,
} from './contest-payout-execute.helpers.js';
import { isContestStatus } from './contest-transitions.js';

const LEDGER_SCHEMA_VERSION = 1;
const PAYOUT_FINAL_SCHEMA_VERSION = 1;

const contestIdParamSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const bodySchema = z
  .object({
    payoutJobId: z.string().min(8).max(200).optional(),
  })
  .strict();

/**
 * @param {unknown} c
 * @returns {c is Record<string, unknown>}
 */
function isRecord(c) {
  return c != null && typeof c === 'object' && !Array.isArray(c);
}

/**
 * @param {import('express').Request} req
 */
function extractPayoutExecuteCredential(req) {
  const h = req.headers.authorization;
  if (typeof h === 'string' && h.startsWith('Bearer ')) {
    return h.slice('Bearer '.length).trim();
  }
  const x =
    (typeof req.headers['x-payout-operator-secret'] === 'string'
      ? req.headers['x-payout-operator-secret']
      : '') ||
    (typeof req.headers['x-contests-operator-secret'] === 'string'
      ? req.headers['x-contests-operator-secret']
      : '');
  return typeof x === 'string' ? x.trim() : '';
}

/**
 * @param {Record<string, unknown>} payload
 */
function logContestPayoutExecuteLine(payload) {
  const httpStatus = /** @type {number | undefined} */ (payload.httpStatus);
  const severity =
    httpStatus != null && httpStatus >= 500
      ? 'ERROR'
      : httpStatus != null && httpStatus >= 400
        ? 'WARNING'
        : 'INFO';
  const line = {
    component: 'contest_payout_execute',
    severity,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const sink = severity === 'ERROR' ? console.error : console.log;
  sink(JSON.stringify(line));
}

/**
 * @param {{ rank: number; uid: string; amountCents: number; status: string }[]} lines
 */
function computeAggregateStatus(lines) {
  const money = lines.filter((l) => l.amountCents > 0);
  if (money.length === 0) {
    return 'succeeded';
  }
  const ok = money.filter((l) => l.status === 'succeeded').length;
  const failed = money.filter((l) => l.status === 'failed').length;
  const skipped = money.filter((l) => l.status === 'skipped').length;
  if (ok === money.length) {
    return 'succeeded';
  }
  if (ok === 0) {
    return 'failed';
  }
  if (failed > 0 || skipped > 0) {
    return 'partial_failure';
  }
  return 'partial_failure';
}

/**
 * @type {import('express').RequestHandler}
 */
export async function postContestPayoutExecute(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();

  const secret = getPayoutExecuteSecret();
  if (!secret) {
    logContestPayoutExecuteLine({
      requestId,
      outcome: 'not_configured',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message:
          'Prize payout execute is disabled until PAYOUT_OPERATOR_SECRET or CONTESTS_OPERATOR_SECRET is set.',
      },
    });
  }

  const provided = extractPayoutExecuteCredential(req);
  if (provided !== secret) {
    logContestPayoutExecuteLine({
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
    logContestPayoutExecuteLine({
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
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'validation_error',
      httpStatus: 400,
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

  if (!isContestsPaymentsEnabled()) {
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'payments_disabled',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
    });
    return res.status(503).json({
      error: {
        code: 'contest_payments_disabled',
        message: 'CONTESTS_PAYMENTS_ENABLED is not true.',
      },
    });
  }

  /** @type {import('stripe').default | null} */
  let stripe;
  try {
    stripe = getStripeClient();
  } catch (e) {
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'stripe_key_error',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return sendStripeServiceUnavailable(res);
  }
  if (!stripe) {
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'stripe_unavailable',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
    });
    return sendStripeServiceUnavailable(res);
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'firestore_init_failed',
      httpStatus: 503,
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

  const contestRef = db.doc(`contests/${contestId}`);
  const resultsRef = db.doc(`contests/${contestId}/results/final`);
  const dryRunRef = db.doc(`contests/${contestId}/payouts/dryRun`);
  const finalRef = db.doc(`contests/${contestId}/payouts/final`);

  let contestSnap;
  let resultsSnap;
  let dryRunSnap;
  let finalSnap;
  try {
    [contestSnap, resultsSnap, dryRunSnap, finalSnap] = await Promise.all([
      contestRef.get(),
      resultsRef.get(),
      dryRunRef.get(),
      finalRef.get(),
    ]);
  } catch (e) {
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'firestore_read_failed',
      httpStatus: 500,
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not load contest data.' },
    });
  }

  if (!contestSnap.exists) {
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'contest_not_found',
      httpStatus: 404,
      latencyMs: Date.now() - startMs,
    });
    return res.status(404).json({
      error: { code: 'contest_not_found', message: 'Contest not found.' },
    });
  }

  const contest = contestSnap.data();
  if (!isRecord(contest)) {
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Invalid contest document.' },
    });
  }

  const status = contest.status;
  if (!isContestStatus(status) || status !== 'paid') {
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'contest_not_paid',
      httpStatus: 409,
      latencyMs: Date.now() - startMs,
      contestStatus: status,
    });
    return res.status(409).json({
      error: {
        code: 'contest_not_paid',
        message: 'Contest must be in paid status with scored results before prize execute.',
      },
    });
  }

  if (finalSnap.exists) {
    const prev = finalSnap.data();
    const agg =
      prev && typeof prev === 'object'
        ? /** @type {Record<string, unknown>} */ (prev).aggregateStatus
        : undefined;
    if (agg === 'succeeded') {
      logContestPayoutExecuteLine({
        requestId,
        contestId,
        outcome: 'idempotent_final_exists',
        httpStatus: 200,
        latencyMs: Date.now() - startMs,
      });
      return res.status(200).json({
        schemaVersion: 1,
        outcome: 'payout_final_already_succeeded',
        contestId,
      });
    }
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'payout_final_exists_incomplete',
      httpStatus: 409,
      latencyMs: Date.now() - startMs,
      aggregateStatus: agg,
    });
    return res.status(409).json({
      error: {
        code: 'payout_final_exists_incomplete',
        message:
          'payouts/final already exists in a non-success state; resolve manually before re-running.',
      },
    });
  }

  if (!resultsSnap.exists) {
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'results_final_missing',
      httpStatus: 409,
      latencyMs: Date.now() - startMs,
    });
    return res.status(409).json({
      error: {
        code: 'results_final_missing',
        message: 'results/final is required before prize execute.',
      },
    });
  }

  if (!dryRunSnap.exists) {
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'dry_run_missing',
      httpStatus: 409,
      latencyMs: Date.now() - startMs,
    });
    return res.status(409).json({
      error: {
        code: 'payout_dry_run_missing',
        message: 'payouts/dryRun is required as the authoritative intended distribution.',
      },
    });
  }

  const resultsFinal = resultsSnap.data();
  const dryRun = dryRunSnap.data();
  if (!isRecord(resultsFinal) || !isRecord(dryRun)) {
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Invalid results or dry-run document.' },
    });
  }

  /** @type {{ rank: number; uid: string; amountCents: number }[]} */
  let baseLines;
  try {
    baseLines = buildPayoutLinesFromFinal(resultsFinal, dryRun, contest);
  } catch (e) {
    const code = e instanceof Error ? e.message : String(e);
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'payout_lines_build_failed',
      httpStatus: 422,
      latencyMs: Date.now() - startMs,
      message: code,
    });
    return res.status(422).json({
      error: {
        code: 'payout_lines_invalid',
        message: 'Could not build payout lines from frozen artifacts.',
        details: code,
      },
    });
  }

  const payoutJobId =
    bodyParse.data.payoutJobId?.trim() ||
    `payout_exec_${Date.now()}_${randomBytes(6).toString('hex')}`;

  const scoringJobIdRaw = resultsFinal.scoringJobId;
  const scoringJobId =
    typeof scoringJobIdRaw === 'string' && scoringJobIdRaw.trim() !== ''
      ? scoringJobIdRaw.trim()
      : payoutJobId;

  /** @type {import('firebase-admin/firestore').DocumentSnapshot[]} */
  const entrySnaps = await Promise.all(
    baseLines.map((l) =>
      db.doc(`contests/${contestId}/entries/${l.uid}`).get(),
    ),
  );
  /** @type {import('firebase-admin/firestore').DocumentSnapshot[]} */
  const userSnaps = await Promise.all(
    baseLines.map((l) => db.doc(`users/${l.uid}`).get()),
  );

  /** @type {import('stripe').Stripe.Transfer[]} */
  const transfersCreated = [];

  /** @type {{ rank: number; uid: string; amountCents: number; status: string; stripeTransferId?: string | null; failureCode?: string | null; lastStripeEventId?: string | null }[]} */
  const executionLines = [];

  for (let i = 0; i < baseLines.length; i++) {
    const line = baseLines[i];
    const entrySnap = entrySnaps[i];
    const userSnap = userSnaps[i];
    const lineStart = Date.now();

    if (line.amountCents <= 0) {
      executionLines.push({
        rank: line.rank,
        uid: line.uid,
        amountCents: 0,
        status: 'skipped',
        stripeTransferId: null,
        failureCode: null,
        lastStripeEventId: null,
      });
      continue;
    }

    if (!entryEligibleForAutomatedPrizePayout(entrySnap)) {
      executionLines.push({
        rank: line.rank,
        uid: line.uid,
        amountCents: line.amountCents,
        status: 'skipped',
        stripeTransferId: null,
        failureCode: 'entry_not_eligible_for_payout',
        lastStripeEventId: null,
      });
      logContestPayoutExecuteLine({
        requestId,
        contestId,
        uid: line.uid,
        rank: line.rank,
        amountCents: line.amountCents,
        outcome: 'line_skipped_ineligible_entry',
        latencyMs: Date.now() - lineStart,
      });
      continue;
    }

    if (!userConnectReadyForPayoutTransfer(userSnap)) {
      executionLines.push({
        rank: line.rank,
        uid: line.uid,
        amountCents: line.amountCents,
        status: 'skipped',
        stripeTransferId: null,
        failureCode: 'connect_not_ready_for_transfer',
        lastStripeEventId: null,
      });
      logContestPayoutExecuteLine({
        requestId,
        contestId,
        uid: line.uid,
        rank: line.rank,
        amountCents: line.amountCents,
        outcome: 'line_skipped_connect_not_ready',
        latencyMs: Date.now() - lineStart,
      });
      continue;
    }

    const userData = userSnap.data();
    const destination =
      userData && typeof userData === 'object'
        ? String(
            /** @type {Record<string, unknown>} */ (userData).stripeConnectAccountId ??
              '',
          ).trim()
        : '';

    try {
      const idempotencyKey = stripePayoutTransferIdempotencyKey(
        contestId,
        line.uid,
        line.rank,
      );
      const transfer = await stripe.transfers.create(
        {
          amount: line.amountCents,
          currency: 'usd',
          destination,
          metadata: {
            firebase_uid: line.uid,
            contest_id: contestId,
            rank: String(line.rank),
            payout_job_id: payoutJobId,
          },
        },
        { idempotencyKey },
      );
      transfersCreated.push(transfer);
      executionLines.push({
        rank: line.rank,
        uid: line.uid,
        amountCents: line.amountCents,
        status: 'succeeded',
        stripeTransferId: transfer.id,
        failureCode: null,
        lastStripeEventId: null,
      });
      logContestPayoutExecuteLine({
        requestId,
        contestId,
        uid: line.uid,
        rank: line.rank,
        amountCents: line.amountCents,
        outcome: 'transfer_succeeded',
        stripeTransferId: transfer.id,
        latencyMs: Date.now() - lineStart,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      const stripeCode =
        e instanceof Stripe.errors.StripeError ? e.code ?? e.type : undefined;
      executionLines.push({
        rank: line.rank,
        uid: line.uid,
        amountCents: line.amountCents,
        status: 'failed',
        stripeTransferId: null,
        failureCode: stripeCode != null ? String(stripeCode) : 'stripe_transfer_failed',
        lastStripeEventId: null,
      });
      logContestPayoutExecuteLine({
        requestId,
        contestId,
        uid: line.uid,
        rank: line.rank,
        amountCents: line.amountCents,
        outcome: 'transfer_failed',
        stripeErrorCode: stripeCode,
        message: msg,
        latencyMs: Date.now() - lineStart,
      });
    }
  }

  const aggregateStatus = computeAggregateStatus(executionLines);

  const lockedAt = FieldValue.serverTimestamp();
  /** @type {Record<string, unknown>} */
  const finalDoc = {
    schemaVersion: PAYOUT_FINAL_SCHEMA_VERSION,
    contestId,
    currency: 'USD',
    notRealMoney: false,
    lines: executionLines,
    scoringJobId,
    payoutJobId,
    lockedAt,
    aggregateStatus,
    supersedesRunDocumentId: null,
  };

  /** @type {{ id: string; data: Record<string, unknown> }[]} */
  const ledgerWrites = [];
  for (const row of executionLines) {
    if (row.status !== 'succeeded' || !row.stripeTransferId) {
      continue;
    }
    const tid = row.stripeTransferId;
    /** @type {Record<string, unknown>} */
    const ledgerPayload = {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      uid: row.uid,
      contestId,
      entryPathHint: `contests/${contestId}/entries/${row.uid}`,
      lineType: 'prize_transfer_out',
      direction: 'debit',
      amountCents: row.amountCents,
      currency: 'usd',
      stripeEventId: null,
      stripeObjectType: 'transfer',
      stripeObjectId: tid,
      source: 'system',
      createdAt: lockedAt,
      metadata: {
        contestId,
        rank: row.rank,
        payoutJobId,
      },
    };
    assertValidContestLedgerEntryPayload(ledgerPayload);
    ledgerWrites.push({ id: tid, data: ledgerPayload });
  }

  try {
    const batch = db.batch();
    batch.set(finalRef, finalDoc);
    for (const lw of ledgerWrites) {
      batch.set(db.doc(`ledgerEntries/${lw.id}`), lw.data);
    }
    await batch.commit();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logContestPayoutExecuteLine({
      requestId,
      contestId,
      outcome: 'firestore_batch_failed_after_transfers',
      httpStatus: 500,
      latencyMs: Date.now() - startMs,
      message: msg,
      transfersWritten: transfersCreated.length,
    });
    return res.status(500).json({
      error: {
        code: 'payout_persist_failed',
        message:
          'Stripe transfers may have succeeded but Firestore commit failed — reconcile transfers vs ledger.',
        details: msg,
      },
    });
  }

  logContestPayoutExecuteLine({
    requestId,
    contestId,
    outcome: 'payout_execute_committed',
    httpStatus: 200,
    latencyMs: Date.now() - startMs,
    aggregateStatus,
    payoutJobId,
    transferCount: transfersCreated.length,
  });

  return res.status(200).json({
    schemaVersion: 1,
    contestId,
    payoutJobId,
    aggregateStatus,
    lines: executionLines,
  });
}
