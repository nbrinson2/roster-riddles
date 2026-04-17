/**
 * Virtual leaderboard row for the query path (Story B1).
 * Rows are materialized server-side from `users/{uid}/stats/summary` (+ Auth for display names).
 * Not stored as a separate Firestore collection in v1.
 *
 * Pagination limits (Story B3): enforced in trusted API / Admin SDK queries — see
 * `docs/leaderboards-indexes-pagination.md`.
 */
/** Maximum `limit` per collection-group leaderboard query or HTTP page (cost cap). */
export const LEADERBOARD_MAX_PAGE_SIZE = 50;

/** Suggested default page size for UI and APIs. */
export const LEADERBOARD_DEFAULT_PAGE_SIZE = 25;

export type LeaderboardScope =
  | 'global'
  | 'bio-ball'
  | 'career-path'
  | 'nickname-streak';

/**
 * One ranked line on a board. `displayName` is optional and comes from trusted code (e.g. Auth), not from stats doc.
 */
export interface LeaderboardEntryRow {
  rank: number;
  uid: string;
  score: number;
  scope: LeaderboardScope;
  /** Stable tie-break per ADR (typically uid ascending). */
  tieBreakKey: string;
  displayName?: string | null;
}
