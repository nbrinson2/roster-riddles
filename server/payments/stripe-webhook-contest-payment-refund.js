/**
 * Phase 5 Story P5-E3 — Stripe refund webhooks for contest entry fees.
 * - `refund.updated` (succeeded): append-only ledger debit + entry `refundedAmountCents` / `paymentStatus`.
 * - `charge.refunded`: entry sync when the charge is fully refunded (no ledger — avoids double-count with `refund.updated`).
 * @see docs/weekly-contests/weekly-contests-phase5-payments-jira.md
 * @see docs/weekly-contests/weekly-contests-phase5-ledger-schema.md
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getEntryFeeCentsFromContest } from '../contests/contest-checkout.http.js';
import {
  PROCESSED_STRIPE_EVENTS,
  stripeContestMetadataToRecord,
} from './stripe-webhook-contest-payment.js';

const LEDGER_SCHEMA_VERSION = 1;
const ENTRY_SCHEMA_PHASE5 = 2;

/**
 * @param {unknown} v
 * @returns {string | null}
 */
export function paymentIntentIdFromValue(v) {
  if (typeof v === 'string' && v.startsWith('pi_')) {
    return v;
  }
  if (
    v &&
    typeof v === 'object' &&
    'id' in v &&
    typeof /** @type {{ id?: string }} */ (v).id === 'string'
  ) {
    const id = /** @type {{ id: string }} */ (v).id;
    if (id.startsWith('pi_')) {
      return id;
    }
  }
  return null;
}

/**
 * @param {import('stripe').Stripe} stripe
 * @param {string} piId
 * @returns {Promise<Record<string, string> | null>}
 */
async function fetchPaymentIntentMetadata(stripe, piId) {
  try {
    const pi = await stripe.paymentIntents.retrieve(piId);
    return stripeContestMetadataToRecord(pi.metadata);
  } catch (e) {
    console.error(
      JSON.stringify({
        component: 'stripe_webhook',
        severity: 'WARN',
        outcome: 'refund_pi_retrieve_failed',
        paymentIntentId: piId,
        message: e instanceof Error ? e.message : String(e),
      }),
    );
    return null;
  }
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').Stripe} stripe
 * @param {import('stripe').Stripe.Event} event
 * @param {string} requestId
 * @returns {Promise<{ outcome: string; contestId?: string; uid?: string; ledgerWritten?: boolean }>}
 */
export async function processContestPaymentRefundWebhook(db, stripe, event, requestId) {
  if (event.type === 'refund.updated') {
    return processRefundUpdated(db, stripe, event, requestId);
  }
  if (event.type === 'charge.refunded') {
    return processChargeRefunded(db, stripe, event, requestId);
  }
  return { outcome: 'refund_unhandled_type' };
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').Stripe} stripe
 * @param {import('stripe').Stripe.Event} event
 * @param {string} requestId
 */
async function processRefundUpdated(db, stripe, event, requestId) {
  const refund = /** @type {import('stripe').Stripe.Refund} */ (event.data.object);
  if (refund.status !== 'succeeded') {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        eventId: event.id,
        eventType: event.type,
        refundId: refund.id,
        refundStatus: refund.status,
        outcome: 'refund_skip_non_succeeded',
      }),
    );
    return { outcome: 'refund_skip_non_succeeded' };
  }

  const currency = typeof refund.currency === 'string' ? refund.currency.toLowerCase() : '';
  if (currency !== 'usd') {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        eventId: event.id,
        eventType: event.type,
        outcome: 'refund_skip_currency',
        currency: refund.currency,
      }),
    );
    return { outcome: 'refund_skip_currency' };
  }

  const amountCents =
    typeof refund.amount === 'number' && Number.isFinite(refund.amount)
      ? Math.floor(refund.amount)
      : 0;
  if (amountCents <= 0) {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        eventId: event.id,
        eventType: event.type,
        outcome: 'refund_skip_zero_amount',
      }),
    );
    return { outcome: 'refund_skip_zero_amount' };
  }

  const piId = paymentIntentIdFromValue(refund.payment_intent);
  if (!piId) {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        eventId: event.id,
        eventType: event.type,
        outcome: 'refund_skip_no_payment_intent',
      }),
    );
    return { outcome: 'refund_skip_no_payment_intent' };
  }

  const md = await fetchPaymentIntentMetadata(stripe, piId);
  if (!md || !md.contestId || !md.uid) {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        eventId: event.id,
        eventType: event.type,
        outcome: 'refund_not_contest_metadata',
      }),
    );
    return { outcome: 'refund_not_contest_metadata' };
  }

  const { contestId, uid } = md;
  const processedRef = db.doc(`${PROCESSED_STRIPE_EVENTS}/${event.id}`);
  const pre = await processedRef.get();
  if (pre.exists) {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        severity: 'INFO',
        requestId,
        eventId: event.id,
        eventType: event.type,
        contestId,
        uid,
        outcome: 'duplicate_stripe_event',
      }),
    );
    return { outcome: 'duplicate_stripe_event', contestId, uid };
  }

  const contestRef = db.doc(`contests/${contestId}`);
  const entryRef = db.doc(`contests/${contestId}/entries/${uid}`);
  const ledgerRef = db.doc(`ledgerEntries/${event.id}`);

  let outcome = 'ok';
  let ledgerWritten = false;

  await db.runTransaction(async (tx) => {
    const [pSnap, lSnap, cSnap, eSnap] = await Promise.all([
      tx.get(processedRef),
      tx.get(ledgerRef),
      tx.get(contestRef),
      tx.get(entryRef),
    ]);

    if (pSnap.exists) {
      outcome = 'duplicate_stripe_event';
      return;
    }
    if (lSnap.exists) {
      tx.set(
        processedRef,
        {
          outcome: 'refund_duplicate_ledger_row',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'refund_duplicate_ledger_row';
      return;
    }

    if (!cSnap.exists) {
      tx.set(
        processedRef,
        {
          outcome: 'refund_no_contest',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'refund_no_contest';
      return;
    }

    const contest = cSnap.data();
    const contestFee = getEntryFeeCentsFromContest(
      contest && typeof contest === 'object'
        ? /** @type {Record<string, unknown>} */ (contest)
        : {},
    );
    if (contestFee <= 0) {
      tx.set(
        processedRef,
        {
          outcome: 'refund_ignored_free_contest',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'refund_ignored_free_contest';
      return;
    }

    if (!eSnap.exists) {
      tx.set(
        processedRef,
        {
          outcome: 'refund_no_entry',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'refund_no_entry';
      return;
    }

    const ex = /** @type {Record<string, unknown>} */ (eSnap.data() ?? {});
    const ps = ex.paymentStatus;
    if (ps !== 'paid' && ps !== 'refunded') {
      tx.set(
        processedRef,
        {
          outcome: 'refund_skip_entry_not_paid',
          contestId,
          uid,
          paymentStatus: ps ?? null,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'refund_skip_entry_not_paid';
      return;
    }

    const entryPi =
      typeof ex.stripePaymentIntentId === 'string' ? ex.stripePaymentIntentId : null;
    if (entryPi && entryPi !== piId) {
      tx.set(
        processedRef,
        {
          outcome: 'refund_pi_mismatch',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'refund_pi_mismatch';
      return;
    }

    const snapshot =
      typeof ex.entryFeeCentsSnapshot === 'number' && Number.isFinite(ex.entryFeeCentsSnapshot)
        ? Math.floor(ex.entryFeeCentsSnapshot)
        : contestFee;
    const prevRefunded =
      typeof ex.refundedAmountCents === 'number' && Number.isFinite(ex.refundedAmountCents)
        ? Math.max(0, Math.floor(ex.refundedAmountCents))
        : 0;
    if (prevRefunded >= snapshot) {
      tx.set(
        processedRef,
        {
          outcome: 'refund_skip_already_fully_refunded',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'refund_skip_already_fully_refunded';
      return;
    }

    const nextRefunded = Math.min(snapshot, prevRefunded + amountCents);
    const paymentStatus = nextRefunded >= snapshot ? 'refunded' : 'paid';

    tx.set(ledgerRef, {
      schemaVersion: LEDGER_SCHEMA_VERSION,
      uid,
      contestId,
      entryPathHint: `contests/${contestId}/entries/${uid}`,
      lineType: 'contest_entry_refund',
      direction: 'debit',
      amountCents,
      currency: 'usd',
      stripeEventId: event.id,
      stripeObjectType: 'refund',
      stripeObjectId: typeof refund.id === 'string' ? refund.id : null,
      source: 'webhook',
      createdAt: FieldValue.serverTimestamp(),
      metadata: {
        paymentIntentId: piId,
        refundId: typeof refund.id === 'string' ? refund.id : undefined,
      },
    });
    ledgerWritten = true;

    tx.set(
      entryRef,
      {
        schemaVersion: ENTRY_SCHEMA_PHASE5,
        paymentStatus,
        refundedAmountCents: nextRefunded,
        lastStripeEventId: event.id,
      },
      { merge: true },
    );

    tx.set(
      processedRef,
      {
        outcome: 'refund_ok',
        contestId,
        uid,
        stripeEventType: event.type,
        refundId: refund.id,
        amountCents,
        ledgerWritten: true,
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    outcome = 'refund_ok';
  });

  console.log(
    JSON.stringify({
      component: 'stripe_webhook',
      requestId,
      eventId: event.id,
      eventType: event.type,
      contestId,
      uid,
      outcome,
      ledgerWritten,
    }),
  );

  return { outcome, contestId, uid, ledgerWritten };
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').Stripe} stripe
 * @param {import('stripe').Stripe.Event} event
 * @param {string} requestId
 */
async function processChargeRefunded(db, stripe, event, requestId) {
  const charge = /** @type {import('stripe').Stripe.Charge} */ (event.data.object);
  const piId = paymentIntentIdFromValue(charge.payment_intent);
  if (!piId) {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        eventId: event.id,
        eventType: event.type,
        outcome: 'charge_refunded_skip_no_pi',
      }),
    );
    return { outcome: 'charge_refunded_skip_no_pi' };
  }

  const md = await fetchPaymentIntentMetadata(stripe, piId);
  if (!md || !md.contestId || !md.uid) {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        eventId: event.id,
        eventType: event.type,
        outcome: 'charge_refunded_not_contest_metadata',
      }),
    );
    return { outcome: 'charge_refunded_not_contest_metadata' };
  }

  const { contestId, uid } = md;
  const amountRefunded =
    typeof charge.amount_refunded === 'number' && Number.isFinite(charge.amount_refunded)
      ? Math.floor(charge.amount_refunded)
      : 0;
  const chargeAmount =
    typeof charge.amount === 'number' && Number.isFinite(charge.amount)
      ? Math.floor(charge.amount)
      : 0;
  const cur = (typeof charge.currency === 'string' ? charge.currency : '').toLowerCase();
  const isFullChargeRefund =
    chargeAmount > 0 && amountRefunded >= chargeAmount && cur === 'usd';

  if (!isFullChargeRefund) {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        eventId: event.id,
        eventType: event.type,
        contestId,
        uid,
        outcome: 'charge_refunded_skip_partial_or_non_usd',
        amountRefunded,
        chargeAmount,
        currency: charge.currency,
      }),
    );
    return { outcome: 'charge_refunded_skip_partial_or_non_usd', contestId, uid };
  }

  const processedRef = db.doc(`${PROCESSED_STRIPE_EVENTS}/${event.id}`);
  const pre = await processedRef.get();
  if (pre.exists) {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        severity: 'INFO',
        requestId,
        eventId: event.id,
        eventType: event.type,
        contestId,
        uid,
        outcome: 'duplicate_stripe_event',
      }),
    );
    return { outcome: 'duplicate_stripe_event', contestId, uid };
  }

  const contestRef = db.doc(`contests/${contestId}`);
  const entryRef = db.doc(`contests/${contestId}/entries/${uid}`);
  let outcome = 'ok';

  await db.runTransaction(async (tx) => {
    const [pSnap, cSnap, eSnap] = await Promise.all([
      tx.get(processedRef),
      tx.get(contestRef),
      tx.get(entryRef),
    ]);

    if (pSnap.exists) {
      outcome = 'duplicate_stripe_event';
      return;
    }

    if (!cSnap.exists) {
      tx.set(
        processedRef,
        {
          outcome: 'charge_refunded_no_contest',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'charge_refunded_no_contest';
      return;
    }

    const contest = cSnap.data();
    const contestFee = getEntryFeeCentsFromContest(
      contest && typeof contest === 'object'
        ? /** @type {Record<string, unknown>} */ (contest)
        : {},
    );
    if (contestFee <= 0) {
      tx.set(
        processedRef,
        {
          outcome: 'charge_refunded_ignored_free_contest',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'charge_refunded_ignored_free_contest';
      return;
    }

    if (!eSnap.exists) {
      tx.set(
        processedRef,
        {
          outcome: 'charge_refunded_no_entry',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'charge_refunded_no_entry';
      return;
    }

    const ex = /** @type {Record<string, unknown>} */ (eSnap.data() ?? {});
    const ps = ex.paymentStatus;
    if (ps !== 'paid' && ps !== 'refunded') {
      tx.set(
        processedRef,
        {
          outcome: 'charge_refunded_skip_entry_not_paid',
          contestId,
          uid,
          paymentStatus: ps ?? null,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'charge_refunded_skip_entry_not_paid';
      return;
    }

    const entryPi =
      typeof ex.stripePaymentIntentId === 'string' ? ex.stripePaymentIntentId : null;
    if (entryPi && entryPi !== piId) {
      tx.set(
        processedRef,
        {
          outcome: 'charge_refunded_pi_mismatch',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'charge_refunded_pi_mismatch';
      return;
    }

    // Do not set `refundedAmountCents` here — `refund.updated` (succeeded) is the source of truth
    // for cumulative cents + ledger lines. This handler only marks the entry refunded when the
    // Stripe Charge is fully refunded (e.g. Dashboard full refund before `refund.updated` lands).
    tx.set(
      entryRef,
      {
        schemaVersion: ENTRY_SCHEMA_PHASE5,
        paymentStatus: 'refunded',
        lastStripeEventId: event.id,
      },
      { merge: true },
    );

    tx.set(
      processedRef,
      {
        outcome: 'charge_refunded_entry_synced',
        contestId,
        uid,
        stripeEventType: event.type,
        ledgerWritten: false,
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    outcome = 'charge_refunded_entry_synced';
  });

  console.log(
    JSON.stringify({
      component: 'stripe_webhook',
      requestId,
      eventId: event.id,
      eventType: event.type,
      contestId,
      uid,
      outcome,
      ledgerWritten: false,
    }),
  );

  return { outcome, contestId, uid, ledgerWritten: false };
}
