import assert from 'node:assert/strict';
import test from 'node:test';
import {
  filterSortedForVerifiedLeaderboard,
  isLeaderboardEmailVerifiedEnforced,
} from './leaderboard-email-verified.js';

test('filterSortedForVerifiedLeaderboard keeps verified only', () => {
  const sorted = [
    { uid: 'a', score: 1 },
    { uid: 'b', score: 2 },
  ];
  /** @type {Map<string, { emailVerified?: boolean }>} */
  const auth = new Map([
    ['a', { emailVerified: true }],
    ['b', { emailVerified: false }],
  ]);
  const out = filterSortedForVerifiedLeaderboard(sorted, auth);
  assert.equal(out.length, 1);
  assert.equal(out[0].uid, 'a');
});

test('filterSortedForVerifiedLeaderboard passes through when enforcement off', () => {
  const prev = process.env.LEADERBOARD_REQUIRE_EMAIL_VERIFIED;
  process.env.LEADERBOARD_REQUIRE_EMAIL_VERIFIED = 'false';
  try {
    assert.equal(isLeaderboardEmailVerifiedEnforced(), false);
    const sorted = [{ uid: 'x', score: 1 }];
    const auth = new Map([['x', { emailVerified: false }]]);
    const out = filterSortedForVerifiedLeaderboard(sorted, auth);
    assert.equal(out.length, 1);
  } finally {
    if (prev === undefined) {
      delete process.env.LEADERBOARD_REQUIRE_EMAIL_VERIFIED;
    } else {
      process.env.LEADERBOARD_REQUIRE_EMAIL_VERIFIED = prev;
    }
  }
});
