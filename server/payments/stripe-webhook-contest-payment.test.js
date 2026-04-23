import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  extractContestPaymentPayloadFromStripeEvent,
  parseEntryFeeCentsFromMetadata,
  parseRulesAcceptedVersionFromMetadata,
} from './stripe-webhook-contest-payment.js';

describe('parseRulesAcceptedVersionFromMetadata', () => {
  it('defaults and parses numeric strings', () => {
    assert.equal(parseRulesAcceptedVersionFromMetadata(undefined), 1);
    assert.equal(parseRulesAcceptedVersionFromMetadata('2'), 2);
    assert.equal(parseRulesAcceptedVersionFromMetadata('v2'), 'v2');
  });
});

describe('parseEntryFeeCentsFromMetadata', () => {
  it('parses valid cents', () => {
    assert.equal(parseEntryFeeCentsFromMetadata({ entryFeeCents: '500' }), 500);
  });

  it('returns null when missing or invalid', () => {
    assert.equal(parseEntryFeeCentsFromMetadata({}), null);
    assert.equal(parseEntryFeeCentsFromMetadata({ entryFeeCents: '0' }), null);
    assert.equal(parseEntryFeeCentsFromMetadata({ entryFeeCents: 'x' }), null);
  });
});

describe('extractContestPaymentPayloadFromStripeEvent', () => {
  it('parses checkout.session.completed (payment, paid)', () => {
    const payload = extractContestPaymentPayloadFromStripeEvent(
      /** @type {import('stripe').Stripe.Event} */ ({
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'payment',
            payment_status: 'paid',
            id: 'cs_test_1',
            amount_total: 2500,
            payment_intent: 'pi_test_1',
            customer: 'cus_test_1',
            metadata: {
              contestId: 'c1',
              uid: 'user1',
              entryFeeCents: '2500',
              rulesAcceptedVersion: '1',
            },
          },
        },
      }),
    );
    assert.ok(payload);
    assert.equal(payload.contestId, 'c1');
    assert.equal(payload.uid, 'user1');
    assert.equal(payload.amountCentsPaid, 2500);
    assert.equal(payload.paymentIntentId, 'pi_test_1');
    assert.equal(payload.checkoutSessionId, 'cs_test_1');
    assert.equal(payload.customerId, 'cus_test_1');
  });

  it('returns null for subscription checkout', () => {
    const payload = extractContestPaymentPayloadFromStripeEvent(
      /** @type {import('stripe').Stripe.Event} */ ({
        type: 'checkout.session.completed',
        data: {
          object: {
            mode: 'subscription',
            payment_status: 'paid',
            id: 'cs_sub_1',
            amount_total: 100,
            metadata: { contestId: 'c1', uid: 'u1' },
          },
        },
      }),
    );
    assert.equal(payload, null);
  });

  it('parses payment_intent.succeeded with metadata', () => {
    const payload = extractContestPaymentPayloadFromStripeEvent(
      /** @type {import('stripe').Stripe.Event} */ ({
        type: 'payment_intent.succeeded',
        data: {
          object: {
            id: 'pi_test_2',
            amount_received: 100,
            metadata: {
              contestId: 'c2',
              uid: 'user2',
              entryFeeCents: '100',
            },
          },
        },
      }),
    );
    assert.ok(payload);
    assert.equal(payload.sourceEventType, 'payment_intent.succeeded');
    assert.equal(payload.paymentIntentId, 'pi_test_2');
    assert.equal(payload.checkoutSessionId, null);
    assert.equal(payload.amountCentsPaid, 100);
  });
});
