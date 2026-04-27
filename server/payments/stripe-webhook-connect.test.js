import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { FieldValue } from 'firebase-admin/firestore';
import {
  STRIPE_CONNECT_CURRENTLY_DUE_SUMMARY_MAX,
  buildUserConnectStatePatch,
  extractAccountFromAccountUpdatedEvent,
  summarizeStripeConnectCurrentlyDue,
} from './stripe-webhook-connect.js';

describe('summarizeStripeConnectCurrentlyDue (P6-B3)', () => {
  it('returns empty when missing or not array', () => {
    assert.deepEqual(summarizeStripeConnectCurrentlyDue(undefined), {
      count: 0,
      summary: '',
    });
    assert.deepEqual(summarizeStripeConnectCurrentlyDue({}), {
      count: 0,
      summary: '',
    });
    assert.deepEqual(
      summarizeStripeConnectCurrentlyDue({ currently_due: 'x' }),
      { count: 0, summary: '' },
    );
  });

  it('joins keys and truncates long lists', () => {
    const many = Array.from(
      { length: 200 },
      (_, i) => `requirement_${i}`,
    );
    const { count, summary } = summarizeStripeConnectCurrentlyDue({
      currently_due: many,
    });
    assert.equal(count, 200);
    assert.ok(summary.endsWith('…'));
    assert.ok(summary.length <= STRIPE_CONNECT_CURRENTLY_DUE_SUMMARY_MAX + 1);
  });

  it('filters non-strings', () => {
    const { count, summary } = summarizeStripeConnectCurrentlyDue({
      currently_due: ['a', 1, '', 'b'],
    });
    assert.equal(count, 2);
    assert.equal(summary, 'a,b');
  });
});

describe('extractAccountFromAccountUpdatedEvent (P6-B3)', () => {
  it('returns account when type and id are valid', () => {
    const acc = extractAccountFromAccountUpdatedEvent(
      /** @type {import('stripe').Stripe.Event} */ ({
        type: 'account.updated',
        data: {
          object: {
            id: 'acct_test_1',
            object: 'account',
          },
        },
      }),
    );
    assert.ok(acc);
    assert.equal(acc.id, 'acct_test_1');
  });

  it('returns null for wrong type or id', () => {
    assert.equal(
      extractAccountFromAccountUpdatedEvent(
        /** @type {import('stripe').Stripe.Event} */ ({
          type: 'payment_intent.succeeded',
          data: { object: { id: 'acct_x' } },
        }),
      ),
      null,
    );
    assert.equal(
      extractAccountFromAccountUpdatedEvent(
        /** @type {import('stripe').Stripe.Event} */ ({
          type: 'account.updated',
          data: { object: { id: 'cus_x' } },
        }),
      ),
      null,
    );
  });
});

describe('buildUserConnectStatePatch (P6-B3)', () => {
  it('maps Stripe Account fields to Firestore patch', () => {
    const patch = buildUserConnectStatePatch(
      /** @type {import('stripe').Stripe.Account} */ ({
        id: 'acct_1',
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: false,
        type: 'express',
        requirements: {
          currently_due: ['individual.verification.document'],
        },
      }),
      'evt_abc',
    );
    assert.equal(patch.stripeConnectChargesEnabled, true);
    assert.equal(patch.stripeConnectPayoutsEnabled, true);
    assert.equal(patch.stripeConnectDetailsSubmitted, false);
    assert.equal(patch.stripeConnectRequirementsCurrentlyDueCount, 1);
    assert.equal(
      patch.stripeConnectRequirementsCurrentlyDueSummary,
      'individual.verification.document',
    );
    assert.equal(patch.stripeConnectLastWebhookEventId, 'evt_abc');
    assert.equal(patch.stripeConnectAccountType, 'express');
    assert.ok(patch.stripeConnectLastAccountUpdatedAt instanceof FieldValue);
  });
});
