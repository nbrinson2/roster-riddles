/**
 * @see docs/weekly-contests/weekly-contests-phase5-payments-jira.md — Story P5-F2 (free contests)
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { getEntryFeeCentsFromContest } from './contest-entry-fee.js';
import { isPaidContestEntryForJoinReplay } from './contest-join-paid-replay.js';

describe('getEntryFeeCentsFromContest', () => {
  it('returns floored cents when valid', () => {
    assert.equal(getEntryFeeCentsFromContest({ entryFeeCents: 999 }), 999);
    assert.equal(getEntryFeeCentsFromContest({ entryFeeCents: 12.9 }), 12);
  });

  it('returns 0 when missing, invalid, or non-object', () => {
    assert.equal(getEntryFeeCentsFromContest(undefined), 0);
    assert.equal(getEntryFeeCentsFromContest({}), 0);
    assert.equal(getEntryFeeCentsFromContest({ entryFeeCents: -1 }), 0);
    assert.equal(getEntryFeeCentsFromContest({ entryFeeCents: NaN }), 0);
    assert.equal(getEntryFeeCentsFromContest({ entryFeeCents: 0 }), 0);
    assert.equal(getEntryFeeCentsFromContest({ entryFeeCents: undefined }), 0);
  });
});

describe('P5-F2 free contest regression (entryFeeCents === 0)', () => {
  it('treats zero/absent fee as free (join API must not apply payment_required gate)', () => {
    assert.equal(getEntryFeeCentsFromContest({ entryFeeCents: 0 }), 0);
    assert.equal(getEntryFeeCentsFromContest({}), 0);
  });

  it('documents paid replay helper for join idempotency', () => {
    assert.equal(isPaidContestEntryForJoinReplay({ paymentStatus: 'paid' }), true);
    assert.equal(isPaidContestEntryForJoinReplay({ schemaVersion: 1 }), false);
  });
});
