/**
 * Phase 6 Story P6-E2 — Stripe `transfer.*` and Connect `payout.*` webhooks for contest prizes.
 * Updates `contests/{contestId}/payouts/final` lines, optional `ledgerEntries` (reversal), `processedStripeEvents`.
 * @see docs/weekly-contests/weekly-contests-phase5-webhooks.md (P6-E2 section)
 */
import { FieldValue } from 'firebase-admin/firestore';
import { computeContestPayoutFinalAggregateStatus } from '../contests/contest-payout-execute.job.js';
import {
  emitContestWebhookFailureMetric,
  logStripeWebhookLine,
} from './contest-payments-observability.js';
import { assertValidContestLedgerEntryPayload } from './contest-ledger-entry-validate.js';
import { PROCESSED_STRIPE_EVENTS } from './stripe-webhook-contest-payment.js';

const LEDGER_SCHEMA_VERSION = 1;

/** @type {readonly string[]} */
export const PRIZE_TRANSFER_FAILURE_PUBLIC_CODES = Object.freeze([
  'prize_payout_transfer_generic',
  'prize_payout_transfer_insufficient_funds',
  'prize_payout_transfer_reversed',
  'prize_payout_transfer_cancelled',
  'prize_payout_transfer_declined',
]);

/** @type {readonly string[]} */
export const BANK_PAYOUT_FAILURE_PUBLIC_CODES = Object.freeze([
  'bank_payout_failed_generic',
  'bank_payout_failed_account_closed',
  'bank_payout_failed_insufficient_funds',
  'bank_payout_failed_invalid_account',
  'bank_payout_failed_no_account',
  'bank_payout_failed_declined',
  'bank_payout_debit_not_authorized',
  'bank_payout_failed_restricted',
]);

/**
 * @param {string | null | undefined} stripeCode
 * @param {string | null | undefined} stripeMessage
 * @returns {string} — stable enum for Firestore / UI (never raw Stripe free-form).
 */
export function mapTransferStripeFailureToPublicCode(stripeCode, stripeMessage) {
  const code = (stripeCode ?? '').toString().toLowerCase();
  const msg = (stripeMessage ?? '').toString().toLowerCase();
  if (
    code.includes('balance_insufficient') ||
    code.includes('insufficient_funds') ||
    msg.includes('insufficient')
  ) {
    return 'prize_payout_transfer_insufficient_funds';
  }
  if (code.includes('cancel') || msg.includes('cancel')) {
    return 'prize_payout_transfer_cancelled';
  }
  if (code.includes('declin') || msg.includes('declin')) {
    return 'prize_payout_transfer_declined';
  }
  return 'prize_payout_transfer_generic';
}

/**
 * @param {string | null | undefined} stripeFailureCode
 * @returns {string}
 */
export function mapPayoutStripeFailureToPublicCode(stripeFailureCode) {
  const c = (stripeFailureCode ?? '').toString().toLowerCase();
  if (!c) {
    return 'bank_payout_failed_generic';
  }
  if (c.includes('account_closed')) {
    return 'bank_payout_failed_account_closed';
  }
  if (c.includes('insufficient_funds')) {
    return 'bank_payout_failed_insufficient_funds';
  }
  if (c.includes('invalid_account') || c.includes('incorrect_account')) {
    return 'bank_payout_failed_invalid_account';
  }
  if (c.includes('no_account')) {
    return 'bank_payout_failed_no_account';
  }
  if (c.includes('debit_not_authorized')) {
    return 'bank_payout_debit_not_authorized';
  }
  if (c.includes('declined')) {
    return 'bank_payout_failed_declined';
  }
  if (c.includes('restricted') || c.includes('bank_account_restricted')) {
    return 'bank_payout_failed_restricted';
  }
  return 'bank_payout_failed_generic';
}

/**
 * @param {import('stripe').Stripe.Event} event
 * @returns {{ transfer: import('stripe').Stripe.Transfer; contestId: string; uid: string; rank: number | null } | null}
 */
export function extractPrizeTransferWebhookContext(event) {
  const obj = event.data?.object;
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  const transfer = /** @type {import('stripe').Stripe.Transfer} */ (obj);
  if (typeof transfer.id !== 'string' || !transfer.id.startsWith('tr_')) {
    return null;
  }
  const metaRaw = transfer.metadata;
  const meta =
    metaRaw && typeof metaRaw === 'object'
      ? /** @type {Record<string, unknown>} */ (metaRaw)
      : {};
  const contestId =
    typeof meta.contest_id === 'string' && meta.contest_id.trim() !== ''
      ? meta.contest_id.trim()
      : '';
  const uid =
    typeof meta.firebase_uid === 'string' && meta.firebase_uid.trim() !== ''
      ? meta.firebase_uid.trim()
      : '';
  if (!contestId || !uid) {
    return null;
  }
  const rankRaw = meta.rank;
  let rank = null;
  if (typeof rankRaw === 'string' && /^\d+$/.test(rankRaw)) {
    rank = parseInt(rankRaw, 10);
  } else if (typeof rankRaw === 'number' && Number.isFinite(rankRaw)) {
    rank = Math.floor(rankRaw);
  }
  return { transfer, contestId, uid, rank };
}

/**
 * @param {unknown[]} lines
 * @param {import('stripe').Stripe.Transfer} transfer
 * @param {string} uid
 * @param {number | null} rank
 * @returns {number}
 */
export function findPayoutFinalLineIndexForTransfer(lines, transfer, uid, rank) {
  if (!Array.isArray(lines)) {
    return -1;
  }
  const tid = transfer.id;
  for (let i = 0; i < lines.length; i++) {
    const row = lines[i];
    if (!row || typeof row !== 'object') {
      continue;
    }
    const r = /** @type {Record<string, unknown>} */ (row);
    if (typeof r.stripeTransferId === 'string' && r.stripeTransferId === tid) {
      return i;
    }
  }
  if (rank != null && Number.isFinite(rank)) {
    for (let i = 0; i < lines.length; i++) {
      const row = lines[i];
      if (!row || typeof row !== 'object') {
        continue;
      }
      const r = /** @type {Record<string, unknown>} */ (row);
      if (r.uid === uid && r.rank === rank) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * @param {unknown[]} lines
 * @returns {{ rank: number; uid: string; amountCents: number; status: string }[]}
 */
function linesForAggregate(lines) {
  /** @type {{ rank: number; uid: string; amountCents: number; status: string }[]} */
  const out = [];
  for (const row of lines) {
    if (!row || typeof row !== 'object') {
      continue;
    }
    const r = /** @type {Record<string, unknown>} */ (row);
    out.push({
      rank: typeof r.rank === 'number' ? r.rank : 0,
      uid: typeof r.uid === 'string' ? r.uid : '',
      amountCents:
        typeof r.amountCents === 'number' && Number.isFinite(r.amountCents) ? r.amountCents : 0,
      status: typeof r.status === 'string' ? r.status : 'skipped',
    });
  }
  return out;
}

/**
 * Apply Stripe transfer lifecycle to `payouts/final` when metadata matches contest prize execute.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').Stripe.Event} event
 * @param {string} requestId
 * @returns {Promise<{ outcome: string; contestId?: string; uid?: string }>}
 */
export async function processStripePrizeTransferWebhook(db, event, requestId) {
  const ctx = extractPrizeTransferWebhookContext(event);
  if (!ctx) {
    await db.doc(`${PROCESSED_STRIPE_EVENTS}/${event.id}`).set(
      {
        outcome: 'transfer_not_contest_metadata',
        stripeEventType: event.type,
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    logStripeWebhookLine({
      requestId,
      eventId: event.id,
      eventType: event.type,
      outcome: 'transfer_not_contest_metadata',
    });
    return { outcome: 'transfer_not_contest_metadata' };
  }

  const { transfer, contestId, uid, rank } = ctx;
  const processedRef = db.doc(`${PROCESSED_STRIPE_EVENTS}/${event.id}`);
  const pre = await processedRef.get();
  if (pre.exists) {
    logStripeWebhookLine({
      requestId,
      eventId: event.id,
      eventType: event.type,
      contestId,
      uid,
      outcome: 'prize_transfer_duplicate_stripe_event',
    });
    return { outcome: 'prize_transfer_duplicate_stripe_event', contestId, uid };
  }

  const finalRef = db.doc(`contests/${contestId}/payouts/final`);
  /** One reversal credit per Transfer id (avoids duplicate ledger across `transfer.reversed` vs `transfer.updated`). */
  const ledgerRef = db.doc(`ledgerEntries/prize_reversal_${transfer.id}`);

  let outcome = 'prize_transfer_ok';

  try {
    await db.runTransaction(async (tx) => {
      const [pSnap, fSnap, lSnap] = await Promise.all([
        tx.get(processedRef),
        tx.get(finalRef),
        tx.get(ledgerRef),
      ]);

      if (pSnap.exists) {
        outcome = 'prize_transfer_duplicate_stripe_event';
        return;
      }

      if (!fSnap.exists) {
        tx.set(
          processedRef,
          {
            outcome: 'transfer_final_doc_missing',
            contestId,
            uid,
            transferId: transfer.id,
            stripeEventType: event.type,
            processedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        outcome = 'transfer_final_doc_missing';
        return;
      }

      const finalData = fSnap.data();
      if (!finalData || typeof finalData !== 'object') {
        tx.set(
          processedRef,
          {
            outcome: 'transfer_final_invalid_shape',
            contestId,
            uid,
            stripeEventType: event.type,
            processedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        outcome = 'transfer_final_invalid_shape';
        return;
      }

      const rec = /** @type {Record<string, unknown>} */ (finalData);
      const linesRaw = rec.lines;
      if (!Array.isArray(linesRaw)) {
        tx.set(
          processedRef,
          {
            outcome: 'transfer_final_no_lines',
            contestId,
            uid,
            stripeEventType: event.type,
            processedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        outcome = 'transfer_final_no_lines';
        return;
      }

      const idx = findPayoutFinalLineIndexForTransfer(linesRaw, transfer, uid, rank);
      if (idx < 0) {
        tx.set(
          processedRef,
          {
            outcome: 'transfer_no_matching_final_line',
            contestId,
            uid,
            transferId: transfer.id,
            stripeEventType: event.type,
            processedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        outcome = 'transfer_no_matching_final_line';
        return;
      }

      const lineObj = linesRaw[idx];
      if (!lineObj || typeof lineObj !== 'object') {
        tx.set(
          processedRef,
          {
            outcome: 'transfer_line_invalid',
            contestId,
            uid,
            stripeEventType: event.type,
            processedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        outcome = 'transfer_line_invalid';
        return;
      }

      const line = /** @type {Record<string, unknown>} */ (lineObj);
      if (line.uid !== uid) {
        tx.set(
          processedRef,
          {
            outcome: 'transfer_metadata_uid_mismatch',
            contestId,
            uid,
            lineUid: line.uid,
            stripeEventType: event.type,
            processedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        outcome = 'transfer_metadata_uid_mismatch';
        return;
      }

      const nextLines = linesRaw.map((row, j) => {
        if (!row || typeof row !== 'object') {
          return row;
        }
        const r = /** @type {Record<string, unknown>} */ ({ ...row });
        if (j !== idx) {
          return r;
        }

        r.lastStripeEventId = event.id;

        const eventType = event.type;
        const shouldRecordReversalLedger =
          eventType === 'transfer.reversed' ||
          (eventType === 'transfer.updated' &&
            (transfer.reversed === true || (transfer.amount_reversed ?? 0) > 0));

        if (shouldRecordReversalLedger) {
          r.status = 'failed';
          r.failurePublicCode = 'prize_payout_transfer_reversed';
          r.failureCode = 'prize_payout_transfer_reversed';
          const amt =
            typeof transfer.amount_reversed === 'number' && transfer.amount_reversed > 0
              ? transfer.amount_reversed
              : typeof transfer.amount === 'number' && transfer.amount > 0
                ? transfer.amount
                : typeof r.amountCents === 'number'
                  ? r.amountCents
                  : 0;
          const reversalCents = Math.min(
            amt,
            typeof r.amountCents === 'number' ? r.amountCents : amt,
          );

          if (!lSnap.exists && reversalCents > 0) {
            const payoutJobId =
              typeof rec.payoutJobId === 'string' ? rec.payoutJobId : 'unknown';
            /** @type {Record<string, unknown>} */
            const ledgerPayload = {
              schemaVersion: LEDGER_SCHEMA_VERSION,
              uid,
              contestId,
              entryPathHint: `contests/${contestId}/entries/${uid}`,
              lineType: 'prize_transfer_reversal',
              direction: 'credit',
              amountCents: reversalCents,
              currency: 'usd',
              stripeEventId: event.id,
              stripeObjectType: 'transfer',
              stripeObjectId: transfer.id,
              source: 'webhook',
              createdAt: FieldValue.serverTimestamp(),
              metadata: {
                contestId,
                rank: r.rank,
                payoutJobId,
              },
            };
            assertValidContestLedgerEntryPayload(ledgerPayload);
            tx.set(ledgerRef, ledgerPayload);
          }
        } else if (eventType === 'transfer.failed') {
          r.status = 'failed';
          const pub = mapTransferStripeFailureToPublicCode(
            typeof transfer.failure_code === 'string' ? transfer.failure_code : null,
            typeof transfer.failure_message === 'string' ? transfer.failure_message : null,
          );
          r.failurePublicCode = pub;
          r.failureCode = pub;
        } else if (
          eventType === 'transfer.paid' ||
          eventType === 'transfer.created' ||
          eventType === 'transfer.updated'
        ) {
          if (transfer.reversed === true || (transfer.amount_reversed ?? 0) > 0) {
            r.status = 'failed';
            r.failurePublicCode = 'prize_payout_transfer_reversed';
            r.failureCode = 'prize_payout_transfer_reversed';
          } else if (transfer.failure_code) {
            const pub = mapTransferStripeFailureToPublicCode(
              typeof transfer.failure_code === 'string' ? transfer.failure_code : null,
              typeof transfer.failure_message === 'string' ? transfer.failure_message : null,
            );
            r.status = 'failed';
            r.failurePublicCode = pub;
            r.failureCode = pub;
          } else if (
            typeof r.amountCents === 'number' &&
            r.amountCents > 0 &&
            r.status !== 'skipped'
          ) {
            r.status = 'succeeded';
            r.failurePublicCode = null;
            r.failureCode = null;
          }
        }

        return r;
      });

      const aggregateStatus = computeContestPayoutFinalAggregateStatus(linesForAggregate(nextLines));

      const updatedRow = nextLines[idx];
      const failurePublicLog =
        updatedRow &&
        typeof updatedRow === 'object' &&
        'failurePublicCode' in /** @type {Record<string, unknown>} */ (updatedRow)
          ? /** @type {Record<string, unknown>} */ (updatedRow).failurePublicCode
          : null;

      tx.set(
        finalRef,
        {
          lines: nextLines,
          aggregateStatus,
        },
        { merge: true },
      );

      tx.set(
        processedRef,
        {
          outcome: 'prize_transfer_final_updated',
          contestId,
          uid,
          transferId: transfer.id,
          stripeEventType: event.type,
          failurePublicCode: failurePublicLog ?? null,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'prize_transfer_final_updated';
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStripeWebhookLine({
      severity: 'ERROR',
      requestId,
      eventId: event.id,
      eventType: event.type,
      contestId,
      uid,
      outcome: 'prize_transfer_transaction_failed',
      message: msg,
    });
    emitContestWebhookFailureMetric({
      outcome: 'prize_transfer_transaction_failed',
      requestId,
      eventId: event.id,
      eventType: event.type,
    });
    throw e;
  }

  logStripeWebhookLine({
    requestId,
    eventId: event.id,
    eventType: event.type,
    contestId,
    uid,
    transferId: transfer.id,
    outcome,
  });

  return { outcome, contestId, uid };
}

/**
 * Connect bank payout lifecycle — `processedStripeEvents` + optional `users/{uid}` mirror when
 * exactly one user matches `stripeConnectAccountId === event.account`.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').Stripe.Event} event
 * @param {string} requestId
 * @returns {Promise<{ outcome: string }>}
 */
export async function processStripeConnectBankPayoutWebhook(db, event, requestId) {
  const obj = event.data?.object;
  if (!obj || typeof obj !== 'object') {
    logStripeWebhookLine({
      requestId,
      eventId: event.id,
      eventType: event.type,
      outcome: 'payout_webhook_invalid_payload',
    });
    return { outcome: 'payout_webhook_invalid_payload' };
  }
  const payout = /** @type {import('stripe').Stripe.Payout} */ (obj);
  if (typeof payout.id !== 'string' || !payout.id.startsWith('po_')) {
    logStripeWebhookLine({
      requestId,
      eventId: event.id,
      eventType: event.type,
      outcome: 'payout_webhook_invalid_payload',
    });
    return { outcome: 'payout_webhook_invalid_payload' };
  }

  const account =
    typeof event.account === 'string' && event.account.startsWith('acct_')
      ? event.account
      : typeof payout.destination === 'string' && payout.destination.startsWith('acct_')
        ? payout.destination
        : null;

  const processedRef = db.doc(`${PROCESSED_STRIPE_EVENTS}/${event.id}`);
  const pre = await processedRef.get();
  if (pre.exists) {
    logStripeWebhookLine({
      requestId,
      eventId: event.id,
      eventType: event.type,
      outcome: 'payout_duplicate_stripe_event',
    });
    return { outcome: 'payout_duplicate_stripe_event' };
  }

  const failureCodeRaw = payout.failure_code;
  const failureCode = typeof failureCodeRaw === 'string' ? failureCodeRaw : null;
  const publicCode =
    event.type === 'payout.failed' || event.type === 'payout.canceled'
      ? mapPayoutStripeFailureToPublicCode(failureCode)
      : null;

  let outcome = 'payout_webhook_recorded';

  await db.runTransaction(async (tx) => {
    const pSnap = await tx.get(processedRef);
    if (pSnap.exists) {
      outcome = 'payout_duplicate_stripe_event';
      return;
    }
    tx.set(
      processedRef,
      {
        outcome: 'payout_webhook_recorded',
        stripeEventType: event.type,
        payoutId: payout.id,
        stripeConnectAccountId: account,
        failurePublicCode: publicCode,
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });

  if (account) {
    try {
      const qs = await db
        .collection('users')
        .where('stripeConnectAccountId', '==', account)
        .limit(5)
        .get();
      if (qs.size === 1) {
        const doc = qs.docs[0];
        const uid = doc.id;
        const userRef = db.doc(`users/${uid}`);
        /** @type {Record<string, unknown>} */
        const patch = {
          stripePayoutLastWebhookEventId: event.id,
          stripePayoutLastWebhookType: event.type,
          stripePayoutLastWebhookAt: FieldValue.serverTimestamp(),
        };
        if (event.type === 'payout.paid') {
          patch.stripePayoutLastFailurePublicCode = FieldValue.delete();
        } else if (publicCode) {
          patch.stripePayoutLastFailurePublicCode = publicCode;
        }
        await userRef.set(patch, { merge: true });
      }
    } catch (e) {
      logStripeWebhookLine({
        severity: 'WARNING',
        requestId,
        eventId: event.id,
        eventType: event.type,
        outcome: 'payout_user_mirror_skipped',
        message: e instanceof Error ? e.message : String(e),
      });
    }
  }

  logStripeWebhookLine({
    requestId,
    eventId: event.id,
    eventType: event.type,
    payoutId: payout.id,
    stripeConnectAccountId: account ?? undefined,
    failurePublicCode: publicCode ?? undefined,
    outcome,
  });

  return { outcome };
}

/**
 * @param {string} eventType
 * @returns {boolean}
 */
export function isPrizePayoutStripeWebhookEventType(eventType) {
  return (
    typeof eventType === 'string' &&
    (eventType.startsWith('transfer.') || eventType.startsWith('payout.'))
  );
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').Stripe.Event} event
 * @param {string} requestId
 * @returns {Promise<{ outcome: string }>}
 */
export async function processStripePayoutLifecycleWebhook(db, event, requestId) {
  const t = event.type;
  if (typeof t === 'string' && t.startsWith('transfer.')) {
    return processStripePrizeTransferWebhook(db, event, requestId);
  }
  if (typeof t === 'string' && t.startsWith('payout.')) {
    return processStripeConnectBankPayoutWebhook(db, event, requestId);
  }
  return { outcome: 'payout_webhook_not_applicable' };
}
