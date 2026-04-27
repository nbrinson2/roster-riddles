/**
 * Phase 6 Story P6-G2 — Admin hold / resume / retry failed prize payout lines.
 * Audit: append-only `ledgerEntries` with `lineType: other`, `amountCents: 0`, `source: admin_adjustment`.
 * @see docs/weekly-contests/weekly-contests-phase6-payouts-adr.md (`prizePayoutStatus`)
 */
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { assertValidContestLedgerEntryPayload } from '../payments/contest-ledger-entry-validate.js';
import {
  computeContestPayoutFinalAggregateStatus,
} from './contest-payout-execute.job.js';
import {
  entryEligibleForAutomatedPrizePayout,
  stripePayoutTransferIdempotencyKey,
  userConnectReadyForPayoutTransfer,
} from './contest-payout-execute.helpers.js';
import {
  computePlannedPrizeTransferTotalCents,
  extractUsdAvailableCentsFromBalance,
  isContestPayoutBalanceGuardEnabled,
} from './contest-payout-platform-balance.js';
import { isContestStatus } from './contest-transitions.js';
import { logPayoutAdminActionLine } from '../payments/contest-payouts-observability.js';

const LEDGER_SCHEMA_VERSION = 1;

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isRecord(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @param {string} contestId
 * @param {string} action
 */
function newAuditLedgerDocId(contestId, action) {
  const safe = contestId.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 40);
  return `admin_payout_${action}_${safe}_${randomBytes(8).toString('hex')}`;
}

/**
 * @param {object} p
 * @param {string} p.actorUid
 * @param {string} p.contestId
 * @param {string} p.action
 * @param {string} p.reason
 * @param {Record<string, unknown>} [p.extraMetadata]
 */
export function buildPayoutAdminAuditLedgerPayload({
  actorUid,
  contestId,
  action,
  reason,
  extraMetadata,
}) {
  /** @type {Record<string, unknown>} */
  const metadata = {
    action,
    reason,
    contestId,
    ...(extraMetadata && typeof extraMetadata === 'object' ? extraMetadata : {}),
  };
  /** @type {Record<string, unknown>} */
  const payload = {
    schemaVersion: LEDGER_SCHEMA_VERSION,
    uid: actorUid,
    contestId,
    lineType: 'other',
    direction: 'credit',
    amountCents: 0,
    currency: 'usd',
    stripeEventId: null,
    stripeObjectType: null,
    stripeObjectId: null,
    source: 'admin_adjustment',
    createdAt: FieldValue.serverTimestamp(),
    metadata,
  };
  assertValidContestLedgerEntryPayload(payload);
  return payload;
}

/**
 * @param {unknown} agg
 */
export function isPayoutFinalAggregateRetryEligible(agg) {
  return agg === 'partial_failure' || agg === 'failed';
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} contestId
 * @param {string} requestId
 * @param {string} actorUid
 * @param {string} reason
 * @param {boolean} force
 * @returns {Promise<{ httpStatus: number; json: Record<string, unknown> }>}
 */
export async function runContestPayoutHoldAuthorized({
  db,
  contestId,
  requestId,
  actorUid,
  reason,
  force,
}) {
  const startMs = Date.now();
  if (!force) {
    return {
      httpStatus: 400,
      json: {
        error: {
          code: 'force_required',
          message: 'Set force to true to confirm payout hold.',
        },
      },
    };
  }

  const contestRef = db.doc(`contests/${contestId}`);
  const contestSnap = await contestRef.get();
  if (!contestSnap.exists) {
    return {
      httpStatus: 404,
      json: { error: { code: 'contest_not_found', message: 'Contest not found.' } },
    };
  }
  const contest = contestSnap.data();
  if (!isRecord(contest) || !isContestStatus(contest.status) || contest.status !== 'paid') {
    return {
      httpStatus: 409,
      json: {
        error: {
          code: 'contest_not_paid',
          message: 'Hold applies only to contests in paid status.',
        },
      },
    };
  }

  if (contest.prizePayoutStatus === 'held') {
    logPayoutAdminActionLine({
      requestId,
      contestId,
      outcome: 'payout_hold_idempotent',
      actorUid,
      latencyMs: Date.now() - startMs,
    });
    return {
      httpStatus: 200,
      json: {
        schemaVersion: 1,
        contestId,
        prizePayoutStatus: 'held',
        idempotent: true,
      },
    };
  }

  const auditId = newAuditLedgerDocId(contestId, 'hold');
  const ledgerPayload = buildPayoutAdminAuditLedgerPayload({
    actorUid,
    contestId,
    action: 'payout_hold',
    reason,
  });

  const batch = db.batch();
  batch.update(contestRef, {
    prizePayoutStatus: 'held',
    payoutHoldReason: reason.slice(0, 500),
    heldByAdminUid: actorUid,
    heldAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`ledgerEntries/${auditId}`), ledgerPayload);
  await batch.commit();

  logPayoutAdminActionLine({
    requestId,
    contestId,
    outcome: 'payout_hold_ok',
    actorUid,
    latencyMs: Date.now() - startMs,
  });

  return {
    httpStatus: 200,
    json: {
      schemaVersion: 1,
      contestId,
      prizePayoutStatus: 'held',
      ledgerEntryId: auditId,
    },
  };
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} contestId
 * @param {string} requestId
 * @param {string} actorUid
 * @param {string} [reason]
 * @param {boolean} force
 */
export async function runContestPayoutResumeAuthorized({
  db,
  contestId,
  requestId,
  actorUid,
  reason,
  force,
}) {
  const startMs = Date.now();
  if (!force) {
    return {
      httpStatus: 400,
      json: {
        error: {
          code: 'force_required',
          message: 'Set force to true to confirm payout resume.',
        },
      },
    };
  }

  const contestRef = db.doc(`contests/${contestId}`);
  const contestSnap = await contestRef.get();
  if (!contestSnap.exists) {
    return {
      httpStatus: 404,
      json: { error: { code: 'contest_not_found', message: 'Contest not found.' } },
    };
  }
  const contest = contestSnap.data();
  if (!isRecord(contest) || !isContestStatus(contest.status) || contest.status !== 'paid') {
    return {
      httpStatus: 409,
      json: {
        error: {
          code: 'contest_not_paid',
          message: 'Resume applies only to contests in paid status.',
        },
      },
    };
  }

  if (contest.prizePayoutStatus !== 'held') {
    return {
      httpStatus: 409,
      json: {
        error: {
          code: 'not_on_hold',
          message: 'Contest is not on payout hold.',
        },
      },
    };
  }

  const auditReason = reason?.trim() || 'resume';
  const auditId = newAuditLedgerDocId(contestId, 'resume');
  const ledgerPayload = buildPayoutAdminAuditLedgerPayload({
    actorUid,
    contestId,
    action: 'payout_resume',
    reason: auditReason,
  });

  const batch = db.batch();
  batch.update(contestRef, {
    prizePayoutStatus: 'scheduled',
    payoutHoldReason: FieldValue.delete(),
    heldByAdminUid: FieldValue.delete(),
    heldAt: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`ledgerEntries/${auditId}`), ledgerPayload);
  await batch.commit();

  logPayoutAdminActionLine({
    requestId,
    contestId,
    outcome: 'payout_resume_ok',
    actorUid,
    latencyMs: Date.now() - startMs,
  });

  return {
    httpStatus: 200,
    json: {
      schemaVersion: 1,
      contestId,
      prizePayoutStatus: 'scheduled',
      ledgerEntryId: auditId,
    },
  };
}

/**
 * @param {{ rank: number; uid: string; amountCents: number; status: string; stripeTransferId?: string | null; failureCode?: string | null; lastStripeEventId?: string | null }[]} lines
 * @param {number | undefined} targetRank
 * @param {string | undefined} targetUid
 */
export function pickFailedPayoutLinesForRetry(lines, targetRank, targetUid) {
  const failed = lines.filter(
    (l) =>
      l.amountCents > 0 &&
      l.status === 'failed' &&
      (l.stripeTransferId == null || String(l.stripeTransferId).trim() === ''),
  );
  if (targetRank == null && (targetUid == null || targetUid === '')) {
    return failed;
  }
  return failed.filter(
    (l) =>
      (targetRank == null || l.rank === targetRank) &&
      (targetUid == null || targetUid === '' || l.uid === targetUid),
  );
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').default} stripe
 * @param {string} contestId
 * @param {string} requestId
 * @param {string} actorUid
 * @param {string} reason
 * @param {boolean} force
 * @param {number | undefined} targetRank
 * @param {string | undefined} targetUid
 * @param {number} startMs
 */
export async function runContestPayoutRetryFailedLinesAuthorized({
  db,
  stripe,
  contestId,
  requestId,
  actorUid,
  reason,
  force,
  targetRank,
  targetUid,
  startMs,
}) {
  if (!force) {
    return {
      httpStatus: 400,
      json: {
        error: {
          code: 'force_required',
          message: 'Set force to true to confirm retry of failed payout lines.',
        },
      },
    };
  }

  const contestRef = db.doc(`contests/${contestId}`);
  const finalRef = db.doc(`contests/${contestId}/payouts/final`);

  const [contestSnap, finalSnap] = await Promise.all([
    contestRef.get(),
    finalRef.get(),
  ]);

  if (!contestSnap.exists) {
    return {
      httpStatus: 404,
      json: { error: { code: 'contest_not_found', message: 'Contest not found.' } },
    };
  }
  const contest = contestSnap.data();
  if (!isRecord(contest) || !isContestStatus(contest.status) || contest.status !== 'paid') {
    return {
      httpStatus: 409,
      json: {
        error: {
          code: 'contest_not_paid',
          message: 'Retry applies only to contests in paid status.',
        },
      },
    };
  }

  if (contest.prizePayoutStatus === 'held') {
    return {
      httpStatus: 409,
      json: {
        error: {
          code: 'payout_held',
          message: 'Release payout hold before retrying failed lines.',
        },
      },
    };
  }

  if (!finalSnap.exists) {
    return {
      httpStatus: 409,
      json: {
        error: {
          code: 'payout_final_missing',
          message: 'No payouts/final document to retry.',
        },
      },
    };
  }

  const finalData = finalSnap.data();
  if (!isRecord(finalData)) {
    return {
      httpStatus: 500,
      json: { error: { code: 'internal_error', message: 'Invalid payouts/final.' } },
    };
  }

  const rawLines = finalData.lines;
  if (!Array.isArray(rawLines)) {
    return {
      httpStatus: 500,
      json: { error: { code: 'internal_error', message: 'Invalid payouts/final lines.' } },
    };
  }

  /** @type {{ rank: number; uid: string; amountCents: number; status: string; stripeTransferId?: string | null; failureCode?: string | null; lastStripeEventId?: string | null }[]} */
  const lines = rawLines.map((row) => {
    if (!isRecord(row)) {
      return {
        rank: 0,
        uid: '',
        amountCents: 0,
        status: 'skipped',
      };
    }
    const r = row;
    return {
      rank: typeof r.rank === 'number' ? r.rank : 0,
      uid: typeof r.uid === 'string' ? r.uid : '',
      amountCents:
        typeof r.amountCents === 'number' && Number.isFinite(r.amountCents)
          ? r.amountCents
          : 0,
      status: typeof r.status === 'string' ? r.status : 'skipped',
      stripeTransferId:
        typeof r.stripeTransferId === 'string' ? r.stripeTransferId : null,
      failureCode: typeof r.failureCode === 'string' ? r.failureCode : null,
      lastStripeEventId:
        typeof r.lastStripeEventId === 'string' ? r.lastStripeEventId : null,
    };
  });

  const aggregateStatus = computeContestPayoutFinalAggregateStatus(lines);
  if (!isPayoutFinalAggregateRetryEligible(aggregateStatus)) {
    return {
      httpStatus: 409,
      json: {
        error: {
          code: 'payout_final_not_retryable',
          message:
            'payouts/final aggregate is succeeded (or has no failed money lines); nothing to retry.',
          aggregateStatus,
        },
      },
    };
  }

  const payoutJobId =
    typeof finalData.payoutJobId === 'string' && finalData.payoutJobId.trim() !== ''
      ? finalData.payoutJobId.trim()
      : `payout_retry_${Date.now()}`;

  const toRetry = pickFailedPayoutLinesForRetry(lines, targetRank, targetUid);
  if (toRetry.length === 0) {
    return {
      httpStatus: 409,
      json: {
        error: {
          code: 'no_failed_lines_match',
          message:
            'No failed payout lines match the request (check rank / uid, or nothing failed).',
        },
      },
    };
  }

  const uniqueUids = [...new Set(toRetry.map((t) => t.uid))];
  /** @type {Map<string, import('firebase-admin/firestore').DocumentSnapshot>} */
  const entrySnapByUid = new Map();
  /** @type {Map<string, import('firebase-admin/firestore').DocumentSnapshot>} */
  const userSnapByUid = new Map();
  await Promise.all(
    uniqueUids.map(async (uid) => {
      const [e, u] = await Promise.all([
        db.doc(`contests/${contestId}/entries/${uid}`).get(),
        db.doc(`users/${uid}`).get(),
      ]);
      entrySnapByUid.set(uid, e);
      userSnapByUid.set(uid, u);
    }),
  );

  if (isContestPayoutBalanceGuardEnabled()) {
    const entrySnapsForPlan = toRetry.map((t) => entrySnapByUid.get(t.uid));
    const userSnapsForPlan = toRetry.map((t) => userSnapByUid.get(t.uid));
    const requiredUsdCents = computePlannedPrizeTransferTotalCents(
      toRetry,
      entrySnapsForPlan,
      userSnapsForPlan,
    );
    if (requiredUsdCents > 0) {
      try {
        const balance = await stripe.balance.retrieve();
        const availableUsdCents = extractUsdAvailableCentsFromBalance(balance);
        if (availableUsdCents < requiredUsdCents) {
          return {
            httpStatus: 409,
            json: {
              error: {
                code: 'insufficient_platform_balance',
                message:
                  'Stripe platform USD available balance is below the sum of retried prize transfers.',
                availableUsdCents,
                requiredUsdCents,
              },
            },
          };
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return {
          httpStatus: 503,
          json: {
            error: {
              code: 'stripe_balance_unavailable',
              message: 'Could not verify platform balance before retry; try again later.',
              details: msg.slice(0, 200),
            },
          },
        };
      }
    }
  }

  const scoringJobId =
    typeof finalData.scoringJobId === 'string' && finalData.scoringJobId.trim() !== ''
      ? finalData.scoringJobId.trim()
      : payoutJobId;

  /** @type {{ rank: number; uid: string; amountCents: number; status: string; stripeTransferId?: string | null; failureCode?: string | null; lastStripeEventId?: string | null }[]} */
  const working = lines.map((l) => ({ ...l }));

  /** @type {{ uid: string; rank: number; stripeTransferId: string; amountCents: number }[]} */
  const newSuccesses = [];

  for (const target of toRetry) {
    const idx = working.findIndex(
      (l) => l.rank === target.rank && l.uid === target.uid && l.status === 'failed',
    );
    if (idx < 0) continue;

    const entrySnap = entrySnapByUid.get(target.uid);
    const userSnap = userSnapByUid.get(target.uid);
    if (!entrySnap || !userSnap) {
      continue;
    }

    if (!entryEligibleForAutomatedPrizePayout(entrySnap)) {
      working[idx] = {
        ...working[idx],
        status: 'skipped',
        failureCode: 'entry_not_eligible_for_payout',
        stripeTransferId: null,
      };
      continue;
    }
    if (!userConnectReadyForPayoutTransfer(userSnap)) {
      working[idx] = {
        ...working[idx],
        status: 'skipped',
        failureCode: 'connect_not_ready_for_transfer',
        stripeTransferId: null,
      };
      continue;
    }

    const userData = userSnap.data();
    const destination =
      userData && typeof userData === 'object'
        ? String(
            /** @type {Record<string, unknown>} */ (userData).stripeConnectAccountId ?? '',
          ).trim()
        : '';

    try {
      const idempotencyKey = stripePayoutTransferIdempotencyKey(
        contestId,
        target.uid,
        target.rank,
      );
      const transfer = await stripe.transfers.create(
        {
          amount: target.amountCents,
          currency: 'usd',
          destination,
          metadata: {
            firebase_uid: target.uid,
            contest_id: contestId,
            rank: String(target.rank),
            payout_job_id: payoutJobId,
          },
        },
        { idempotencyKey },
      );
      working[idx] = {
        ...working[idx],
        status: 'succeeded',
        stripeTransferId: transfer.id,
        failureCode: null,
        lastStripeEventId: null,
      };
      newSuccesses.push({
        uid: target.uid,
        rank: target.rank,
        stripeTransferId: transfer.id,
        amountCents: target.amountCents,
      });
    } catch (e) {
      const stripeCode =
        e instanceof Stripe.errors.StripeError ? e.code ?? e.type : undefined;
      const msg = e instanceof Error ? e.message : String(e);
      working[idx] = {
        ...working[idx],
        status: 'failed',
        stripeTransferId: null,
        failureCode: stripeCode != null ? String(stripeCode) : 'stripe_transfer_failed',
        lastStripeEventId: null,
      };
      logPayoutAdminActionLine({
        requestId,
        contestId,
        outcome: 'payout_retry_line_still_failed',
        uid: target.uid,
        rank: target.rank,
        message: msg,
        stripeErrorCode: stripeCode,
      });
    }
  }

  const newAggregate = computeContestPayoutFinalAggregateStatus(working);
  const lockedAt = FieldValue.serverTimestamp();

  /** @type {Record<string, unknown>} */
  const updatedFinal = {
    ...finalData,
    lines: working,
    aggregateStatus: newAggregate,
    lockedAt,
    payoutJobId,
    scoringJobId,
    contestId,
  };

  const auditId = newAuditLedgerDocId(contestId, 'retry');
  const auditPayload = buildPayoutAdminAuditLedgerPayload({
    actorUid,
    contestId,
    action: 'payout_retry_failed',
    reason,
    extraMetadata: {
      retriedRanks: toRetry.map((t) => t.rank),
      retriedUids: toRetry.map((t) => t.uid),
      newSuccessTransferIds: newSuccesses.map((s) => s.stripeTransferId),
      aggregateStatusAfter: newAggregate,
    },
  });

  /** @type {{ id: string; data: Record<string, unknown> }[]} */
  const prizeLedgerWrites = [];
  for (const row of newSuccesses) {
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
      stripeObjectId: row.stripeTransferId,
      source: 'system',
      createdAt: lockedAt,
      metadata: {
        contestId,
        rank: row.rank,
        payoutJobId,
        fromAdminRetry: true,
      },
    };
    assertValidContestLedgerEntryPayload(ledgerPayload);
    prizeLedgerWrites.push({ id: row.stripeTransferId, data: ledgerPayload });
  }

  const batch = db.batch();
  batch.set(finalRef, updatedFinal);
  batch.update(contestRef, {
    prizePayoutStatus: newAggregate === 'succeeded' ? 'completed' : 'failed',
    updatedAt: FieldValue.serverTimestamp(),
  });
  batch.set(db.doc(`ledgerEntries/${auditId}`), auditPayload);
  for (const lw of prizeLedgerWrites) {
    batch.set(db.doc(`ledgerEntries/${lw.id}`), lw.data, { merge: true });
  }

  try {
    await batch.commit();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logPayoutAdminActionLine({
      requestId,
      contestId,
      outcome: 'payout_retry_batch_failed',
      httpStatus: 500,
      message: msg,
    });
    return {
      httpStatus: 500,
      json: {
        error: {
          code: 'payout_retry_persist_failed',
          message: 'Stripe may have created transfers but Firestore commit failed — reconcile.',
          details: msg,
        },
      },
    };
  }

  logPayoutAdminActionLine({
    requestId,
    contestId,
    outcome: 'payout_retry_ok',
    aggregateStatus: newAggregate,
    latencyMs: Date.now() - startMs,
    newSuccessCount: newSuccesses.length,
  });

  return {
    httpStatus: 200,
    json: {
      schemaVersion: 1,
      contestId,
      aggregateStatus: newAggregate,
      prizePayoutStatus: newAggregate === 'succeeded' ? 'completed' : 'failed',
      ledgerEntryId: auditId,
      lines: working,
      retriedCount: toRetry.length,
      newSuccessCount: newSuccesses.length,
    },
  };
}
