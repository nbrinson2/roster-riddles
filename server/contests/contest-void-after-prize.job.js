/**
 * Phase 6 Story P6-F1 — void a `paid` contest after real prize transfers: Stripe Transfer reversals,
 * `prize_transfer_reversal` ledger lines, audit doc, then `paid` → `cancelled` + artifact deletes.
 * Operator-only via Admin HTTP; coordinates with Story F2 artifact cleanup (see contest-transition-run).
 * @see docs/weekly-contests/weekly-contests-ops-p6-f1-void-prize.md
 */
import { randomBytes } from 'node:crypto';
import { FieldValue } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { assertValidContestLedgerEntryPayload } from '../payments/contest-ledger-entry-validate.js';
import { deletePaidContestScoringArtifactsInTransaction } from './contest-transition-run.js';
import { isContestStatus } from './contest-transitions.js';

const LEDGER_SCHEMA_VERSION = 1;

/**
 * @param {unknown} c
 * @returns {c is Record<string, unknown>}
 */
function isRecord(c) {
  return c != null && typeof c === 'object' && !Array.isArray(c);
}

/**
 * @param {unknown} e
 * @returns {boolean}
 */
function isStripeAlreadyReversedError(e) {
  if (!(e instanceof Stripe.errors.StripeError)) {
    return false;
  }
  const c = (e.code ?? '').toString().toLowerCase();
  const m = (e.message ?? '').toString().toLowerCase();
  return (
    c.includes('already') ||
    m.includes('already been fully reversed') ||
    m.includes('has already been reversed')
  );
}

/**
 * @param {unknown[]} lines
 * @returns {{ uid: string; rank: number; amountCents: number; stripeTransferId: string }[]}
 */
export function collectSucceededPrizeTransferLinesForVoid(lines) {
  if (!Array.isArray(lines)) {
    return [];
  }
  /** @type {Set<string>} */
  const seenTr = new Set();
  /** @type {{ uid: string; rank: number; amountCents: number; stripeTransferId: string }[]} */
  const out = [];
  for (const row of lines) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const r = /** @type {Record<string, unknown>} */ (row);
    const status = r.status;
    const tid = r.stripeTransferId;
    const uid = r.uid;
    const rank = r.rank;
    const amountCents = r.amountCents;
    if (status !== 'succeeded') {
      continue;
    }
    if (typeof tid !== 'string' || !tid.startsWith('tr_')) {
      continue;
    }
    if (typeof uid !== 'string' || uid.trim() === '') {
      continue;
    }
    if (typeof rank !== 'number' || !Number.isFinite(rank)) {
      continue;
    }
    if (typeof amountCents !== 'number' || !Number.isFinite(amountCents) || amountCents <= 0) {
      continue;
    }
    if (seenTr.has(tid)) {
      continue;
    }
    seenTr.add(tid);
    out.push({ uid, rank, amountCents, stripeTransferId: tid });
  }
  return out;
}

/**
 * @param {object} p
 * @param {import('firebase-admin/firestore').Firestore} p.db
 * @param {import('stripe').default} p.stripe
 * @param {string} p.contestId
 * @param {string} p.requestId
 * @param {string} p.actorUid
 * @param {string} p.reason
 * @param {string} [p.voidJobId]
 * @returns {Promise<
 *   | { ok: true; voidJobId: string; reversalCount: number; ledgerEntryIds: string[] }
 *   | { ok: false; httpStatus: number; code: string; message: string }
 * >}
 */
export async function runContestVoidAfterPrizeAuthorized({
  db,
  stripe,
  contestId,
  requestId,
  actorUid,
  reason,
  voidJobId: voidJobIdInput,
}) {
  const voidJobId =
    voidJobIdInput?.trim() ||
    `void_prize_${Date.now()}_${randomBytes(5).toString('hex')}`;

  const contestRef = db.doc(`contests/${contestId}`);
  const finalRef = db.doc(`contests/${contestId}/payouts/final`);

  const [cSnap, fSnap] = await Promise.all([contestRef.get(), finalRef.get()]);
  if (!cSnap.exists) {
    return {
      ok: false,
      httpStatus: 404,
      code: 'contest_not_found',
      message: 'Contest not found.',
    };
  }
  const contest = cSnap.data();
  if (!isRecord(contest)) {
    return { ok: false, httpStatus: 500, code: 'internal_error', message: 'Invalid contest document.' };
  }
  const status = contest.status;
  if (!isContestStatus(status) || status !== 'paid') {
    return {
      ok: false,
      httpStatus: 409,
      code: 'contest_not_paid',
      message: 'Contest must be in paid status to void after prize.',
    };
  }

  if (!fSnap.exists) {
    return {
      ok: false,
      httpStatus: 409,
      code: 'payout_final_missing',
      message: 'No payouts/final document — use paid→cancelled transition (F2) for dry-run voids without prize execution.',
    };
  }

  const final = fSnap.data();
  if (!isRecord(final)) {
    return { ok: false, httpStatus: 500, code: 'internal_error', message: 'Invalid payouts/final.' };
  }
  if (final.notRealMoney === true) {
    return {
      ok: false,
      httpStatus: 409,
      code: 'payout_not_real_money',
      message: 'payouts/final is marked notRealMoney — void via standard F2 transition instead.',
    };
  }

  const lines = final.lines;
  const toReverse = collectSucceededPrizeTransferLinesForVoid(lines);
  if (toReverse.length === 0) {
    return {
      ok: false,
      httpStatus: 409,
      code: 'no_succeeded_transfers_to_reverse',
      message: 'No succeeded prize transfer lines with tr_ ids to reverse.',
    };
  }

  /** @type {{ stripeTransferId: string; reversalId: string; amountCents: number; uid: string; rank: number }[]} */
  const reversalResults = [];

  for (const row of toReverse) {
    const idem = `void_prize_${contestId}_${row.stripeTransferId}_${voidJobId}`.slice(0, 255);
    try {
      const rev = await stripe.transfers.createReversal(
        row.stripeTransferId,
        {
          amount: row.amountCents,
          metadata: {
            contest_id: contestId,
            firebase_uid: row.uid,
            void_job_id: voidJobId,
            rank: String(row.rank),
          },
        },
        { idempotencyKey: idem },
      );
      reversalResults.push({
        stripeTransferId: row.stripeTransferId,
        reversalId: rev.id,
        amountCents: typeof rev.amount === 'number' ? rev.amount : row.amountCents,
        uid: row.uid,
        rank: row.rank,
      });
    } catch (e) {
      if (isStripeAlreadyReversedError(e)) {
        reversalResults.push({
          stripeTransferId: row.stripeTransferId,
          reversalId: 'already_reversed',
          amountCents: row.amountCents,
          uid: row.uid,
          rank: row.rank,
        });
        continue;
      }
      const msg = e instanceof Error ? e.message : String(e);
      const code = e instanceof Stripe.errors.StripeError ? e.code : undefined;
      return {
        ok: false,
        httpStatus: 502,
        code: 'stripe_transfer_reversal_failed',
        message: `Stripe reversal failed for ${row.stripeTransferId}: ${msg}${
          code != null ? ` (${String(code)})` : ''
        }`,
      };
    }
  }

  const auditRef = db.doc(`contests/${contestId}/voidPrizeAttempts/${voidJobId}`);
  const scoringJobId =
    typeof final.scoringJobId === 'string' && final.scoringJobId.trim() !== ''
      ? final.scoringJobId.trim()
      : voidJobId;
  const payoutJobId =
    typeof final.payoutJobId === 'string' && final.payoutJobId.trim() !== ''
      ? final.payoutJobId.trim()
      : voidJobId;

  /** @type {string[]} */
  const ledgerEntryIds = [];

  try {
    await db.runTransaction(async (tx) => {
      const c2 = await tx.get(contestRef);
      if (!c2.exists) {
        throw new Error('contest_missing_in_transaction');
      }
      const d = c2.data();
      if (!isRecord(d) || !isContestStatus(d.status) || d.status !== 'paid') {
        throw new Error('contest_not_paid_in_transaction');
      }

      tx.set(
        auditRef,
        {
          schemaVersion: 1,
          voidJobId,
          contestId,
          actorUid,
          reason,
          requestId,
          scoringJobId,
          payoutJobId,
          reversalResults,
          createdAt: FieldValue.serverTimestamp(),
        },
        { merge: false },
      );

      for (const r of reversalResults) {
        if (r.reversalId === 'already_reversed') {
          continue;
        }
        const ledgerId = r.reversalId;
        ledgerEntryIds.push(ledgerId);
        /** @type {Record<string, unknown>} */
        const ledgerPayload = {
          schemaVersion: LEDGER_SCHEMA_VERSION,
          uid: r.uid,
          contestId,
          entryPathHint: `contests/${contestId}/entries/${r.uid}`,
          lineType: 'prize_transfer_reversal',
          direction: 'credit',
          amountCents: r.amountCents,
          currency: 'usd',
          stripeEventId: null,
          stripeObjectType: 'transfer_reversal',
          stripeObjectId: r.reversalId,
          source: 'admin_adjustment',
          createdAt: FieldValue.serverTimestamp(),
          metadata: {
            contestId,
            rank: r.rank,
            voidJobId,
            originalTransferId: r.stripeTransferId,
          },
        };
        assertValidContestLedgerEntryPayload(ledgerPayload);
        tx.set(db.doc(`ledgerEntries/${ledgerId}`), ledgerPayload);
      }

      deletePaidContestScoringArtifactsInTransaction(tx, db, contestId);

      tx.update(contestRef, {
        status: 'cancelled',
        updatedAt: FieldValue.serverTimestamp(),
      });
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'contest_missing_in_transaction' || msg === 'contest_not_paid_in_transaction') {
      return {
        ok: false,
        httpStatus: 409,
        code: 'contest_state_changed',
        message: 'Contest state changed during void — Stripe reversals may have succeeded; reconcile manually.',
      };
    }
    return {
      ok: false,
      httpStatus: 500,
      code: 'void_prize_transaction_failed',
      message: msg,
    };
  }

  return {
    ok: true,
    voidJobId,
    reversalCount: reversalResults.length,
    ledgerEntryIds,
  };
}
