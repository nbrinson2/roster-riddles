import test from 'node:test';
import assert from 'node:assert/strict';
import {
  contestEligibleForAutomatedPayoutSweep,
  contestMatchesGameModeFilter,
} from './contest-payout-automation.lib.js';

test('contest-payout-automation.lib', async (t) => {
  await t.test('eligible when paid and no terminal prize status', () => {
    assert.equal(
      contestEligibleForAutomatedPayoutSweep({ status: 'paid' }),
      true,
    );
    assert.equal(
      contestEligibleForAutomatedPayoutSweep({
        status: 'paid',
        prizePayoutStatus: 'scheduled',
      }),
      true,
    );
    assert.equal(
      contestEligibleForAutomatedPayoutSweep({
        status: 'paid',
        prizePayoutStatus: 'in_progress',
      }),
      true,
    );
  });

  await t.test('not eligible when held, completed, or failed', () => {
    assert.equal(
      contestEligibleForAutomatedPayoutSweep({
        status: 'paid',
        prizePayoutStatus: 'held',
      }),
      false,
    );
    assert.equal(
      contestEligibleForAutomatedPayoutSweep({
        status: 'paid',
        prizePayoutStatus: 'completed',
      }),
      false,
    );
    assert.equal(
      contestEligibleForAutomatedPayoutSweep({
        status: 'paid',
        prizePayoutStatus: 'failed',
      }),
      false,
    );
  });

  await t.test('not eligible when not paid', () => {
    assert.equal(
      contestEligibleForAutomatedPayoutSweep({ status: 'open' }),
      false,
    );
  });

  await t.test('gameMode filter', () => {
    assert.equal(
      contestMatchesGameModeFilter({ gameMode: 'bio-ball' }, undefined),
      true,
    );
    assert.equal(
      contestMatchesGameModeFilter({ gameMode: 'bio-ball' }, 'bio-ball'),
      true,
    );
    assert.equal(
      contestMatchesGameModeFilter({ gameMode: 'bio-ball' }, 'other'),
      false,
    );
  });
});
