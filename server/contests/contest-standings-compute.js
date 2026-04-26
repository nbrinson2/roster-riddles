/**
 * Shared mini-league standings computation — used by E2 scoring (`contest-scoring-job.js`)
 * and public live leaderboard HTTP (Phase 1). Must stay aligned with ADR + `tallySlate` / `assignDenseRanks`.
 * @see docs/weekly-contests/weekly-contests-phase4-adr.md
 */

import { Timestamp } from 'firebase-admin/firestore';
import { assignDenseRanks, tallySlate } from './contest-scoring-core.js';

const BIO_BALL = 'bio-ball';

/**
 * @param {unknown} c
 * @returns {c is Record<string, unknown>}
 */
function isRecord(c) {
  return c != null && typeof c === 'object' && !Array.isArray(c);
}

/**
 * @param {import('firebase-admin/firestore').Timestamp} a
 * @param {import('firebase-admin/firestore').Timestamp} b
 * @returns {import('firebase-admin/firestore').Timestamp}
 */
function maxTimestamp(a, b) {
  return a.toMillis() >= b.toMillis() ? a : b;
}

/**
 * First `leagueGamesN` Bio Ball gameplay events with `createdAt` in
 * `[max(windowStart, joinedAt), windowEnd)` — same query as E2 scoring.
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 * @param {import('firebase-admin/firestore').Timestamp} windowStart
 * @param {import('firebase-admin/firestore').Timestamp} windowEnd
 * @param {import('firebase-admin/firestore').Timestamp} joinedAt
 * @param {number} leagueGamesN
 * @returns {Promise<{ result: 'won'|'lost'|'abandoned' }[]>}
 */
export async function loadQualifyingSlate(
  db,
  uid,
  windowStart,
  windowEnd,
  joinedAt,
  leagueGamesN,
) {
  const lower = maxTimestamp(windowStart, joinedAt);
  const snap = await db
    .collection('users')
    .doc(uid)
    .collection('gameplayEvents')
    .where('gameMode', '==', BIO_BALL)
    .where('createdAt', '>=', lower)
    .where('createdAt', '<', windowEnd)
    .orderBy('createdAt', 'asc')
    .limit(leagueGamesN)
    .get();

  const out = [];
  snap.forEach((doc) => {
    const d = doc.data();
    const r = d.result;
    if (r === 'won' || r === 'lost' || r === 'abandoned') {
      out.push({ result: r });
    }
  });
  return out;
}

/**
 * @typedef {{
 *   rank: number,
 *   uid: string,
 *   wins: number,
 *   gamesPlayed: number,
 *   losses: number,
 *   abandoned: number,
 *   displayName: string | null,
 *   tieBreakKey: string,
 *   tier: 'full'|'partial',
 * }} ContestStandingRow
 */

/**
 * Build ordered standings for contest entrants (same rows as `results/final.standings`).
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {{
 *   windowStart: import('firebase-admin/firestore').Timestamp,
 *   windowEnd: import('firebase-admin/firestore').Timestamp,
 *   leagueGamesN: number,
 * }} contestTiming
 * @param {import('firebase-admin/firestore').QueryDocumentSnapshot[]} entryDocs
 * @param {{ onSkipEntry?: (detail: { uid: string, reason: string }) => void }} [hooks]
 * @returns {Promise<ContestStandingRow[]>}
 */
export async function computeStandingsForEntryDocs(
  db,
  contestTiming,
  entryDocs,
  hooks = {},
) {
  const { windowStart: ws, windowEnd: we, leagueGamesN } = contestTiming;
  const { onSkipEntry } = hooks;

  const rows = await Promise.all(
    entryDocs.map(async (entryDoc) => {
      const uid = entryDoc.id;
      const ed = entryDoc.data();
      if (!isRecord(ed)) {
        onSkipEntry?.({ uid, reason: 'skip_entry_bad_shape' });
        return null;
      }
      const joinedAt = ed.joinedAt;
      if (!(joinedAt instanceof Timestamp)) {
        onSkipEntry?.({ uid, reason: 'skip_entry_bad_joined_at' });
        return null;
      }

      const slateEvents = await loadQualifyingSlate(
        db,
        uid,
        ws,
        we,
        joinedAt,
        leagueGamesN,
      );
      const tall = tallySlate(slateEvents, leagueGamesN);
      const displayName =
        ed.displayNameSnapshot === null || typeof ed.displayNameSnapshot === 'string'
          ? ed.displayNameSnapshot
          : null;

      const tier = tall.gamesPlayed >= leagueGamesN ? 'full' : 'partial';

      return {
        uid,
        wins: tall.wins,
        gamesPlayed: tall.gamesPlayed,
        losses: tall.losses,
        abandoned: tall.abandoned,
        displayName,
        tieBreakKey: `uid:${uid}`,
        tier,
      };
    }),
  );

  /** @type {object[]} */
  const standingInputs = rows.filter((r) => r != null);
  assignDenseRanks(standingInputs, leagueGamesN);

  return standingInputs.map((row) => ({
    rank: row.rank,
    uid: row.uid,
    wins: row.wins,
    gamesPlayed: row.gamesPlayed,
    losses: row.losses,
    abandoned: row.abandoned,
    displayName: row.displayName ?? null,
    tieBreakKey: row.tieBreakKey,
    tier: row.tier,
  }));
}
