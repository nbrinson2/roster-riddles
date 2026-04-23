import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { paymentIntentIdFromValue } from './stripe-webhook-contest-payment-refund.js';

describe('paymentIntentIdFromValue', () => {
  it('accepts pi string', () => {
    assert.equal(paymentIntentIdFromValue('pi_123'), 'pi_123');
  });

  it('accepts expanded object', () => {
    assert.equal(paymentIntentIdFromValue({ id: 'pi_ab' }), 'pi_ab');
  });

  it('returns null otherwise', () => {
    assert.equal(paymentIntentIdFromValue(null), null);
    assert.equal(paymentIntentIdFromValue('ch_1'), null);
    assert.equal(paymentIntentIdFromValue({}), null);
  });
});
