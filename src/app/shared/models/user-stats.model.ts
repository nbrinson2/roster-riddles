/**
 * Shape of `users/{uid}/stats/summary` (see `server/lib/stats-aggregate.js`).
 * Firestore may omit fields until first write.
 */
export interface UserStatsTotals {
  gamesPlayed: number;
  wins: number;
  losses: number;
  abandoned: number;
}

export interface UserStatsBestsByMode {
  fastestWinMs: number | null;
  fewestMistakesWin: number | null;
}

export interface UserStatsDocument {
  aggregateVersion?: number;
  totals?: UserStatsTotals;
  totalsByMode?: Record<string, UserStatsTotals>;
  streaks?: {
    currentWinStreak: number;
    bestWinStreak: number;
    /** Correct nickname guesses in a row (from gameplay `modeMetrics`). */
    nicknameStreak?: {
      current: number;
      best: number;
    };
  };
  bests?: {
    fastestWinMs: number | null;
    fewestMistakesWin: number | null;
    byMode?: Record<string, UserStatsBestsByMode>;
  };
  lastPlayedAt?: unknown;
  updatedAt?: unknown;
  statsUpdatedAt?: unknown;
}

/** Matches `STATS_DOC_ID` on the server. */
export const USER_STATS_DOC_ID = 'summary' as const;
