/**
 * Precomputed leaderboard snapshot documents (Story B2 — batch path).
 * Path: leaderboards/snapshots/boards/{boardId} — see docs/leaderboards-schema-precomputed.md
 */

export const LEADERBOARD_SNAPSHOT_SCHEMA_VERSION = 1;

/** Path segment under leaderboards/snapshots/boards/{boardId} */
export const LEADERBOARD_BOARD_IDS = [
  'global',
  'bio-ball',
  'career-path',
  'nickname-streak',
] as const;

export type LeaderboardBoardId = (typeof LEADERBOARD_BOARD_IDS)[number];

export type LeaderboardSnapshotTieBreakPolicy = 'score_desc_uid_asc';

/** One row inside snapshot.entries (denormalized for cheap reads). */
export interface LeaderboardSnapshotEntry {
  rank: number;
  uid: string;
  score: number;
  tieBreakKey: string;
  displayName?: string | null;
}

/**
 * Stored at leaderboards/snapshots/boards/{boardId}.
 * Timestamps are Firestore Timestamp in DB; `unknown` keeps Angular types loose until read.
 */
export interface LeaderboardSnapshotDocument {
  schemaVersion: number;
  boardId: LeaderboardBoardId;
  tieBreakPolicy: LeaderboardSnapshotTieBreakPolicy;
  topK: number;
  entries: LeaderboardSnapshotEntry[];
  generatedAt: unknown;
  /** Optional: STATS_SCHEMA_VERSION from server/lib/stats-aggregate.js when job ran. */
  aggregateSchemaVersion?: number;
  /** Optional: number of user stats docs scanned. */
  sourceRowCount?: number;
}
