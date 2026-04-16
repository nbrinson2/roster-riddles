/**
 * Story 9 — Structured logs for POST /api/v1/me/gameplay-events (no secrets).
 * One JSON object per line on stdout for Cloud Logging / log-based metrics.
 */

/**
 * @param {Record<string, unknown>} payload
 */
export function logGameplayEventLine(payload) {
  const httpStatus = /** @type {number} */ (payload.httpStatus);
  const severity =
    httpStatus >= 500
      ? 'ERROR'
      : httpStatus >= 400
        ? 'WARNING'
        : 'INFO';
  const line = {
    component: 'gameplay-events',
    severity,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const sink = severity === 'ERROR' ? console.error : console.log;
  sink(JSON.stringify(line));
}
