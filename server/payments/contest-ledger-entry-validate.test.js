import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assertValidContestLedgerEntryPayload,
  validateContestLedgerEntryPayload,
} from './contest-ledger-entry-validate.js';

describe('validateContestLedgerEntryPayload (P6-C3)', () => {
  it('accepts Phase 5 contest_entry_charge', () => {
    const r = validateContestLedgerEntryPayload({
      schemaVersion: 1,
      uid: 'u1',
      contestId: 'c1',
      lineType: 'contest_entry_charge',
      direction: 'credit',
      amountCents: 500,
      currency: 'usd',
      source: 'webhook',
    });
    assert.equal(r.ok, true);
  });

  it('rejects unknown lineType', () => {
    const r = validateContestLedgerEntryPayload({
      schemaVersion: 1,
      uid: 'u1',
      contestId: 'c1',
      lineType: 'prize_transfer_unknown',
      direction: 'debit',
      amountCents: 100,
      currency: 'usd',
      source: 'webhook',
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'ledger_unknown_line_type');
  });

  it('rejects prize_transfer_out with credit', () => {
    const r = validateContestLedgerEntryPayload({
      schemaVersion: 1,
      uid: 'u1',
      contestId: 'c1',
      lineType: 'prize_transfer_out',
      direction: 'credit',
      amountCents: 100,
      currency: 'usd',
      source: 'system',
    });
    assert.equal(r.ok, false);
    assert.equal(r.code, 'ledger_line_type_direction_mismatch');
  });

  it('accepts prize line types with canonical directions', () => {
    for (const [lineType, direction] of /** @type {const} */ ([
      ['prize_transfer_out', 'debit'],
      ['prize_transfer_reversal', 'credit'],
      ['platform_fee_retained', 'credit'],
    ])) {
      const r = validateContestLedgerEntryPayload({
        schemaVersion: 1,
        uid: 'u1',
        contestId: 'c1',
        lineType,
        direction,
        amountCents: 1,
        currency: 'usd',
        source: 'system',
      });
      assert.equal(r.ok, true, `${lineType}/${direction}`);
    }
  });

  it('assertValidContestLedgerEntryPayload throws on failure', () => {
    assert.throws(
      () =>
        assertValidContestLedgerEntryPayload({
          schemaVersion: 1,
          uid: 'u1',
          contestId: 'c1',
          lineType: 'contest_entry_refund',
          direction: 'credit',
          amountCents: 1,
          currency: 'usd',
          source: 'webhook',
        }),
      /ledger_line_type_direction_mismatch/,
    );
  });
});
