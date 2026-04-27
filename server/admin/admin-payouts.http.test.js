import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  maskStripeResourceId,
  prizePaidFromExecutionLine,
} from './admin-payouts.http.js';

describe('maskStripeResourceId (P6-G1)', () => {
  it('masks acct and tr ids with prefix and last 4', () => {
    assert.equal(
      maskStripeResourceId('acct_1AbCdEfGhIjKlMnOp'),
      'acct_…MnOp',
    );
    assert.equal(maskStripeResourceId('tr_1ABCdefGHI'), 'tr_…fGHI');
  });

  it('returns null for empty', () => {
    assert.equal(maskStripeResourceId(null), null);
    assert.equal(maskStripeResourceId(''), null);
  });
});

describe('prizePaidFromExecutionLine (P6-G1)', () => {
  it('returns paid true for real money when succeeded with tr', () => {
    const r = prizePaidFromExecutionLine(
      {
        uid: 'u1',
        rank: 1,
        amountCents: 100,
        status: 'succeeded',
        stripeTransferId: 'tr_abc',
      },
      true,
    );
    assert.equal(r.paid, true);
    assert.equal(r.code, 'succeeded');
  });

  it('returns paid false for real money succeeded without tr', () => {
    const r = prizePaidFromExecutionLine(
      { uid: 'u1', amountCents: 100, status: 'succeeded' },
      true,
    );
    assert.equal(r.paid, false);
    assert.equal(r.code, 'succeeded_missing_transfer_id');
  });

  it('allows succeeded without tr when not real money', () => {
    const r = prizePaidFromExecutionLine(
      { uid: 'u1', amountCents: 50, status: 'succeeded' },
      false,
    );
    assert.equal(r.paid, true);
  });

  it('returns false for skipped or zero amount', () => {
    assert.equal(
      prizePaidFromExecutionLine(
        { uid: 'u1', amountCents: 0, status: 'succeeded' },
        false,
      ).paid,
      false,
    );
    assert.equal(
      prizePaidFromExecutionLine(
        { uid: 'u1', amountCents: 100, status: 'skipped' },
        true,
      ).code,
      'skipped',
    );
  });
});
