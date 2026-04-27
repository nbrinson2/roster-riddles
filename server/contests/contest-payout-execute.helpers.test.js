import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  entryEligibleForAutomatedPrizePayout,
  stripePayoutTransferIdempotencyKey,
  userConnectReadyForPayoutTransfer,
} from './contest-payout-execute.helpers.js';

function snap(exists, data) {
  return {
    exists,
    data: () => data,
  };
}

describe('entryEligibleForAutomatedPrizePayout (P6-D2)', () => {
  it('allows paid and free', () => {
    assert.equal(entryEligibleForAutomatedPrizePayout(snap(true, { paymentStatus: 'paid' })), true);
    assert.equal(entryEligibleForAutomatedPrizePayout(snap(true, { paymentStatus: 'free' })), true);
  });

  it('denies missing or bad paymentStatus', () => {
    assert.equal(entryEligibleForAutomatedPrizePayout(snap(false, {})), false);
    assert.equal(entryEligibleForAutomatedPrizePayout(snap(true, { paymentStatus: 'pending' })), false);
    assert.equal(entryEligibleForAutomatedPrizePayout(snap(true, {})), false);
  });
});

describe('userConnectReadyForPayoutTransfer (P6-D2)', () => {
  it('requires acct and Connect flags', () => {
    assert.equal(userConnectReadyForPayoutTransfer(snap(false, {})), false);
    assert.equal(
      userConnectReadyForPayoutTransfer(
        snap(true, { stripeConnectAccountId: 'acct_1' }),
      ),
      false,
    );
    assert.equal(
      userConnectReadyForPayoutTransfer(
        snap(true, {
          stripeConnectAccountId: 'acct_1',
          stripeConnectPayoutsEnabled: true,
          stripeConnectChargesEnabled: true,
          stripeConnectDetailsSubmitted: false,
        }),
      ),
      false,
    );
    assert.equal(
      userConnectReadyForPayoutTransfer(
        snap(true, {
          stripeConnectAccountId: 'acct_1',
          stripeConnectPayoutsEnabled: true,
          stripeConnectChargesEnabled: true,
          stripeConnectDetailsSubmitted: true,
        }),
      ),
      true,
    );
  });
});

describe('stripePayoutTransferIdempotencyKey (P6-D2)', () => {
  it('sanitizes and caps length', () => {
    const k = stripePayoutTransferIdempotencyKey('c-1', 'user_x', 1);
    assert.ok(k.startsWith('rr_payout_'));
    assert.ok(k.length <= 255);
  });
});
