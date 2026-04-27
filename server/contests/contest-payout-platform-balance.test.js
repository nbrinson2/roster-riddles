import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  computePlannedPrizeTransferTotalCents,
  extractUsdAvailableCentsFromBalance,
  isContestPayoutBalanceGuardEnabled,
} from './contest-payout-platform-balance.js';

const originalGuard = process.env.CONTEST_PAYOUT_BALANCE_GUARD_ENABLED;

function snap(exists, data) {
  return {
    exists,
    data: () => data,
  };
}

const readyUser = {
  stripeConnectAccountId: 'acct_123',
  stripeConnectPayoutsEnabled: true,
  stripeConnectChargesEnabled: true,
  stripeConnectDetailsSubmitted: true,
};

describe('isContestPayoutBalanceGuardEnabled (P6-E1)', () => {
  it('is true only when env is exactly true (trimmed)', () => {
    try {
      delete process.env.CONTEST_PAYOUT_BALANCE_GUARD_ENABLED;
      assert.equal(isContestPayoutBalanceGuardEnabled(), false);
      process.env.CONTEST_PAYOUT_BALANCE_GUARD_ENABLED = ' true ';
      assert.equal(isContestPayoutBalanceGuardEnabled(), true);
      process.env.CONTEST_PAYOUT_BALANCE_GUARD_ENABLED = '1';
      assert.equal(isContestPayoutBalanceGuardEnabled(), false);
    } finally {
      if (originalGuard === undefined) {
        delete process.env.CONTEST_PAYOUT_BALANCE_GUARD_ENABLED;
      } else {
        process.env.CONTEST_PAYOUT_BALANCE_GUARD_ENABLED = originalGuard;
      }
    }
  });
});

describe('extractUsdAvailableCentsFromBalance (P6-E1)', () => {
  it('sums USD available rows', () => {
    assert.equal(
      extractUsdAvailableCentsFromBalance(
        /** @type {import('stripe').Stripe.Balance} */ ({
          object: 'balance',
          available: [
            { amount: 100, currency: 'usd' },
            { amount: 50, currency: 'usd' },
          ],
          pending: [],
          connect_reserved: [],
          livemode: false,
        }),
      ),
      150,
    );
  });

  it('returns 0 when missing or non-usd', () => {
    assert.equal(
      extractUsdAvailableCentsFromBalance(
        /** @type {import('stripe').Stripe.Balance} */ ({
          object: 'balance',
          available: [{ amount: 200, currency: 'eur' }],
          pending: [],
          connect_reserved: [],
          livemode: false,
        }),
      ),
      0,
    );
    assert.equal(
      extractUsdAvailableCentsFromBalance(
        /** @type {import('stripe').Stripe.Balance} */ ({
          object: 'balance',
          available: 'bad',
          pending: [],
          connect_reserved: [],
          livemode: false,
        }),
      ),
      0,
    );
  });
});

describe('computePlannedPrizeTransferTotalCents (P6-E1)', () => {
  it('sums only lines that would receive a transfer', () => {
    const lines = [
      { rank: 1, uid: 'a', amountCents: 10_000 },
      { rank: 2, uid: 'b', amountCents: 0 },
      { rank: 3, uid: 'c', amountCents: 5000 },
    ];
    const entrySnaps = [
      snap(true, { paymentStatus: 'paid' }),
      snap(true, { paymentStatus: 'paid' }),
      snap(true, { paymentStatus: 'pending' }),
    ];
    const userSnaps = [
      snap(true, readyUser),
      snap(true, readyUser),
      snap(true, readyUser),
    ];
    assert.equal(
      computePlannedPrizeTransferTotalCents(lines, entrySnaps, userSnaps),
      10_000,
    );
  });

  it('returns 0 when no money lines or none ready', () => {
    const lines = [{ rank: 1, uid: 'a', amountCents: 100 }];
    assert.equal(
      computePlannedPrizeTransferTotalCents(
        lines,
        [snap(true, { paymentStatus: 'paid' })],
        [snap(true, { stripeConnectAccountId: 'acct_x' })],
      ),
      0,
    );
  });
});
