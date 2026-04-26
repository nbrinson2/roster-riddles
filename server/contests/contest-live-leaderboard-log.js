/**
 * Structured logs for GET /api/v1/contests/:contestId/leaderboard (Phase 1 live standings).
 */

/**
 * @param {Record<string, unknown>} payload
 */
export function logContestLiveLeaderboardLine(payload) {
  console.log(
    JSON.stringify({
      component: 'contest_live_leaderboard',
      severity: 'INFO',
      ...payload,
    }),
  );
}
