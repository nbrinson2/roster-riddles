import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  getStripeSecretKeyMode,
  isContestsPaymentsEnabled,
  resetStripeClientForTests,
} from './stripe-server.js';

describe('stripe-server (Story P5-C1)', () => {
  const savedPayments = process.env.CONTESTS_PAYMENTS_ENABLED;
  const savedKey = process.env.STRIPE_SECRET_KEY;

  afterEach(() => {
    process.env.CONTESTS_PAYMENTS_ENABLED = savedPayments;
    process.env.STRIPE_SECRET_KEY = savedKey;
    resetStripeClientForTests();
  });

  it('getStripeSecretKeyMode classifies test vs live without echoing secrets', () => {
    assert.equal(getStripeSecretKeyMode('sk_test_abc'), 'test');
    assert.equal(getStripeSecretKeyMode('sk_live_xyz'), 'live');
    assert.equal(getStripeSecretKeyMode(''), null);
    assert.equal(getStripeSecretKeyMode(undefined), null);
    assert.equal(getStripeSecretKeyMode('bogus'), 'unknown');
  });

  it('isContestsPaymentsEnabled is true only when env is exactly true', () => {
    process.env.CONTESTS_PAYMENTS_ENABLED = 'true';
    assert.equal(isContestsPaymentsEnabled(), true);
    process.env.CONTESTS_PAYMENTS_ENABLED = 'false';
    assert.equal(isContestsPaymentsEnabled(), false);
    delete process.env.CONTESTS_PAYMENTS_ENABLED;
    assert.equal(isContestsPaymentsEnabled(), false);
  });
});
