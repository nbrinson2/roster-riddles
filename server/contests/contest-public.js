/**
 * Public-safe contest projection for read APIs (Story D2).
 * Omits operator `metadata` and other internal-only fields.
 */
import { firestoreTimestampToIso } from '../lib/firestore-timestamp-iso.js';

/** Phase 4 v1 — must match contest join / ADR. */
export const CONTEST_PUBLIC_GAME_MODE_BIO_BALL = 'bio-ball';

/**
 * @param {string} contestId
 * @param {Record<string, unknown> | undefined} data
 * @returns {Record<string, unknown> | null} Null when not a displayable Bio Ball contest.
 */
export function mapContestDocumentToPublic(contestId, data) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return null;
  }
  const gameMode = data.gameMode;
  if (gameMode !== CONTEST_PUBLIC_GAME_MODE_BIO_BALL) {
    return null;
  }
  const status = data.status;
  if (typeof status !== 'string') {
    return null;
  }
  const rulesVersion = data.rulesVersion;
  if (
    rulesVersion !== undefined &&
    typeof rulesVersion !== 'number' &&
    typeof rulesVersion !== 'string'
  ) {
    return null;
  }
  const leagueGamesN = data.leagueGamesN;
  if (typeof leagueGamesN !== 'number' || !Number.isFinite(leagueGamesN)) {
    return null;
  }

  const schemaVersion =
    typeof data.schemaVersion === 'number' ? data.schemaVersion : 1;

  const prizePoolCents = data.prizePoolCents;
  const entryFeeCents = data.entryFeeCents;
  const maxEntries = data.maxEntries;

  return {
    contestId,
    schemaVersion,
    status,
    gameMode,
    rulesVersion,
    leagueGamesN,
    windowStart: firestoreTimestampToIso(data.windowStart),
    windowEnd: firestoreTimestampToIso(data.windowEnd),
    title: typeof data.title === 'string' ? data.title : undefined,
    createdAt: firestoreTimestampToIso(data.createdAt),
    updatedAt: firestoreTimestampToIso(data.updatedAt),
    ...(typeof prizePoolCents === 'number' &&
    Number.isFinite(prizePoolCents) &&
    prizePoolCents >= 0
      ? { prizePoolCents }
      : {}),
    ...(typeof entryFeeCents === 'number' &&
    Number.isFinite(entryFeeCents) &&
    entryFeeCents >= 0
      ? { entryFeeCents }
      : {}),
    ...(typeof maxEntries === 'number' &&
    Number.isFinite(maxEntries) &&
    maxEntries >= 1
      ? { maxEntries: Math.floor(maxEntries) }
      : {}),
  };
}
