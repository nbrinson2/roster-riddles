/**
 * Phase 6 P6-D3 — gate automated (Scheduler) payout execution; manual operator paths ignore this.
 * @see docs/weekly-contests/weekly-contests-phase6-ops.md
 */

/**
 * @returns {boolean} — true only when env is exactly `true` (trimmed).
 */
export function isPayoutsAutomationEnabled() {
  return process.env.PAYOUTS_AUTOMATION_ENABLED?.trim() === 'true';
}
