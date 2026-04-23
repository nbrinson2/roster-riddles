/**
 * Phase 5 Story P5-E2 — Contest entry fee failure webhooks (no ledger credits).
 * @see docs/weekly-contests/weekly-contests-phase5-payments-jira.md
 * @see docs/weekly-contests/weekly-contests-phase5-webhooks.md
 */
import { FieldValue } from 'firebase-admin/firestore';
import { getEntryFeeCentsFromContest } from '../contests/contest-checkout.http.js';
import {
  PROCESSED_STRIPE_EVENTS,
  stripeContestMetadataToRecord,
} from './stripe-webhook-contest-payment.js';

const ENTRY_SCHEMA_PHASE5 = 2;

/**
 * @param {import('stripe').Stripe.Checkout.Session} session
 * @returns {string | null}
 */
function paymentIntentIdFromSession(session) {
  const pi = session.payment_intent;
  if (typeof pi === 'string' && pi.startsWith('pi_')) {
    return pi;
  }
  if (
    pi &&
    typeof pi === 'object' &&
    'id' in pi &&
    typeof /** @type {{ id?: string }} */ (pi).id === 'string'
  ) {
    const id = /** @type {{ id: string }} */ (pi).id;
    if (id.startsWith('pi_')) {
      return id;
    }
  }
  return null;
}

/**
 * @param {import('stripe').Stripe.Event} event
 * @returns {{
 *   sourceEventType: string;
 *   contestId: string;
 *   uid: string;
 *   paymentIntentId: string | null;
 *   checkoutSessionId: string | null;
 * } | null}
 */
export function extractContestPaymentFailurePayload(event) {
  const t = event.type;
  if (t === 'payment_intent.payment_failed') {
    const pi = /** @type {import('stripe').Stripe.PaymentIntent} */ (event.data.object);
    const md = stripeContestMetadataToRecord(pi.metadata);
    if (!md.contestId || !md.uid) {
      return null;
    }
    if (typeof pi.id !== 'string' || !pi.id.startsWith('pi_')) {
      return null;
    }
    return {
      sourceEventType: t,
      contestId: md.contestId,
      uid: md.uid,
      paymentIntentId: pi.id,
      checkoutSessionId: null,
    };
  }

  if (t === 'checkout.session.async_payment_failed' || t === 'checkout.session.expired') {
    const session = /** @type {import('stripe').Stripe.Checkout.Session} */ (
      event.data.object
    );
    if (session.mode !== 'payment') {
      return null;
    }
    const md = stripeContestMetadataToRecord(session.metadata);
    if (!md.contestId || !md.uid) {
      return null;
    }
    const checkoutSessionId =
      typeof session.id === 'string' && session.id.startsWith('cs_') ? session.id : null;
    return {
      sourceEventType: t,
      contestId: md.contestId,
      uid: md.uid,
      paymentIntentId: paymentIntentIdFromSession(session),
      checkoutSessionId,
    };
  }

  return null;
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').Stripe.Event} event
 * @param {string} requestId
 * @returns {Promise<{ outcome: string; contestId?: string; uid?: string }>}
 */
export async function processContestPaymentFailureWebhook(db, event, requestId) {
  const payload = extractContestPaymentFailurePayload(event);
  if (!payload) {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        eventId: event.id,
        eventType: event.type,
        outcome: 'not_contest_failure_payload',
      }),
    );
    return { outcome: 'not_contest_failure_payload' };
  }

  const { contestId, uid } = payload;
  const processedRef = db.doc(`${PROCESSED_STRIPE_EVENTS}/${event.id}`);
  const contestRef = db.doc(`contests/${contestId}`);
  const entryRef = db.doc(`contests/${contestId}/entries/${uid}`);

  const preProcessed = await processedRef.get();
  if (preProcessed.exists) {
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
          outcome: 'failure_no_contest',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'failure_no_contest';
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
          outcome: 'failure_ignored_free_contest',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'failure_ignored_free_contest';
      return;
    }

    if (!eSnap.exists) {
      tx.set(
        processedRef,
        {
          outcome: 'failure_no_entry',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'failure_no_entry';
      return;
    }

    const existing = eSnap.data();
    const ex =
      existing && typeof existing === 'object'
        ? /** @type {Record<string, unknown>} */ (existing)
        : undefined;
    const ps = ex?.paymentStatus;

    if (ps === 'paid' || ps === 'free' || ps === 'refunded') {
      tx.set(
        processedRef,
        {
          outcome: 'failure_skip_terminal_entry',
          contestId,
          uid,
          paymentStatus: ps,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'failure_skip_terminal_entry';
      return;
    }

    if (ps !== 'pending' && ps !== 'failed') {
      tx.set(
        processedRef,
        {
          outcome: 'failure_skipped_legacy_entry',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'failure_skipped_legacy_entry';
      return;
    }

    /** @type {Record<string, unknown>} */
    const entryPatch = {
      schemaVersion: ENTRY_SCHEMA_PHASE5,
      paymentStatus: 'failed',
      lastStripeEventId: event.id,
    };
    if (payload.paymentIntentId) {
      entryPatch.stripePaymentIntentId = payload.paymentIntentId;
    }
    if (payload.checkoutSessionId) {
      entryPatch.stripeCheckoutSessionId = payload.checkoutSessionId;
    }

    tx.set(entryRef, entryPatch, { merge: true });
    tx.set(
      processedRef,
      {
        outcome: 'failure_entry_marked_failed',
        contestId,
        uid,
        stripeEventType: event.type,
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    outcome = 'failure_entry_marked_failed';
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
    }),
  );

  return { outcome, contestId, uid };
}
