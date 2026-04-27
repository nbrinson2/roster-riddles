/**
 * Phase 6 Story P6-B3 — Stripe Connect `account.updated` → `users/{uid}` payout snapshot fields.
 * @see docs/weekly-contests/weekly-contests-phase5-webhooks.md (Phase 6 Connect section)
 * @see docs/weekly-contests/weekly-contests-schema-users-payouts.md (P6-C1 field names)
 */
import { FieldValue } from 'firebase-admin/firestore';
import {
  emitContestWebhookFailureMetric,
  logStripeWebhookLine,
} from './contest-payments-observability.js';
import { PROCESSED_STRIPE_EVENTS } from './stripe-webhook-contest-payment.js';

/** Max length for comma-joined `requirements.currently_due` keys (Firestore summary only). */
export const STRIPE_CONNECT_CURRENTLY_DUE_SUMMARY_MAX = 500;

/**
 * @param {unknown} requirements — Stripe Account `requirements` object
 * @returns {{ count: number; summary: string }}
 */
export function summarizeStripeConnectCurrentlyDue(requirements) {
  if (!requirements || typeof requirements !== 'object') {
    return { count: 0, summary: '' };
  }
  const rec = /** @type {Record<string, unknown>} */ (requirements);
  const due = rec.currently_due;
  if (!Array.isArray(due) || due.length === 0) {
    return { count: 0, summary: '' };
  }
  const parts = due.filter((x) => typeof x === 'string' && x.length > 0);
  const joined = parts.join(',');
  const maxLen = STRIPE_CONNECT_CURRENTLY_DUE_SUMMARY_MAX;
  const summary =
    joined.length <= maxLen ? joined : `${joined.slice(0, maxLen)}…`;
  return { count: parts.length, summary };
}

/**
 * @param {import('stripe').Stripe.Event} event
 * @returns {import('stripe').Stripe.Account | null}
 */
export function extractAccountFromAccountUpdatedEvent(event) {
  if (event.type !== 'account.updated') {
    return null;
  }
  const obj = event.data?.object;
  if (!obj || typeof obj !== 'object') {
    return null;
  }
  const id = /** @type {{ id?: unknown }} */ (obj).id;
  if (typeof id !== 'string' || !id.startsWith('acct_')) {
    return null;
  }
  return /** @type {import('stripe').Stripe.Account} */ (obj);
}

/**
 * @param {import('stripe').Stripe.Account} account
 * @param {string} eventId
 * @returns {Record<string, unknown>}
 */
export function buildUserConnectStatePatch(account, eventId) {
  const { count, summary } = summarizeStripeConnectCurrentlyDue(
    account.requirements,
  );
  /** @type {Record<string, unknown>} */
  const patch = {
    stripeConnectChargesEnabled: account.charges_enabled === true,
    stripeConnectPayoutsEnabled: account.payouts_enabled === true,
    stripeConnectDetailsSubmitted: account.details_submitted === true,
    stripeConnectRequirementsCurrentlyDueCount: count,
    stripeConnectRequirementsCurrentlyDueSummary: summary,
    stripeConnectLastWebhookEventId: eventId,
    stripeConnectLastAccountUpdatedAt: FieldValue.serverTimestamp(),
  };
  const typ = account.type;
  if (typ === 'express' || typ === 'standard' || typ === 'custom') {
    patch.stripeConnectAccountType = typ;
  }
  return patch;
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('stripe').Stripe.Event} event
 * @param {string} requestId
 * @returns {Promise<{ outcome: string; uid?: string; stripeAccountId?: string }>}
 */
export async function processStripeConnectAccountWebhook(db, event, requestId) {
  const account = extractAccountFromAccountUpdatedEvent(event);
  if (!account) {
    logStripeWebhookLine({
      requestId,
      eventId: event.id,
      eventType: event.type,
      outcome: 'connect_not_account_updated_payload',
    });
    return { outcome: 'connect_not_account_updated_payload' };
  }

  const stripeAccountId = account.id;
  const uidRaw = account.metadata?.firebase_uid;
  const uid = typeof uidRaw === 'string' ? uidRaw.trim() : '';

  const processedRef = db.doc(`${PROCESSED_STRIPE_EVENTS}/${event.id}`);

  const pre = await processedRef.get();
  if (pre.exists) {
    logStripeWebhookLine({
      requestId,
      eventId: event.id,
      eventType: event.type,
      uid: uid || undefined,
      stripeAccountId,
      outcome: 'connect_duplicate_stripe_event',
    });
    return { outcome: 'connect_duplicate_stripe_event', uid, stripeAccountId };
  }

  if (!uid) {
    await markConnectProcessed(
      db,
      event.id,
      {
        outcome: 'connect_rejected_missing_firebase_uid_metadata',
        stripeEventType: event.type,
        stripeAccountId,
      },
      requestId,
    );
    logStripeWebhookLine({
      requestId,
      eventId: event.id,
      eventType: event.type,
      stripeAccountId,
      outcome: 'connect_rejected_missing_firebase_uid_metadata',
    });
    return { outcome: 'connect_rejected_missing_firebase_uid_metadata', stripeAccountId };
  }

  const userRef = db.doc(`users/${uid}`);

  let outcome = 'connect_ok';

  try {
    await db.runTransaction(async (tx) => {
      const [pSnap, uSnap] = await Promise.all([
        tx.get(processedRef),
        tx.get(userRef),
      ]);

      if (pSnap.exists) {
        outcome = 'connect_duplicate_stripe_event';
        return;
      }

      if (!uSnap.exists) {
        tx.set(
          processedRef,
          {
            outcome: 'connect_rejected_user_doc_missing',
            stripeEventType: event.type,
            stripeAccountId,
            uid,
            processedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        outcome = 'connect_rejected_user_doc_missing';
        return;
      }

      const userData = uSnap.data();
      const stored =
        typeof userData?.stripeConnectAccountId === 'string'
          ? userData.stripeConnectAccountId.trim()
          : '';

      if (stored !== '' && stored !== stripeAccountId) {
        tx.set(
          processedRef,
          {
            outcome: 'connect_rejected_stored_account_mismatch',
            stripeEventType: event.type,
            stripeAccountId,
            storedStripeConnectAccountId: stored,
            uid,
            processedAt: FieldValue.serverTimestamp(),
          },
          { merge: true },
        );
        outcome = 'connect_rejected_stored_account_mismatch';
        return;
      }

      const patch = buildUserConnectStatePatch(account, event.id);
      if (stored === '') {
        patch.stripeConnectAccountId = stripeAccountId;
      }

      tx.set(userRef, patch, { merge: true });
      tx.set(
        processedRef,
        {
          outcome: 'connect_ok',
          stripeEventType: event.type,
          stripeAccountId,
          uid,
          processedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      outcome = 'connect_ok';
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logStripeWebhookLine({
      severity: 'ERROR',
      requestId,
      eventId: event.id,
      eventType: event.type,
      uid,
      stripeAccountId,
      outcome: 'connect_transaction_failed',
      message: msg,
    });
    emitContestWebhookFailureMetric({
      outcome: 'connect_transaction_failed',
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
    uid,
    stripeAccountId,
    outcome,
  });

  return { outcome, uid, stripeAccountId };
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} eventId
 * @param {Record<string, unknown>} fields
 * @param {string} requestId
 */
async function markConnectProcessed(db, eventId, fields, requestId) {
  try {
    await db.doc(`${PROCESSED_STRIPE_EVENTS}/${eventId}`).set(
      {
        ...fields,
        processedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  } catch (e) {
    logStripeWebhookLine({
      severity: 'ERROR',
      requestId,
      eventId,
      outcome: 'connect_mark_processed_failed',
      message: e instanceof Error ? e.message : String(e),
    });
    emitContestWebhookFailureMetric({
      outcome: 'connect_mark_processed_failed',
      requestId,
      eventId,
    });
  }
}
