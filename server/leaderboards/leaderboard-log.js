/**
 * Structured logs for GET /api/v1/leaderboards (Story D1) — Story 9 pattern.
 */

/**
 * @param {Record<string, unknown>} payload
 */
export function logLeaderboardLine(payload) {
  const httpStatus = /** @type {number} */ (payload.httpStatus);
  const severity =
    httpStatus >= 500
      ? 'ERROR'
      : httpStatus >= 400
        ? 'WARNING'
        : 'INFO';
  const line = {
    component: 'leaderboards',
    severity,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const sink = severity === 'ERROR' ? console.error : console.log;
  sink(JSON.stringify(line));
}
