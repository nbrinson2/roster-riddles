/**
 * `contests/{contestId}/results/final` — weekly contests Phase 4 Story B3.
 * @see docs/weekly-contests/weekly-contests-schema-results.md
 */

export const CONTEST_FINAL_RESULTS_SCHEMA_VERSION = 1;

export type ContestFinalTieBreakPolicy =
  | 'mini_league_wins_desc_losses_asc_uid_asc'
  | string;

export type ContestStandingTier = 'full' | 'partial';

/** Nested audit under `results/final` — Story E3 (see docs/weekly-contests/weekly-contests-schema-results.md). */
export interface ContestTieResolutionAudit {
  schemaVersion: number;
  policyRef: string;
  leagueGamesN: number;
  coinFlipOrRandomTieBreak: boolean;
  summary: string;
  comparisonSteps: {
    tierA_fullSlate: unknown[];
    tierB_partialSlate: unknown[];
  };
  statIdentityGroups: ContestStatIdentityGroupAudit[];
}

/** One group of entrants who tied on slate stats; order among them is by uid only. */
export interface ContestStatIdentityGroupAudit {
  tier: ContestStandingTier;
  ranks: number[];
  uidsInOrder: string[];
  resolvedBy: {
    step: string;
    randomness: string;
  };
  equalOnStats:
    | {
        wins: number;
        losses: number;
        abandoned: number;
        leagueGamesN: number;
      }
    | {
        wins: number;
        gamesPlayed: number;
      };
}

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
  /** Structured tie audit (Story E3). */
  tieResolution?: ContestTieResolutionAudit;
}
