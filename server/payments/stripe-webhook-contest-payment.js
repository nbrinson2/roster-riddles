/**
 * Phase 5 Story P5-E1 — `checkout.session.completed` / `payment_intent.succeeded`:
 * idempotent entry + ledger writes for contest entry fees.
 * @see docs/weekly-contests/weekly-contests-phase5-payments-jira.md
 * @see docs/weekly-contests/weekly-contests-phase5-entry-fees-adr.md
 */
import admin from 'firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { fetchAuthFieldsForUids } from '../lib/auth-display-names.js';
import { getEntryFeeCentsFromContest } from '../contests/contest-checkout.http.js';

/** Top-level idempotency marker (Stripe `evt_...` redelivery). */
export const PROCESSED_STRIPE_EVENTS = 'processedStripeEvents';

/**
 * Per–PaymentIntent settlement under a contest — prevents two ledger credits when both
 * `checkout.session.completed` and `payment_intent.succeeded` are delivered for one Checkout payment.
 */
export const STRIPE_PI_SETTLEMENTS = 'stripePiSettlements';

const LEDGER_SCHEMA_VERSION = 1;
const ENTRY_SCHEMA_PHASE5 = 2;

/**
 * @param {Record<string, string> | null | undefined} meta
 * @returns {Record<string, string>}
 */
function metadataToRecord(meta) {
  if (!meta || typeof meta !== 'object') {
    return {};
  }
  /** @type {Record<string, string>} */
  const out = {};
  for (const [k, v] of Object.entries(meta)) {
    if (typeof v === 'string' && v.length > 0) {
      out[k] = v;
    }
  }
  return out;
}

/**
 * @param {string | undefined} s
 * @returns {number | string}
 */
export function parseRulesAcceptedVersionFromMetadata(s) {
  if (s == null || s === '') {
    return 1;
  }
  const t = String(s).trim();
  if (/^\d+$/.test(t)) {
    return parseInt(t, 10);
  }
  return t;
}

/**
 * @param {Record<string, string>} md
 * @returns {number | null}
 */
export function parseEntryFeeCentsFromMetadata(md) {
  const raw = md.entryFeeCents;
  if (raw == null || raw === '') {
    return null;
  }
  const n = Number.parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n < 1) {
    return null;
  }
  return n;
}

/**
 * @param {import('stripe').Stripe.Event} event
 * @returns {{
 *   sourceEventType: string;
 *   contestId: string;
 *   uid: string;
 *   metadata: Record<string, string>;
 *   amountCentsPaid: number;
 *   paymentIntentId: string;
 *   checkoutSessionId: string | null;
 *   customerId: string | null;
 * } | null}
 */
export function extractContestPaymentPayloadFromStripeEvent(event) {
  const t = event.type;
  if (t === 'checkout.session.completed') {
    const session = /** @type {import('stripe').Stripe.Checkout.Session} */ (
      event.data.object
    );
    if (session.mode !== 'payment') {
      return null;
    }
    if (session.payment_status !== 'paid') {
      return null;
    }
    const md = metadataToRecord(session.metadata);
    const contestId = md.contestId;
    const uid = md.uid;
    if (!contestId || !uid) {
      return null;
    }
    const amountTotal = session.amount_total;
    if (typeof amountTotal !== 'number' || !Number.isFinite(amountTotal)) {
      return null;
    }
    let paymentIntentId = null;
    const pi = session.payment_intent;
    if (typeof pi === 'string' && pi.startsWith('pi_')) {
      paymentIntentId = pi;
    } else if (
      pi &&
      typeof pi === 'object' &&
      'id' in pi &&
      typeof /** @type {{ id?: string }} */ (pi).id === 'string'
    ) {
      const id = /** @type {{ id: string }} */ (pi).id;
      if (id.startsWith('pi_')) {
        paymentIntentId = id;
      }
    }
    if (!paymentIntentId) {
      return null;
    }
    const customer =
      typeof session.customer === 'string' && session.customer.startsWith('cus_')
        ? session.customer
        : null;
    return {
      sourceEventType: t,
      contestId,
      uid,
      metadata: md,
      amountCentsPaid: Math.floor(amountTotal),
      paymentIntentId,
      checkoutSessionId:
        typeof session.id === 'string' && session.id.startsWith('cs_')
          ? session.id
          : null,
      customerId: customer,
    };
  }

  if (t === 'payment_intent.succeeded') {
    const pi = /** @type {import('stripe').Stripe.PaymentIntent} */ (event.data.object);
    const md = metadataToRecord(pi.metadata);
    const contestId = md.contestId;
    const uid = md.uid;
    if (!contestId || !uid) {
      return null;
    }
    const received = pi.amount_received;
    if (typeof received !== 'number' || !Number.isFinite(received)) {
      return null;
    }
    if (typeof pi.id !== 'string' || !pi.id.startsWith('pi_')) {
      return null;
    }
    const customer =
      typeof pi.customer === 'string' && pi.customer.startsWith('cus_')
        ? pi.customer
        : null;
    return {
      sourceEventType: t,
      contestId,
      uid,
      metadata: md,
      amountCentsPaid: Math.floor(received),
      paymentIntentId: pi.id,
      checkoutSessionId: null,
      customerId: customer,
    };
  }

  return null;
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').Stripe.Event} event
 * @param {string} requestId
 * @returns {Promise<{ outcome: string; contestId?: string; uid?: string; ledgerWritten?: boolean }>}
 */
export async function processContestPaymentSuccessWebhook(db, event, requestId) {
  const payload = extractContestPaymentPayloadFromStripeEvent(event);
  if (!payload) {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        eventId: event.id,
        eventType: event.type,
        outcome: 'not_contest_checkout_payload',
      }),
    );
    return { outcome: 'not_contest_checkout_payload' };
  }

  const { contestId, uid, paymentIntentId } = payload;
  const entryFeeFromMeta = parseEntryFeeCentsFromMetadata(payload.metadata);
  if (entryFeeFromMeta == null) {
    await markProcessedRejected(db, event.id, {
      outcome: 'rejected',
      reason: 'invalid_entry_fee_metadata',
      contestId,
      uid,
      sourceEventType: payload.sourceEventType,
    }, requestId);
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        eventId: event.id,
        eventType: event.type,
        contestId,
        uid,
        outcome: 'invalid_entry_fee_metadata',
      }),
    );
    return { outcome: 'invalid_entry_fee_metadata', contestId, uid };
  }

  const contestRef = db.doc(`contests/${contestId}`);
  const entryRef = db.doc(`contests/${contestId}/entries/${uid}`);
  const processedRef = db.doc(`${PROCESSED_STRIPE_EVENTS}/${event.id}`);
  const settlementRef = contestRef.collection(STRIPE_PI_SETTLEMENTS).doc(paymentIntentId);
  const ledgerRef = db.doc(`ledgerEntries/${event.id}`);

  let authDisplayName = null;
  try {
    const auth = admin.auth();
    const m = await fetchAuthFieldsForUids([uid], auth);
    authDisplayName = m.get(uid)?.displayName ?? null;
  } catch {
    authDisplayName = null;
  }

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
  let ledgerWritten = false;

  await db.runTransaction(async (tx) => {
    const [pSnap, cSnap, eSnap, sSnap, lSnap] = await Promise.all([
      tx.get(processedRef),
      tx.get(contestRef),
      tx.get(entryRef),
      tx.get(settlementRef),
      tx.get(ledgerRef),
    ]);

    if (pSnap.exists) {
      outcome = 'duplicate_stripe_event';
      return;
    }
    if (lSnap.exists) {
      tx.set(
        processedRef,
        {
          outcome: 'duplicate_ledger_row',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'duplicate_ledger_row';
      return;
    }

    if (!cSnap.exists) {
      tx.set(
        processedRef,
        {
          outcome: 'rejected',
          reason: 'contest_not_found',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'contest_not_found';
      return;
    }

    const contest = cSnap.data();
    const contestFee = getEntryFeeCentsFromContest(
      contest && typeof contest === 'object' ? /** @type {Record<string, unknown>} */ (contest) : {},
    );
    if (contestFee <= 0) {
      tx.set(
        processedRef,
        {
          outcome: 'rejected',
          reason: 'contest_not_paid_entry',
          contestId,
          uid,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'contest_not_paid_entry';
      return;
    }
    if (contestFee !== entryFeeFromMeta) {
      tx.set(
        processedRef,
        {
          outcome: 'rejected',
          reason: 'fee_metadata_mismatch_contest',
          contestId,
          uid,
          contestFeeCents: contestFee,
          metadataFeeCents: entryFeeFromMeta,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'fee_metadata_mismatch_contest';
      return;
    }
    if (payload.amountCentsPaid !== entryFeeFromMeta) {
      tx.set(
        processedRef,
        {
          outcome: 'rejected',
          reason: 'amount_mismatch',
          contestId,
          uid,
          amountCentsPaid: payload.amountCentsPaid,
          expectedCents: entryFeeFromMeta,
          stripeEventType: event.type,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'amount_mismatch';
      return;
    }

    const existing = eSnap.exists ? eSnap.data() : undefined;
    const ex =
      existing && typeof existing === 'object'
        ? /** @type {Record<string, unknown>} */ (existing)
        : undefined;

    if (ex) {
      const ps = ex.paymentStatus;
      if (ps === 'paid') {
        const existingPi =
          typeof ex.stripePaymentIntentId === 'string' ? ex.stripePaymentIntentId : null;
        if (existingPi === paymentIntentId) {
          const entryPatch = {
            lastStripeEventId: event.id,
            ...(payload.checkoutSessionId &&
            (!ex.stripeCheckoutSessionId ||
              typeof ex.stripeCheckoutSessionId !== 'string')
              ? { stripeCheckoutSessionId: payload.checkoutSessionId }
              : {}),
            ...(payload.customerId && !ex.stripeCustomerId
              ? { stripeCustomerId: payload.customerId }
              : {}),
          };
          tx.set(entryRef, entryPatch, { merge: true });
          tx.set(
            processedRef,
            {
              outcome: 'already_paid_same_payment_intent',
              contestId,
              uid,
              paymentIntentId,
              stripeEventType: event.type,
              processedAt: FieldValue.serverTimestamp(),
            },
            { merge: true },
          );
          outcome = 'already_paid_same_payment_intent';
          return;
        }
        tx.set(
          processedRef,
          {
            outcome: 'rejected',
            reason: 'entry_paid_different_payment_intent',
            contestId,
            uid,
            stripeEventType: event.type,
            processedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        outcome = 'entry_paid_different_payment_intent';
        return;
      }
      if (ps === 'free' || ps === 'refunded') {
        tx.set(
          processedRef,
          {
            outcome: 'rejected',
            reason: 'entry_terminal_state_conflict',
            contestId,
            uid,
            paymentStatus: ps,
            stripeEventType: event.type,
            processedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        outcome = 'entry_terminal_state_conflict';
        return;
      }
    }

    const settlementExists = sSnap.exists;
    const writeLedger = !settlementExists;

    const rulesAcceptedVersion = parseRulesAcceptedVersionFromMetadata(
      payload.metadata.rulesAcceptedVersion,
    );
    const clientRequestId = payload.metadata.clientRequestId;

    const paidAt = FieldValue.serverTimestamp();
    const joinedAt =
      ex && ex.joinedAt != null ? ex.joinedAt : FieldValue.serverTimestamp();

    const resolvedDisplayName =
      ex &&
      (typeof ex.displayNameSnapshot === 'string' || ex.displayNameSnapshot === null)
        ? ex.displayNameSnapshot
        : authDisplayName;

    /** @type {Record<string, unknown>} */
    const entryWrite = {
      schemaVersion: ENTRY_SCHEMA_PHASE5,
      contestId,
      uid,
      rulesAcceptedVersion,
      joinedAt,
      displayNameSnapshot: resolvedDisplayName,
      paymentStatus: 'paid',
      entryFeeCentsSnapshot: entryFeeFromMeta,
      stripePaymentIntentId: paymentIntentId,
      stripeCheckoutSessionId: payload.checkoutSessionId,
      stripeCustomerId: payload.customerId,
      paidAt,
      lastStripeEventId: event.id,
      ...(clientRequestId ? { clientRequestId } : {}),
    };

    tx.set(entryRef, entryWrite, { merge: true });

    if (writeLedger) {
      tx.set(settlementRef, {
        firstLedgerStripeEventId: event.id,
        paymentIntentId,
        contestId,
        uid,
        amountCents: entryFeeFromMeta,
        currency: 'usd',
        createdAt: FieldValue.serverTimestamp(),
      });
      tx.set(ledgerRef, {
        schemaVersion: LEDGER_SCHEMA_VERSION,
        uid,
        contestId,
        entryPathHint: `contests/${contestId}/entries/${uid}`,
        lineType: 'contest_entry_charge',
        direction: 'credit',
        amountCents: entryFeeFromMeta,
        currency: 'usd',
        stripeEventId: event.id,
        stripeObjectType:
          payload.sourceEventType === 'checkout.session.completed'
            ? 'checkout.session'
            : 'payment_intent',
        stripeObjectId:
          payload.sourceEventType === 'checkout.session.completed'
            ? payload.checkoutSessionId ?? paymentIntentId
            : paymentIntentId,
        source: 'webhook',
        createdAt: FieldValue.serverTimestamp(),
        metadata: {
          paymentIntentId,
          ...(payload.checkoutSessionId
            ? { checkoutSessionId: payload.checkoutSessionId }
            : {}),
        },
      });
      ledgerWritten = true;
    }

    tx.set(
      processedRef,
      {
        outcome: writeLedger ? 'ok' : 'ok_duplicate_pi_event',
        contestId,
        uid,
        paymentIntentId,
        stripeEventType: event.type,
        ledgerWritten: writeLedger,
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
    outcome = writeLedger ? 'ok' : 'ok_duplicate_pi_event';
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
 * @param {string} eventId
 * @param {Record<string, unknown>} fields
 * @param {string} requestId
 */
async function markProcessedRejected(db, eventId, fields, requestId) {
  try {
    await db.doc(`${PROCESSED_STRIPE_EVENTS}/${eventId}`).set(
      {
        ...fields,
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    console.error(
      JSON.stringify({
        component: 'stripe_webhook',
        severity: 'ERROR',
        requestId,
        eventId,
        outcome: 'mark_processed_failed',
        message: e instanceof Error ? e.message : String(e),
      }),
    );
  }
}
