/**
 * `contests/{contestId}/results/final` — weekly contests Phase 4 Story B3.
 * @see docs/weekly-contests-schema-results.md
 */

export const CONTEST_FINAL_RESULTS_SCHEMA_VERSION = 1;

export type ContestFinalTieBreakPolicy =
  | 'mini_league_wins_desc_losses_asc_uid_asc'
  | string;

export type ContestStandingTier = 'full' | 'partial';

/** One row in `standings` after scoring (immutable snapshot). */
export interface ContestStandingRow {
  rank: number;
  uid: string;
  wins: number;
  gamesPlayed: number;
  losses: number;
  abandoned: number;
  displayName?: string | null;
  /** Deterministic tie-break key for this row (e.g. uid). */
  tieBreakKey: string;
  /** Tier A (full N games) vs Tier B (partial slate), ADR. */
  tier?: ContestStandingTier;
}

/**
 * Stored at contests/{contestId}/results/final.
 * Timestamps are Firestore Timestamp in DB.
 */
export interface ContestFinalResultsDocument {
  schemaVersion: number;
  computedAt: unknown;
  windowStart: unknown;
  windowEnd: unknown;
  gameMode: string;
  leagueGamesN: number;
  standings: ContestStandingRow[];
  tieBreakPolicy: ContestFinalTieBreakPolicy;
  scoringJobId: string;
  eventSource: string;
  /** Optional monotonic retry counter for idempotent scoring jobs. */
  scoringAttempt?: number;
  /** Optional structured tie audit — avoid PII beyond public display. */
  tieResolution?: Record<string, unknown> | unknown[];
}
