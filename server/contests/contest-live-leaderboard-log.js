/**
 * Structured logs for `GET /api/v1/contests/:contestId/leaderboard`.
 *
 * Common fields (when applicable): `requestId`, `outcome`, `httpStatus`, `latencyMs`,
 * `contestId`, `rowCount` (standings rows returned), `entrantsConsidered` (entry docs read),
 * `entrantsCapped`, `cacheHit`, `status` (contest status when `contest_not_open`),
 * `message` (errors). Use in Cloud Logging / log-based metrics (Phase 5).
 */

/**
 * @param {Record<string, unknown>} payload
 */
export function logContestLiveLeaderboardLine(payload) {
  const { severity: explicitSeverity, ...rest } = payload;
  const httpStatus = rest.httpStatus;
  const severity =
    typeof explicitSeverity === 'string'
      ? explicitSeverity
      : typeof httpStatus === 'number' && httpStatus >= 500
        ? 'ERROR'
        : typeof httpStatus === 'number' && httpStatus === 429
          ? 'WARNING'
          : 'INFO';
  console.log(
    JSON.stringify({
      component: 'contest_live_leaderboard',
      severity,
      ...rest,
    }),
  );
}
