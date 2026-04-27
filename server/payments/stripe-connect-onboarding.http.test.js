import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildStripeConnectAccountUrls,
  isStripeConnectProfileComplete,
  resolveStripeConnectAccountLinkType,
} from './stripe-connect-onboarding.http.js';

describe('buildStripeConnectAccountUrls (P6-B2)', () => {
  it('builds payout-setup return and refresh URLs', () => {
    const { return_url, refresh_url } = buildStripeConnectAccountUrls(
      'http://localhost:4300',
    );
    assert.equal(
      return_url,
      'http://localhost:4300/account/payout-setup?payout_setup=success',
    );
    assert.equal(
      refresh_url,
      'http://localhost:4300/account/payout-setup?payout_setup=refresh',
    );
    assert.equal(
      buildStripeConnectAccountUrls('http://localhost:4300/').return_url,
      'http://localhost:4300/account/payout-setup?payout_setup=success',
    );
  });
});

describe('isStripeConnectProfileComplete (P6-B2)', () => {
  it('is false when any gate fails', () => {
    assert.equal(
      isStripeConnectProfileComplete({
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { currently_due: ['individual.verification.document'] },
      }),
      false,
    );
    assert.equal(
      isStripeConnectProfileComplete({
        details_submitted: false,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { currently_due: [] },
      }),
      false,
    );
  });

  it('is true when submitted, enabled, and no currently_due', () => {
    assert.equal(
      isStripeConnectProfileComplete({
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
        requirements: { currently_due: [] },
      }),
      true,
    );
    assert.equal(
      isStripeConnectProfileComplete({
        details_submitted: true,
        charges_enabled: true,
        payouts_enabled: true,
      }),
      true,
    );
  });
});

describe('resolveStripeConnectAccountLinkType (P6-B2)', () => {
  it('returns none when complete without force', () => {
    assert.equal(
      resolveStripeConnectAccountLinkType(true, false),
      'none',
    );
  });
  it('returns account_update when complete with force', () => {
    assert.equal(
      resolveStripeConnectAccountLinkType(true, true),
      'account_update',
    );
  });
  it('returns account_onboarding when not complete', () => {
    assert.equal(
      resolveStripeConnectAccountLinkType(false, false),
      'account_onboarding',
    );
    assert.equal(
      resolveStripeConnectAccountLinkType(false, true),
      'account_onboarding',
    );
  });
});
