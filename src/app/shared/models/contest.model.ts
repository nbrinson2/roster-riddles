/**
 * Firestore `contests/{contestId}` — weekly contests Phase 4 Story B1.
 * @see docs/weekly-contests-schema-contests.md
 */

export const CONTEST_SCHEMA_VERSION = 1;

/** Phase 4 v1 allows only Bio Ball contests; future ADRs may extend. */
export const CONTEST_GAME_MODE_BIO_BALL = 'bio-ball' as const;
export type ContestGameModeV1 = typeof CONTEST_GAME_MODE_BIO_BALL;

export type ContestStatus =
  | 'scheduled'
  | 'open'
  | 'scoring'
  | 'paid'
  | 'cancelled';

/** Product default for `leagueGamesN` when creating contests (ADR). */
export const CONTEST_DEFAULT_LEAGUE_GAMES_N = 10;

/**
 * Stored at contests/{contestId}.
 * Timestamps are Firestore Timestamp in DB; `unknown` matches leaderboard snapshot pattern until bound at read sites.
 */
export interface ContestDocument {
  schemaVersion: number;
  status: ContestStatus;
  gameMode: ContestGameModeV1 | string;
  rulesVersion: number | string;
  windowStart: unknown;
  windowEnd: unknown;
  leagueGamesN: number;
  title?: string;
  createdAt: unknown;
  updatedAt: unknown;
  /** Admin notes only — no PII */
  metadata?: Record<string, unknown>;
}
