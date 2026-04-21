/**
 * @see server/payments/stripe-webhook.http.js — full signature tests use Stripe CLI + listen.
 */
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import { postStripeWebhook } from './stripe-webhook.http.js';
import { resetStripeClientForTests } from './stripe-server.js';

describe('postStripeWebhook (Story P5-C2)', () => {
  const savedWebhook = process.env.STRIPE_WEBHOOK_SECRET;
  const savedKey = process.env.STRIPE_SECRET_KEY;
  const savedPayments = process.env.CONTESTS_PAYMENTS_ENABLED;

  afterEach(() => {
    process.env.STRIPE_WEBHOOK_SECRET = savedWebhook;
    process.env.STRIPE_SECRET_KEY = savedKey;
    process.env.CONTESTS_PAYMENTS_ENABLED = savedPayments;
    resetStripeClientForTests();
  });

  it('returns 503 when STRIPE_WEBHOOK_SECRET is unset', () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake_for_client_only';
    process.env.CONTESTS_PAYMENTS_ENABLED = 'false';

    let statusCode = 0;
    let jsonBody;
    const req = {
      requestId: 'test-req',
      body: Buffer.from('{}'),
      headers: { 'stripe-signature': 't=1,v1=fake' },
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(obj) {
        jsonBody = obj;
        return this;
      },
    };

    postStripeWebhook(req, res);
    assert.equal(statusCode, 503);
    assert.equal(jsonBody?.error?.code, 'stripe_webhook_not_configured');
  });

  it('returns 400 when Stripe-Signature header is missing', () => {
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_test_12345678901234567890123456789012';
    process.env.STRIPE_SECRET_KEY = 'sk_test_12345678901234567890123456789012';
    process.env.CONTESTS_PAYMENTS_ENABLED = 'false';

    let statusCode = 0;
    let jsonBody;
    const req = {
      requestId: 'test-req',
      body: Buffer.from('{}'),
      headers: {},
    };
    const res = {
      status(code) {
        statusCode = code;
        return this;
      },
      json(obj) {
        jsonBody = obj;
        return this;
      },
    };

    postStripeWebhook(req, res);
    assert.equal(statusCode, 400);
    assert.equal(jsonBody?.error?.code, 'stripe_webhook_missing_signature');
  });
});
