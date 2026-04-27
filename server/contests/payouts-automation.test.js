import test from 'node:test';
import assert from 'node:assert/strict';
import { isPayoutsAutomationEnabled } from './payouts-automation.js';

const originalEnv = process.env.PAYOUTS_AUTOMATION_ENABLED;

test('isPayoutsAutomationEnabled', async (t) => {
  t.afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.PAYOUTS_AUTOMATION_ENABLED;
    } else {
      process.env.PAYOUTS_AUTOMATION_ENABLED = originalEnv;
    }
  });

  await t.test('false when unset', () => {
    delete process.env.PAYOUTS_AUTOMATION_ENABLED;
    assert.equal(isPayoutsAutomationEnabled(), false);
  });

  await t.test('false for 1 and True', () => {
    process.env.PAYOUTS_AUTOMATION_ENABLED = '1';
    assert.equal(isPayoutsAutomationEnabled(), false);
    process.env.PAYOUTS_AUTOMATION_ENABLED = 'True';
    assert.equal(isPayoutsAutomationEnabled(), false);
  });

  await t.test('true when value trims to true', () => {
    process.env.PAYOUTS_AUTOMATION_ENABLED = ' true ';
    assert.equal(isPayoutsAutomationEnabled(), true);
  });

  await t.test('true when exactly true', () => {
    process.env.PAYOUTS_AUTOMATION_ENABLED = 'true';
    assert.equal(isPayoutsAutomationEnabled(), true);
  });
});
