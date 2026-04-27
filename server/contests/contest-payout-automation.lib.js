/**
 * Phase 6 — Cloud Scheduler batch: find `paid` contests that may still need prize execute.
 * @see docs/weekly-contests/weekly-contests-phase6-ops.md
 */

/**
 * @param {unknown} contestData — `contests/{id}` document fields
 * @returns {boolean}
 */
export function contestEligibleForAutomatedPayoutSweep(contestData) {
  if (contestData == null || typeof contestData !== 'object') {
    return false;
  }
  const c = /** @type {Record<string, unknown>} */ (contestData);
  if (c.status !== 'paid') {
    return false;
  }
  const p = c.prizePayoutStatus;
  if (p === 'held' || p === 'completed' || p === 'failed') {
    return false;
  }
  return true;
}

/**
 * @param {unknown} contestData
 * @param {string | undefined} gameMode — when set, contest must match this `gameMode`
 * @returns {boolean}
 */
export function contestMatchesGameModeFilter(contestData, gameMode) {
  if (gameMode === undefined || gameMode.trim() === '') {
    return true;
  }
  if (contestData == null || typeof contestData !== 'object') {
    return false;
  }
  const gm = /** @type {Record<string, unknown>} */ (contestData).gameMode;
  return typeof gm === 'string' && gm === gameMode.trim();
}
