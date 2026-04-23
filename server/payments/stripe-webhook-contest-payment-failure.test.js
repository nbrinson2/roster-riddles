import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { extractContestPaymentFailurePayload } from './stripe-webhook-contest-payment-failure.js';

describe('extractContestPaymentFailurePayload', () => {
  it('parses payment_intent.payment_failed', () => {
    const p = extractContestPaymentFailurePayload(
      /** @type {import('stripe').Stripe.Event} */ ({
        type: 'payment_intent.payment_failed',
        data: {
          object: {
            id: 'pi_fail_1',
            metadata: { contestId: 'c1', uid: 'u1' },
          },
        },
      }),
    );
    assert.ok(p);
    assert.equal(p.contestId, 'c1');
    assert.equal(p.uid, 'u1');
    assert.equal(p.paymentIntentId, 'pi_fail_1');
    assert.equal(p.checkoutSessionId, null);
  });

  it('parses checkout.session.expired', () => {
    const p = extractContestPaymentFailurePayload(
      /** @type {import('stripe').Stripe.Event} */ ({
        type: 'checkout.session.expired',
        data: {
          object: {
            mode: 'payment',
            id: 'cs_exp_1',
            payment_intent: 'pi_x',
            metadata: { contestId: 'c2', uid: 'u2' },
          },
        },
      }),
    );
    assert.ok(p);
    assert.equal(p.checkoutSessionId, 'cs_exp_1');
    assert.equal(p.paymentIntentId, 'pi_x');
  });

  it('parses checkout.session.async_payment_failed', () => {
    const p = extractContestPaymentFailurePayload(
      /** @type {import('stripe').Stripe.Event} */ ({
        type: 'checkout.session.async_payment_failed',
        data: {
          object: {
            mode: 'payment',
            id: 'cs_async_1',
            metadata: { contestId: 'c3', uid: 'u3' },
          },
        },
      }),
    );
    assert.ok(p);
    assert.equal(p.sourceEventType, 'checkout.session.async_payment_failed');
  });

  it('returns null without contest metadata', () => {
    assert.equal(
      extractContestPaymentFailurePayload(
        /** @type {import('stripe').Stripe.Event} */ ({
          type: 'payment_intent.payment_failed',
          data: { object: { id: 'pi_x', metadata: {} } },
        }),
      ),
      null,
    );
  });

  it('returns null for subscription checkout session', () => {
    assert.equal(
      extractContestPaymentFailurePayload(
        /** @type {import('stripe').Stripe.Event} */ ({
          type: 'checkout.session.expired',
          data: {
            object: {
              mode: 'subscription',
              id: 'cs_sub',
              metadata: { contestId: 'c', uid: 'u' },
            },
          },
        }),
      ),
      null,
    );
  });
});
