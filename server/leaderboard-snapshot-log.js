/**
 * Structured logs for leaderboard snapshot batch job (Story E2) — Story 9 pattern.
 */

/**
 * @param {Record<string, unknown>} payload
 */
export function logLeaderboardSnapshotJobLine(payload) {
  const outcome = /** @type {string} */ (payload.outcome ?? 'unknown');
  const severity =
    outcome === 'error' || outcome === 'unauthorized' ? 'ERROR' : 'INFO';
  const line = {
    component: 'leaderboard_snapshot_job',
    severity,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const sink = severity === 'ERROR' ? console.error : console.log;
  sink(JSON.stringify(line));
}
