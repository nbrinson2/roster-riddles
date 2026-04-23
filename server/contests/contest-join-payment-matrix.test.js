/**
 * Phase 5 Story P5-H3 — Paid vs free join matrix (classifier mirrors join handler).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { classifyContestJoinPaymentPath } from './contest-join-payment-path.js';

describe('classifyContestJoinPaymentPath (P5-H3 join matrix)', () => {
  const cases = [
    {
      name: 'no entry, free contest → create_free_entry',
      fee: 0,
      state: { exists: false },
      want: 'create_free_entry',
    },
    {
      name: 'no entry, paid contest → payment_required',
      fee: 500,
      state: { exists: false },
      want: 'payment_required',
    },
    {
      name: 'existing free entry, free contest → idempotent_replay',
      fee: 0,
      state: { exists: true, data: { paymentStatus: 'free' } },
      want: 'idempotent_replay',
    },
    {
      name: 'existing paid entry, paid contest → idempotent_replay',
      fee: 500,
      state: {
        exists: true,
        data: { paymentStatus: 'paid', stripePaymentIntentId: 'pi_x' },
      },
      want: 'idempotent_replay',
    },
    {
      name: 'existing pending entry, paid contest → payment_required',
      fee: 500,
      state: { exists: true, data: { paymentStatus: 'pending' } },
      want: 'payment_required',
    },
    {
      name: 'existing failed entry, paid contest → payment_required',
      fee: 500,
      state: { exists: true, data: { paymentStatus: 'failed' } },
      want: 'payment_required',
    },
    {
      name: 'existing legacy entry (no paymentStatus), paid contest → payment_required',
      fee: 500,
      state: { exists: true, data: { schemaVersion: 1 } },
      want: 'payment_required',
    },
    {
      name: 'existing entry doc missing fields, paid contest → payment_required',
      fee: 100,
      state: { exists: true, data: undefined },
      want: 'payment_required',
    },
  ];

  for (const c of cases) {
    it(c.name, () => {
      assert.equal(
        classifyContestJoinPaymentPath(c.fee, c.state),
        c.want,
        c.name,
      );
    });
  }
});
