import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isPaidContestEntryForJoinReplay } from './contest-join-paid-replay.js';

describe('isPaidContestEntryForJoinReplay (P5-F1)', () => {
  it('returns true only for paymentStatus paid', () => {
    assert.equal(isPaidContestEntryForJoinReplay(undefined), false);
    assert.equal(isPaidContestEntryForJoinReplay({}), false);
    assert.equal(isPaidContestEntryForJoinReplay({ paymentStatus: 'pending' }), false);
    assert.equal(isPaidContestEntryForJoinReplay({ paymentStatus: 'failed' }), false);
    assert.equal(isPaidContestEntryForJoinReplay({ paymentStatus: 'free' }), false);
    assert.equal(isPaidContestEntryForJoinReplay({ paymentStatus: 'paid' }), true);
  });
});
