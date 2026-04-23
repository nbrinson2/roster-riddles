/**
 * Incremental user stats for `users/{uid}/stats/summary` after each new gameplay event.
 * Leaderboard scores (v1 `wins`) are derived from this aggregate — see docs/leaderboards/leaderboards-trusted-writer-c1.md.
 * @see docs/platform/gameplay-stats-phase2.md
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';

/** Single aggregate document id (matches Story 3 rules path). */
export const STATS_DOC_ID = 'summary';

/** Bump when changing stored shape or merge logic. */
export const STATS_SCHEMA_VERSION = 2;

/**
 * @typedef {'won' | 'lost' | 'abandoned'} GameResult
 * @typedef {'bio-ball' | 'career-path' | 'nickname-streak'} GameMode
 * @typedef {Object} ModeTotals
 * @property {number} gamesPlayed
 * @property {number} wins
 * @property {number} losses
 * @property {number} abandoned
 * @typedef {Object} ModeBests
 * @property {number | null} fastestWinMs
 * @property {number | null} fewestMistakesWin
 * @typedef {Object} StatsTree
 * @property {number} aggregateVersion
 * @property {ModeTotals} totals
 * @property {Record<string, ModeTotals>} totalsByMode
 * @property {{ byMode: Record<string, { currentWinStreak: number, bestWinStreak: number }>, nicknameStreak: { current: number, best: number } }} streaks
 * @property {{ fastestWinMs: number | null, fewestMistakesWin: number | null, byMode: Record<string, ModeBests> }} bests
 */

/** @returns {StatsTree} */
export function defaultStatsTree() {
  return {
    aggregateVersion: STATS_SCHEMA_VERSION,
    totals: { gamesPlayed: 0, wins: 0, losses: 0, abandoned: 0 },
    totalsByMode: {},
    streaks: {
      byMode: {},
      nicknameStreak: { current: 0, best: 0 },
    },
    bests: {
      fastestWinMs: null,
      fewestMistakesWin: null,
      byMode: {},
    },
  };
}

/**
 * @param {Record<string, unknown> | undefined} raw
 */
export function normalizeStatsFromFirestore(raw) {
  const d = raw && typeof raw === 'object' ? raw : {};
  const base = defaultStatsTree();

  const totals = pickTotals(d.totals);
  base.totals = { ...base.totals, ...totals };

  const totalsByMode =
    d.totalsByMode && typeof d.totalsByMode === 'object'
      ? { ...d.totalsByMode }
      : {};
  for (const k of Object.keys(totalsByMode)) {
    base.totalsByMode[k] = { ...defaultModeTotals(), ...pickTotals(totalsByMode[k]) };
  }

  const streaks = d.streaks && typeof d.streaks === 'object' ? d.streaks : {};
  const nickRaw = streaks.nicknameStreak;
  let nicknameStreak = { current: 0, best: 0 };
  if (nickRaw && typeof nickRaw === 'object') {
    const nr = /** @type {Record<string, unknown>} */ (nickRaw);
    nicknameStreak = {
      current: num(nr.current, 0),
      best: num(nr.best, 0),
    };
  }

  const streakByModeRaw =
    streaks.byMode && typeof streaks.byMode === 'object' ? streaks.byMode : {};
  const streakByMode = {};
  for (const k of Object.keys(streakByModeRaw)) {
    const row = streakByModeRaw[k];
    if (!row || typeof row !== 'object') continue;
    const r = /** @type {Record<string, unknown>} */ (row);
    streakByMode[k] = {
      currentWinStreak: num(r.currentWinStreak, 0),
      bestWinStreak: num(r.bestWinStreak, 0),
    };
  }

  base.streaks = {
    byMode: streakByMode,
    nicknameStreak,
  };

  const bests = d.bests && typeof d.bests === 'object' ? d.bests : {};
  base.bests.fastestWinMs =
    bests.fastestWinMs === null || bests.fastestWinMs === undefined
      ? null
      : num(bests.fastestWinMs, NaN);
  if (Number.isNaN(base.bests.fastestWinMs)) base.bests.fastestWinMs = null;

  base.bests.fewestMistakesWin =
    bests.fewestMistakesWin === null || bests.fewestMistakesWin === undefined
      ? null
      : num(bests.fewestMistakesWin, NaN);
  if (Number.isNaN(base.bests.fewestMistakesWin)) base.bests.fewestMistakesWin = null;

  const byMode =
    bests.byMode && typeof bests.byMode === 'object' ? { ...bests.byMode } : {};
  base.bests.byMode = {};
  for (const k of Object.keys(byMode)) {
    const mb = byMode[k];
    if (!mb || typeof mb !== 'object') continue;
    base.bests.byMode[k] = {
      fastestWinMs:
        mb.fastestWinMs === null || mb.fastestWinMs === undefined
          ? null
          : num(mb.fastestWinMs, NaN),
      fewestMistakesWin:
        mb.fewestMistakesWin === null || mb.fewestMistakesWin === undefined
          ? null
          : num(mb.fewestMistakesWin, NaN),
    };
    if (Number.isNaN(base.bests.byMode[k].fastestWinMs)) {
      base.bests.byMode[k].fastestWinMs = null;
    }
    if (Number.isNaN(base.bests.byMode[k].fewestMistakesWin)) {
      base.bests.byMode[k].fewestMistakesWin = null;
    }
  }

  base.aggregateVersion = num(d.aggregateVersion, STATS_SCHEMA_VERSION);
  return base;
}

function defaultModeTotals() {
  return { gamesPlayed: 0, wins: 0, losses: 0, abandoned: 0 };
}

function defaultModeWinStreak() {
  return { currentWinStreak: 0, bestWinStreak: 0 };
}

/** @param {unknown} v */
function pickTotals(v) {
  if (!v || typeof v !== 'object') return {};
  const o = /** @type {Record<string, unknown>} */ (v);
  return {
    gamesPlayed: num(o.gamesPlayed, 0),
    wins: num(o.wins, 0),
    losses: num(o.losses, 0),
    abandoned: num(o.abandoned, 0),
  };
}

/** @param {unknown} v @param {number} def */
function num(v, def) {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'bigint') return Number(v);
  return def;
}

const NICK_STREAK_CAP = 1_000_000;

/**
 * Snapshot from client `modeMetrics` (Nickname Streak correct-guess run).
 * @param {StatsTree} base
 * @param {{ gameMode: GameMode, modeMetrics?: Record<string, unknown> }} event
 */
function mergeNicknameStreakFromModeMetrics(base, event) {
  if (event.gameMode !== 'nickname-streak') return;
  const mm = event.modeMetrics;
  if (!mm || typeof mm !== 'object') return;
  const o = /** @type {Record<string, unknown>} */ (mm);
  const rawC = o.nicknameStreakCurrent;
  const rawB = o.nicknameStreakBest;
  if (typeof rawC !== 'number' || typeof rawB !== 'number') return;
  if (!Number.isFinite(rawC) || !Number.isFinite(rawB)) return;
  let c = Math.floor(rawC);
  let b = Math.floor(rawB);
  c = Math.max(0, Math.min(c, NICK_STREAK_CAP));
  b = Math.max(0, Math.min(b, NICK_STREAK_CAP));
  if (!base.streaks.nicknameStreak) {
    base.streaks.nicknameStreak = { current: 0, best: 0 };
  }
  const ns = base.streaks.nicknameStreak;
  ns.current = c;
  ns.best = Math.max(ns.best ?? 0, b, c);
}

/**
 * @param {StatsTree | null | undefined} prev
 * @param {{ result: GameResult, gameMode: GameMode, durationMs: number, mistakeCount: number, modeMetrics?: Record<string, unknown> }} event
 * @returns {StatsTree}
 */
export function applyEventToStatsTree(prev, event) {
  const base = prev
    ? structuredClone(prev)
    : defaultStatsTree();

  if (!base.streaks.byMode || typeof base.streaks.byMode !== 'object') {
    base.streaks.byMode = {};
  }
  if (!base.streaks.nicknameStreak || typeof base.streaks.nicknameStreak !== 'object') {
    base.streaks.nicknameStreak = { current: 0, best: 0 };
  }

  base.totals.gamesPlayed += 1;
  if (event.result === 'won') base.totals.wins += 1;
  else if (event.result === 'lost') base.totals.losses += 1;
  else base.totals.abandoned += 1;

  if (!base.totalsByMode[event.gameMode]) {
    base.totalsByMode[event.gameMode] = defaultModeTotals();
  }
  const mt = base.totalsByMode[event.gameMode];
  mt.gamesPlayed += 1;
  if (event.result === 'won') mt.wins += 1;
  else if (event.result === 'lost') mt.losses += 1;
  else mt.abandoned += 1;

  /**
   * Consecutive wins per `gameMode` in **processing order** (API applies events as they are accepted).
   * Loss and abandoned reset that mode’s current streak only.
   */
  if (!base.streaks.byMode[event.gameMode]) {
    base.streaks.byMode[event.gameMode] = defaultModeWinStreak();
  }
  const sm = base.streaks.byMode[event.gameMode];
  if (event.result === 'won') {
    sm.currentWinStreak = sm.currentWinStreak + 1;
  } else {
    sm.currentWinStreak = 0;
  }
  sm.bestWinStreak = Math.max(sm.bestWinStreak, sm.currentWinStreak);

  if (event.result === 'won') {
    base.bests.fastestWinMs =
      base.bests.fastestWinMs === null
        ? event.durationMs
        : Math.min(base.bests.fastestWinMs, event.durationMs);
    base.bests.fewestMistakesWin =
      base.bests.fewestMistakesWin === null
        ? event.mistakeCount
        : Math.min(base.bests.fewestMistakesWin, event.mistakeCount);

    if (!base.bests.byMode[event.gameMode]) {
      base.bests.byMode[event.gameMode] = {
        fastestWinMs: null,
        fewestMistakesWin: null,
      };
    }
    const mb = base.bests.byMode[event.gameMode];
    mb.fastestWinMs =
      mb.fastestWinMs === null
        ? event.durationMs
        : Math.min(mb.fastestWinMs, event.durationMs);
    mb.fewestMistakesWin =
      mb.fewestMistakesWin === null
        ? event.mistakeCount
        : Math.min(mb.fewestMistakesWin, event.mistakeCount);
  }

  mergeNicknameStreakFromModeMetrics(base, event);

  base.aggregateVersion = STATS_SCHEMA_VERSION;
  return base;
}

/**
 * @param {StatsTree} tree
 * @param {Timestamp} lastPlayedAtTs — same instant as the gameplay event `createdAt`
 * @returns {Record<string, unknown>}
 */
export function buildStatsFirestoreDocument(tree, lastPlayedAtTs) {
  return {
    ...tree,
    lastPlayedAt: lastPlayedAtTs,
    updatedAt: FieldValue.serverTimestamp(),
    statsUpdatedAt: FieldValue.serverTimestamp(),
  };
}

/**
 * Single transaction: insert event if absent; if inserted, update stats.
 * Trusted writer for leaderboard-eligible `totals.wins` / `totalsByMode.*.wins` (Admin SDK only).
 * @see docs/leaderboards/leaderboards-trusted-writer-c1.md
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 * @param {string} eventId
 * @param {Record<string, unknown>} eventPayloadWithoutCreatedAt — validated fields + uid, no `createdAt`
 * @param {{ result: GameResult, gameMode: GameMode, durationMs: number, mistakeCount: number, modeMetrics?: Record<string, unknown> }} statsInput
 * @returns {Promise<{ existing: Record<string, unknown> | null }>}
 */
export async function transactionalAppendEventAndUpdateStats(
  db,
  uid,
  eventId,
  eventPayloadWithoutCreatedAt,
  statsInput,
) {
  const eventRef = db
    .collection('users')
    .doc(uid)
    .collection('gameplayEvents')
    .doc(eventId);
  const statsRef = db
    .collection('users')
    .doc(uid)
    .collection('stats')
    .doc(STATS_DOC_ID);

  /** @type {Record<string, unknown> | null} */
  let existing = null;

  await db.runTransaction(async (tx) => {
    const eventSnap = await tx.get(eventRef);
    if (eventSnap.exists) {
      existing = eventSnap.data() ?? null;
      return;
    }

    const ts = Timestamp.now();
    const statsSnap = await tx.get(statsRef);
    const prev = normalizeStatsFromFirestore(statsSnap.data());
    const tree = applyEventToStatsTree(prev, statsInput);

    tx.set(eventRef, { ...eventPayloadWithoutCreatedAt, createdAt: ts });
    tx.set(statsRef, buildStatsFirestoreDocument(tree, ts));
  });

  return { existing };
}
