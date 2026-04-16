/**
 * Streak / aggregate logic tests (Node built-in runner: `npm run test:server`).
 */
import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  applyEventToStatsTree,
  defaultStatsTree,
  normalizeStatsFromFirestore,
} from './stats-aggregate.js';

const W = (
  mode = 'bio-ball',
  durationMs = 1000,
  mistakeCount = 0,
) => ({
  result: /** @type {const} */ ('won'),
  gameMode: /** @type {const} */ (mode),
  durationMs,
  mistakeCount,
});
const L = (mode = 'bio-ball') => ({
  result: /** @type {const} */ ('lost'),
  gameMode: /** @type {const} */ (mode),
  durationMs: 500,
  mistakeCount: 3,
});
const A = (mode = 'bio-ball') => ({
  result: /** @type {const} */ ('abandoned'),
  gameMode: /** @type {const} */ (mode),
  durationMs: 200,
  mistakeCount: 1,
});

describe('applyEventToStatsTree', () => {
  it('first win sets totals and streak to 1', () => {
    let s = applyEventToStatsTree(null, W());
    assert.equal(s.totals.gamesPlayed, 1);
    assert.equal(s.totals.wins, 1);
    assert.equal(s.streaks.currentWinStreak, 1);
    assert.equal(s.streaks.bestWinStreak, 1);
  });

  it('loss resets current streak; bestWinStreak preserves peak', () => {
    let s = defaultStatsTree();
    s = applyEventToStatsTree(s, W());
    s = applyEventToStatsTree(s, W());
    assert.equal(s.streaks.currentWinStreak, 2);
    s = applyEventToStatsTree(s, L());
    assert.equal(s.streaks.currentWinStreak, 0);
    assert.equal(s.streaks.bestWinStreak, 2);
  });

  it('abandoned resets streak like loss', () => {
    let s = applyEventToStatsTree(null, W());
    s = applyEventToStatsTree(s, W());
    assert.equal(s.streaks.currentWinStreak, 2);
    s = applyEventToStatsTree(s, A());
    assert.equal(s.streaks.currentWinStreak, 0);
    assert.equal(s.streaks.bestWinStreak, 2);
    assert.equal(s.totals.abandoned, 1);
  });

  it('N distinct events: totals.gamesPlayed === N and sum of outcomes === N', () => {
    const events = [
      W('bio-ball'),
      W('bio-ball'),
      L('career-path'),
      A('nickname-streak'),
      W('career-path'),
    ];
    let s = null;
    for (const e of events) {
      s = applyEventToStatsTree(s, e);
    }
    assert.equal(s.totals.gamesPlayed, 5);
    assert.equal(
      s.totals.wins + s.totals.losses + s.totals.abandoned,
      5,
    );
    assert.equal(s.totals.wins, 3);
    assert.equal(s.totals.losses, 1);
    assert.equal(s.totals.abandoned, 1);
  });

  it('per-mode totals partition global totals', () => {
    let s = applyEventToStatsTree(null, W('bio-ball'));
    s = applyEventToStatsTree(s, L('bio-ball'));
    s = applyEventToStatsTree(s, W('career-path'));
    assert.equal(s.totalsByMode['bio-ball'].gamesPlayed, 2);
    assert.equal(s.totalsByMode['bio-ball'].wins, 1);
    assert.equal(s.totalsByMode['career-path'].wins, 1);
  });

  it('bests: global and per-mode min duration and mistakes on wins', () => {
    let s = applyEventToStatsTree(null, W('bio-ball', 5000, 10));
    s = applyEventToStatsTree(s, W('bio-ball', 2000, 2));
    assert.equal(s.bests.fastestWinMs, 2000);
    assert.equal(s.bests.fewestMistakesWin, 2);
    assert.equal(s.bests.byMode['bio-ball'].fastestWinMs, 2000);
    assert.equal(s.bests.byMode['bio-ball'].fewestMistakesWin, 2);
  });

  /**
   * Streaks are consecutive wins in **event order**, not calendar days.
   * (No same-day reset — product can add daily buckets later.)
   */
  it('does not use calendar boundaries for streaks (ordering only)', () => {
    let s = applyEventToStatsTree(null, W());
    s = applyEventToStatsTree(s, W());
    assert.equal(s.streaks.currentWinStreak, 2);
  });
});

describe('normalizeStatsFromFirestore', () => {
  it('fills missing fields from partial Firestore doc', () => {
    const n = normalizeStatsFromFirestore({
      totals: { gamesPlayed: 2, wins: 1 },
      streaks: { currentWinStreak: 0, bestWinStreak: 1 },
    });
    assert.equal(n.totals.losses, 0);
    assert.equal(n.totals.abandoned, 0);
    assert.equal(n.bests.fastestWinMs, null);
  });
});
