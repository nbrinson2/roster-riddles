import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildPayoutAdminAuditLedgerPayload,
  isPayoutFinalAggregateRetryEligible,
  pickFailedPayoutLinesForRetry,
} from './contest-payout-admin-actions.job.js';

describe('isPayoutFinalAggregateRetryEligible (P6-G2)', () => {
  it('allows partial_failure and failed', () => {
    assert.equal(isPayoutFinalAggregateRetryEligible('partial_failure'), true);
    assert.equal(isPayoutFinalAggregateRetryEligible('failed'), true);
    assert.equal(isPayoutFinalAggregateRetryEligible('succeeded'), false);
  });
});

describe('pickFailedPayoutLinesForRetry (P6-G2)', () => {
  const lines = [
    { rank: 1, uid: 'a', amountCents: 100, status: 'failed' },
    { rank: 2, uid: 'b', amountCents: 50, status: 'skipped' },
    { rank: 3, uid: 'c', amountCents: 200, status: 'failed', stripeTransferId: null },
  ];

  it('returns all failed money lines without tr when no filter', () => {
    const r = pickFailedPayoutLinesForRetry(lines, undefined, undefined);
    assert.equal(r.length, 2);
  });

  it('filters by rank and uid', () => {
    const r = pickFailedPayoutLinesForRetry(lines, 3, 'c');
    assert.equal(r.length, 1);
    assert.equal(r[0].uid, 'c');
  });

  it('ignores failed rows that already have a transfer id', () => {
    const withTr = [
      ...lines,
      {
        rank: 4,
        uid: 'd',
        amountCents: 10,
        status: 'failed',
        stripeTransferId: 'tr_123',
      },
    ];
    const r = pickFailedPayoutLinesForRetry(withTr, undefined, undefined);
    assert.equal(r.some((x) => x.uid === 'd'), false);
  });
});

describe('buildPayoutAdminAuditLedgerPayload (P6-G2)', () => {
  it('builds a zero-amount other line for admin_adjustment', () => {
    const p = buildPayoutAdminAuditLedgerPayload({
      actorUid: 'admin1',
      contestId: 'c1',
      action: 'payout_hold',
      reason: 'fraud review',
    });
    assert.equal(p.lineType, 'other');
    assert.equal(p.direction, 'credit');
    assert.equal(p.amountCents, 0);
    assert.equal(p.source, 'admin_adjustment');
    assert.equal(p.uid, 'admin1');
    assert.equal(p.contestId, 'c1');
  });
});
