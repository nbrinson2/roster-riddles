import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { afterEach, describe, it } from 'node:test';
import {
  getStripeClient,
  getStripeHealthFields,
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

  it('getStripeHealthFields exposes payments flag and key mode without secrets', () => {
    process.env.CONTESTS_PAYMENTS_ENABLED = 'false';
    process.env.STRIPE_SECRET_KEY = 'sk_test_12345678901234567890123456789012';
    assert.deepEqual(getStripeHealthFields(), {
      contestsPaymentsEnabled: false,
      stripeSecretKeyMode: null,
    });
    process.env.CONTESTS_PAYMENTS_ENABLED = 'true';
    assert.deepEqual(getStripeHealthFields(), {
      contestsPaymentsEnabled: true,
      stripeSecretKeyMode: 'test',
    });
  });

  it('resolves STRIPE_SECRET_KEY from a gitignored file path', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rr-stripe-key-'));
    const keyFile = path.join(dir, 'stripe-secret-key.txt');
    const sk = 'sk_test_12345678901234567890123456789012';
    fs.writeFileSync(keyFile, `${sk}\n`, 'utf8');
    process.env.STRIPE_SECRET_KEY = keyFile;
    process.env.CONTESTS_PAYMENTS_ENABLED = 'false';
    resetStripeClientForTests();
    const client = getStripeClient();
    assert.ok(client);
    assert.equal(getStripeSecretKeyMode(sk), 'test');
  });
});
