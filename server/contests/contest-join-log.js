/**
 * Structured logs for POST /api/v1/contests/:contestId/join (Story C1).
 */

/**
 * @param {Record<string, unknown>} payload
 */
export function logContestJoinLine(payload) {
  const httpStatus = /** @type {number} */ (payload.httpStatus);
  const severity =
    httpStatus >= 500
      ? 'ERROR'
      : httpStatus >= 400
        ? 'WARNING'
        : 'INFO';
  const line = {
    component: 'contest_join',
    severity,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const sink = severity === 'ERROR' ? console.error : console.log;
  sink(JSON.stringify(line));
}
