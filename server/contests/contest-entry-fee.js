/**
 * Contest `entryFeeCents` normalization — shared by join, checkout, and Stripe webhooks.
 * Kept Stripe-free so lightweight tests do not import `contest-checkout.http.js`.
 */

/**
 * @param {Record<string, unknown> | undefined} contest
 * @returns {number} Non-negative integer cents; `0` when absent or invalid.
 */
export function getEntryFeeCentsFromContest(contest) {
  if (contest == null || typeof contest !== 'object' || Array.isArray(contest)) {
    return 0;
  }
  const v = contest.entryFeeCents;
  if (typeof v !== 'number' || !Number.isFinite(v) || v < 0) {
    return 0;
  }
  return Math.floor(v);
}
