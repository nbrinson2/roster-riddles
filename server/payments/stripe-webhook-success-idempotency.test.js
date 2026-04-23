/**
 * Phase 5 Story P5-H3 — Success webhook idempotency with in-memory Firestore (no emulator).
 */
import assert from 'node:assert/strict';
import { Timestamp } from 'firebase-admin/firestore';
import { describe, it } from 'node:test';
import { processContestPaymentSuccessWebhook } from './stripe-webhook-contest-payment.js';

/**
 * Minimal Firestore double for {@link processContestPaymentSuccessWebhook}.
 * @returns {{ db: import('firebase-admin/firestore').Firestore; store: Record<string, Record<string, unknown>> }}
 */
function createMemoryFirestore() {
  /** @type {Record<string, Record<string, unknown>>} */
  const committed = Object.create(null);

  /**
   * @param {string} path
   */
  function doc(path) {
    const ref = {
      _path: path,
      collection(name) {
        return {
          doc(id) {
            return doc(`${path}/${name}/${id}`);
          },
        };
      },
      async get() {
        const v = committed[path];
        if (!v) {
          return { exists: false, data: () => undefined };
        }
        return {
          exists: true,
          data: () => /** @type {FirebaseFirestore.DocumentData} */ ({ ...v }),
        };
      },
      /**
       * @param {Record<string, unknown>} data
       * @param {{ merge?: boolean }} [opts]
       */
      async set(data, opts) {
        const cur = committed[path] ?? {};
        committed[path] =
          opts?.merge && typeof cur === 'object'
            ? { ...cur, ...data }
            : { ...data };
      },
    };
    return ref;
  }

  const db = {
    doc: (/** @type {string} */ p) => doc(p),
    /**
     * @param {(tx: {
     *   get: (r: { _path: string }) => Promise<{ exists: boolean; data: () => unknown }>;
     *   set: (r: { _path: string }, data: Record<string, unknown>, opts?: { merge?: boolean }) => void;
     * }) => Promise<void>} fn
     */
    async runTransaction(fn) {
      /** @type {Record<string, Record<string, unknown>>} */
      const overlay = Object.create(null);
      const hasOverlay = (/** @type {string} */ p) =>
        Object.prototype.hasOwnProperty.call(overlay, p);
      const readPath = (/** @type {string} */ p) =>
        hasOverlay(p) ? overlay[p] : committed[p];
      const tx = {
        async get(/** @type {{ _path: string }} */ r) {
          const p = r._path;
          const v = readPath(p);
          if (!v) {
            return { exists: false, data: () => undefined };
          }
          return {
            exists: true,
            data: () => ({ ...v }),
          };
        },
        set(
          /** @type {{ _path: string }} */ r,
          /** @type {Record<string, unknown>} */ data,
          /** @type {{ merge?: boolean }} */ opts,
        ) {
          const p = r._path;
          const prev = hasOverlay(p) ? overlay[p] : committed[p];
          const base = prev && typeof prev === 'object' ? { ...prev } : {};
          overlay[p] = opts?.merge ? { ...base, ...data } : { ...data };
        },
      };
      await fn(tx);
      for (const [k, v] of Object.entries(overlay)) {
        committed[k] = v;
      }
    },
  };

  return { db: /** @type {import('firebase-admin/firestore').Firestore} */ (db), store: committed };
}

function contestDocOpenWithFee(feeCents) {
  const now = Timestamp.now();
  return {
    status: 'open',
    gameMode: 'bio-ball',
    leagueGamesN: 5,
    rulesVersion: 1,
    entryFeeCents: feeCents,
    windowStart: Timestamp.fromMillis(now.toMillis() - 120_000),
    windowEnd: Timestamp.fromMillis(now.toMillis() + 120_000),
  };
}

/**
 * @param {string} eventId
 * @param {string} piId
 */
function checkoutCompletedEvent(eventId, piId) {
  return /** @type {import('stripe').Stripe.Event} */ ({
    id: eventId,
    type: 'checkout.session.completed',
    data: {
      object: {
        mode: 'payment',
        payment_status: 'paid',
        id: 'cs_test_h3',
        amount_total: 2500,
        payment_intent: piId,
        customer: 'cus_test_h3',
        metadata: {
          contestId: 'c_h3',
          uid: 'user_h3',
          entryFeeCents: '2500',
          rulesAcceptedVersion: '1',
        },
      },
    },
  });
}

/**
 * @param {string} eventId
 * @param {string} piId
 */
function paymentIntentSucceededEvent(eventId, piId) {
  return /** @type {import('stripe').Stripe.Event} */ ({
    id: eventId,
    type: 'payment_intent.succeeded',
    data: {
      object: {
        id: piId,
        amount_received: 2500,
        customer: 'cus_test_h3',
        metadata: {
          contestId: 'c_h3',
          uid: 'user_h3',
          entryFeeCents: '2500',
          rulesAcceptedVersion: '1',
        },
      },
    },
  });
}

describe('processContestPaymentSuccessWebhook idempotency (P5-H3)', () => {
  it('second delivery of same Stripe event id is duplicate_stripe_event (no extra ledger doc)', async () => {
    const { db, store } = createMemoryFirestore();
    store['contests/c_h3'] = contestDocOpenWithFee(2500);
    const evt = checkoutCompletedEvent('evt_dup_1', 'pi_dup_1');

    const r1 = await processContestPaymentSuccessWebhook(db, evt, 'req-1');
    assert.equal(r1.outcome, 'ok');
    assert.equal(r1.ledgerWritten, true);
    assert.ok(store['ledgerEntries/evt_dup_1']);

    const r2 = await processContestPaymentSuccessWebhook(db, evt, 'req-2');
    assert.equal(r2.outcome, 'duplicate_stripe_event');
    const ledgerKeys = Object.keys(store).filter((k) => k.startsWith('ledgerEntries/'));
    assert.equal(ledgerKeys.length, 1, 'only one ledger document');
  });

  it('companion PI success event does not write a second fee ledger line', async () => {
    const { db, store } = createMemoryFirestore();
    store['contests/c_h3'] = contestDocOpenWithFee(2500);
    const piId = 'pi_companion_1';

    const rCs = await processContestPaymentSuccessWebhook(
      db,
      checkoutCompletedEvent('evt_cs_comp', piId),
      'req-cs',
    );
    assert.equal(rCs.outcome, 'ok');
    assert.equal(rCs.ledgerWritten, true);

    const rPi = await processContestPaymentSuccessWebhook(
      db,
      paymentIntentSucceededEvent('evt_pi_comp', piId),
      'req-pi',
    );
    assert.ok(
      rPi.outcome === 'ok_duplicate_pi_event' ||
        rPi.outcome === 'already_paid_same_payment_intent',
      `expected duplicate-safe outcome, got ${rPi.outcome}`,
    );
    assert.equal(rPi.ledgerWritten, false);

    const ledgerKeys = Object.keys(store).filter((k) => k.startsWith('ledgerEntries/'));
    assert.deepEqual(ledgerKeys.sort(), ['ledgerEntries/evt_cs_comp']);
  });
});
