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
  it('first win sets totals and that mode streak to 1', () => {
    let s = applyEventToStatsTree(null, W());
    assert.equal(s.totals.gamesPlayed, 1);
    assert.equal(s.totals.wins, 1);
    assert.equal(s.streaks.byMode['bio-ball'].currentWinStreak, 1);
    assert.equal(s.streaks.byMode['bio-ball'].bestWinStreak, 1);
  });

  it('loss resets current streak for that mode; bestWinStreak preserves peak', () => {
    let s = defaultStatsTree();
    s = applyEventToStatsTree(s, W());
    s = applyEventToStatsTree(s, W());
    assert.equal(s.streaks.byMode['bio-ball'].currentWinStreak, 2);
    s = applyEventToStatsTree(s, L());
    assert.equal(s.streaks.byMode['bio-ball'].currentWinStreak, 0);
    assert.equal(s.streaks.byMode['bio-ball'].bestWinStreak, 2);
  });

  it('abandoned resets streak for that mode like loss', () => {
    let s = applyEventToStatsTree(null, W());
    s = applyEventToStatsTree(s, W());
    assert.equal(s.streaks.byMode['bio-ball'].currentWinStreak, 2);
    s = applyEventToStatsTree(s, A());
    assert.equal(s.streaks.byMode['bio-ball'].currentWinStreak, 0);
    assert.equal(s.streaks.byMode['bio-ball'].bestWinStreak, 2);
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
    assert.equal(s.streaks.byMode['bio-ball'].currentWinStreak, 2);
  });

  it('win streaks are independent per game mode', () => {
    let s = applyEventToStatsTree(null, W('bio-ball'));
    s = applyEventToStatsTree(s, W('bio-ball'));
    assert.equal(s.streaks.byMode['bio-ball'].currentWinStreak, 2);
    s = applyEventToStatsTree(s, W('career-path'));
    assert.equal(s.streaks.byMode['bio-ball'].currentWinStreak, 2);
    assert.equal(s.streaks.byMode['career-path'].currentWinStreak, 1);
    s = applyEventToStatsTree(s, L('bio-ball'));
    assert.equal(s.streaks.byMode['bio-ball'].currentWinStreak, 0);
    assert.equal(s.streaks.byMode['bio-ball'].bestWinStreak, 2);
    assert.equal(s.streaks.byMode['career-path'].currentWinStreak, 1);
  });

  it('merges nickname-streak guess counters from modeMetrics on won', () => {
    let s = applyEventToStatsTree(null, {
      ...W('nickname-streak'),
      modeMetrics: { nicknameStreakCurrent: 2, nicknameStreakBest: 2 },
    });
    assert.equal(s.streaks.byMode['nickname-streak'].currentWinStreak, 1);
    assert.equal(s.streaks.nicknameStreak.current, 2);
    assert.equal(s.streaks.nicknameStreak.best, 2);
    s = applyEventToStatsTree(s, {
      ...W('nickname-streak'),
      modeMetrics: { nicknameStreakCurrent: 3, nicknameStreakBest: 3 },
    });
    assert.equal(s.streaks.byMode['nickname-streak'].currentWinStreak, 2);
    assert.equal(s.streaks.nicknameStreak.current, 3);
    assert.equal(s.streaks.nicknameStreak.best, 3);
  });

  it('nickname-streak loss applies modeMetrics and preserves best', () => {
    let s = applyEventToStatsTree(null, {
      ...W('nickname-streak'),
      modeMetrics: { nicknameStreakCurrent: 4, nicknameStreakBest: 4 },
    });
    s = applyEventToStatsTree(s, {
      ...L('nickname-streak'),
      modeMetrics: { nicknameStreakCurrent: 0, nicknameStreakBest: 4 },
    });
    assert.equal(s.streaks.nicknameStreak.current, 0);
    assert.equal(s.streaks.nicknameStreak.best, 4);
  });

  it('non-nickname events do not require modeMetrics for nickname streak', () => {
    let s = applyEventToStatsTree(null, W('bio-ball'));
    assert.equal(s.streaks.nicknameStreak.current, 0);
    assert.equal(s.streaks.nicknameStreak.best, 0);
  });
});

/**
 * Leaderboard v1 ranks by `wins` on `stats/summary` (Story C1 — same merge as Phase 2).
 */
describe('leaderboard score fields (Phase 3 C1)', () => {
  it('increments totals.wins only for won results', () => {
    let s = applyEventToStatsTree(null, W());
    assert.equal(s.totals.wins, 1);
    s = applyEventToStatsTree(s, L());
    assert.equal(s.totals.wins, 1);
    s = applyEventToStatsTree(s, W());
    assert.equal(s.totals.wins, 2);
    s = applyEventToStatsTree(s, A());
    assert.equal(s.totals.wins, 2);
  });

  it('increments per-mode wins in parallel with global wins for that mode', () => {
    let s = applyEventToStatsTree(null, W('nickname-streak'));
    assert.equal(s.totals.wins, 1);
    assert.equal(s.totalsByMode['nickname-streak'].wins, 1);
    s = applyEventToStatsTree(s, W('nickname-streak'));
    assert.equal(s.totals.wins, 2);
    assert.equal(s.totalsByMode['nickname-streak'].wins, 2);
    assert.equal(s.totalsByMode['bio-ball']?.wins ?? 0, 0);
  });

  it('wins are cumulative event counts, not a max() of a client score field', () => {
    let s = applyEventToStatsTree(null, W('bio-ball', 100, 0));
    s = applyEventToStatsTree(s, W('bio-ball', 50, 0));
    assert.equal(s.totals.wins, 2);
    assert.equal(s.totalsByMode['bio-ball'].wins, 2);
  });
});

describe('normalizeStatsFromFirestore', () => {
  it('fills missing fields from partial Firestore doc', () => {
    const n = normalizeStatsFromFirestore({
      totals: { gamesPlayed: 2, wins: 1 },
      streaks: {
        byMode: { 'bio-ball': { currentWinStreak: 0, bestWinStreak: 4 } },
      },
    });
    assert.equal(n.totals.losses, 0);
    assert.equal(n.totals.abandoned, 0);
    assert.equal(n.bests.fastestWinMs, null);
    assert.equal(n.streaks.byMode['bio-ball'].bestWinStreak, 4);
    assert.equal(n.streaks.nicknameStreak.current, 0);
    assert.equal(n.streaks.nicknameStreak.best, 0);
  });
});
