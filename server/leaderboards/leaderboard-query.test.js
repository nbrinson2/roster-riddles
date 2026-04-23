/**
 * Leaderboard query helpers — Node built-in runner: `npm run test:server`.
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  decodeLeaderboardPageToken,
  encodeLeaderboardPageToken,
  isLeaderboardScope,
  parsePageSizeQuery,
  sortLeaderboardPageRows,
  uidFromStatsSummaryPath,
  winsScoreFromStatsDoc,
} from './leaderboard-query.js';

describe('isLeaderboardScope', () => {
  it('accepts v1 scopes', () => {
    assert.equal(isLeaderboardScope('global'), true);
    assert.equal(isLeaderboardScope('bio-ball'), true);
    assert.equal(isLeaderboardScope('career-path'), true);
    assert.equal(isLeaderboardScope('nickname-streak'), true);
  });
  it('rejects unknown', () => {
    assert.equal(isLeaderboardScope('weekly'), false);
    assert.equal(isLeaderboardScope(''), false);
  });
});

describe('page token', () => {
  it('round-trips', () => {
    const raw = encodeLeaderboardPageToken(
      'global',
      'users/abc/stats/summary',
      26,
    );
    const d = decodeLeaderboardPageToken(raw, 'global');
    assert.equal(d.ok, true);
    if (!d.ok) throw new Error('expected ok');
    assert.equal(d.payload.afterPath, 'users/abc/stats/summary');
    assert.equal(d.payload.startRank, 26);
  });
  it('rejects scope mismatch', () => {
    const raw = encodeLeaderboardPageToken('global', 'users/a/stats/summary', 2);
    const d = decodeLeaderboardPageToken(raw, 'bio-ball');
    assert.equal(d.ok, false);
  });
});

describe('uidFromStatsSummaryPath', () => {
  it('extracts uid', () => {
    assert.equal(
      uidFromStatsSummaryPath('users/xYz9/stats/summary'),
      'xYz9',
    );
    assert.equal(uidFromStatsSummaryPath('bad/path'), null);
  });
});

describe('winsScoreFromStatsDoc', () => {
  it('reads global and per-mode wins', () => {
    assert.equal(
      winsScoreFromStatsDoc('global', {
        totals: { wins: 3 },
      }),
      3,
    );
    assert.equal(
      winsScoreFromStatsDoc('bio-ball', {
        totalsByMode: { 'bio-ball': { wins: 5 } },
      }),
      5,
    );
  });
});

describe('sortLeaderboardPageRows', () => {
  it('sorts by score desc then uid asc', () => {
    const s = sortLeaderboardPageRows([
      { uid: 'b', score: 1 },
      { uid: 'a', score: 1 },
      { uid: 'c', score: 2 },
    ]);
    assert.deepEqual(
      s.map((r) => r.uid),
      ['c', 'a', 'b'],
    );
  });
});

describe('parsePageSizeQuery', () => {
  it('clamps to max', () => {
    assert.equal(parsePageSizeQuery('99'), 50);
    assert.equal(parsePageSizeQuery('10'), 10);
  });
});
