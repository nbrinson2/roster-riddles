import assert from 'node:assert/strict';
import { describe, it, afterEach } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import {
  buildLiveLeaderboardCacheKey,
  ContestLiveLeaderboardMemoryCache,
  resetContestLiveLeaderboardCacheForTests,
} from './contest-live-leaderboard-cache.js';

function ts(ms) {
  return Timestamp.fromMillis(ms);
}

function fakeEntry(id, joinedMs) {
  return {
    id,
    data: () => ({ joinedAt: ts(joinedMs) }),
  };
}

describe('buildLiveLeaderboardCacheKey', () => {
  it('is stable when entry doc order shuffles', () => {
    const a = fakeEntry('a', 1);
    const b = fakeEntry('b', 2);
    const k1 = buildLiveLeaderboardCacheKey(
      'c1',
      ts(0),
      ts(999),
      10,
      [a, b],
      false,
      0,
    );
    const k2 = buildLiveLeaderboardCacheKey(
      'c1',
      ts(0),
      ts(999),
      10,
      [b, a],
      false,
      0,
    );
    assert.equal(k1, k2);
  });

  it('changes when joinedAt changes', () => {
    const k1 = buildLiveLeaderboardCacheKey(
      'c1',
      ts(0),
      ts(999),
      10,
      [fakeEntry('a', 1)],
      false,
      0,
    );
    const k2 = buildLiveLeaderboardCacheKey(
      'c1',
      ts(0),
      ts(999),
      10,
      [fakeEntry('a', 2)],
      false,
      0,
    );
    assert.notEqual(k1, k2);
  });

  it('changes when contest updatedAt changes', () => {
    const docs = [fakeEntry('a', 1)];
    const k1 = buildLiveLeaderboardCacheKey(
      'c1',
      ts(0),
      ts(999),
      10,
      docs,
      false,
      100,
    );
    const k2 = buildLiveLeaderboardCacheKey(
      'c1',
      ts(0),
      ts(999),
      10,
      docs,
      false,
      200,
    );
    assert.notEqual(k1, k2);
  });
});

describe('ContestLiveLeaderboardMemoryCache', () => {
  afterEach(() => {
    resetContestLiveLeaderboardCacheForTests();
  });

  it('returns null when ttl is 0', () => {
    const c = new ContestLiveLeaderboardMemoryCache({ ttlMs: 0, maxKeys: 10 });
    c.set('x', 'fp', { a: 1 });
    assert.equal(c.get('x', 'fp'), null);
  });

  it('returns payload before expiry', () => {
    const c = new ContestLiveLeaderboardMemoryCache({ ttlMs: 60_000, maxKeys: 10 });
    c.set('x', 'fp', { standings: [{ rank: 1 }] });
    const g = c.get('x', 'fp');
    assert.deepEqual(g, { standings: [{ rank: 1 }] });
  });

  it('expires after ttl', () => {
    const c = new ContestLiveLeaderboardMemoryCache({ ttlMs: 1, maxKeys: 10 });
    c.set('x', 'fp', { ok: true });
    return new Promise((resolve, reject) => {
      setTimeout(() => {
        try {
          assert.equal(c.get('x', 'fp'), null);
          resolve();
        } catch (e) {
          reject(e);
        }
      }, 25);
    });
  });

  it('evicts oldest when over maxKeys', () => {
    const c = new ContestLiveLeaderboardMemoryCache({ ttlMs: 60_000, maxKeys: 2 });
    c.set('a', '1', { v: 'a' });
    c.set('b', '2', { v: 'b' });
    c.set('c', '3', { v: 'c' });
    assert.equal(c.get('a', '1'), null);
    assert.deepEqual(c.get('b', '2'), { v: 'b' });
    assert.deepEqual(c.get('c', '3'), { v: 'c' });
  });
});
