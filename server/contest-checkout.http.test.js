import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildStripeCheckoutReturnUrl,
  entryDataBlocksNewPaidCheckout,
  getEntryFeeCentsFromContest,
} from './contest-checkout.http.js';

describe('getEntryFeeCentsFromContest', () => {
  it('returns floored cents when valid', () => {
    assert.equal(getEntryFeeCentsFromContest({ entryFeeCents: 999 }), 999);
    assert.equal(getEntryFeeCentsFromContest({ entryFeeCents: 12.9 }), 12);
  });

  it('returns 0 when missing or invalid', () => {
    assert.equal(getEntryFeeCentsFromContest({}), 0);
    assert.equal(getEntryFeeCentsFromContest({ entryFeeCents: -1 }), 0);
    assert.equal(getEntryFeeCentsFromContest({ entryFeeCents: NaN }), 0);
  });
});

describe('entryDataBlocksNewPaidCheckout', () => {
  it('returns false when no entry', () => {
    assert.equal(entryDataBlocksNewPaidCheckout(undefined), false);
  });

  it('returns false only for failed payment', () => {
    assert.equal(entryDataBlocksNewPaidCheckout({ paymentStatus: 'failed' }), false);
  });

  it('returns true for paid, pending, free, refunded, legacy', () => {
    assert.equal(entryDataBlocksNewPaidCheckout({ paymentStatus: 'paid' }), true);
    assert.equal(entryDataBlocksNewPaidCheckout({ paymentStatus: 'pending' }), true);
    assert.equal(entryDataBlocksNewPaidCheckout({ paymentStatus: 'free' }), true);
    assert.equal(entryDataBlocksNewPaidCheckout({ paymentStatus: 'refunded' }), true);
    assert.equal(entryDataBlocksNewPaidCheckout({ schemaVersion: 1 }), true);
  });
});

describe('buildStripeCheckoutReturnUrl', () => {
  it('builds bio-ball return URLs with query params', () => {
    const u = buildStripeCheckoutReturnUrl('http://localhost:4300', 'c1', 'success');
    assert.equal(
      u,
      'http://localhost:4300/bio-ball/mlb?contestId=c1&checkout=success',
    );
    assert.equal(
      buildStripeCheckoutReturnUrl('http://localhost:4300/', 'x', 'cancel'),
      'http://localhost:4300/bio-ball/mlb?contestId=x&checkout=cancel',
    );
  });
});
