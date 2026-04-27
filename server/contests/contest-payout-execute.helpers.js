/**
 * Eligibility checks for Story P6-D2 automated prize transfers.
 * @see docs/weekly-contests/weekly-contests-ops-p6-payout-execute.md
 */

/**
 * @param {import('firebase-admin/firestore').DocumentSnapshot} entrySnap
 */
export function entryEligibleForAutomatedPrizePayout(entrySnap) {
  if (!entrySnap.exists) {
    return false;
  }
  const d = entrySnap.data();
  const ps = d && typeof d === 'object' ? /** @type {{ paymentStatus?: unknown }} */ (d).paymentStatus : undefined;
  return ps === 'paid' || ps === 'free';
}

/**
 * @param {import('firebase-admin/firestore').DocumentSnapshot} userSnap
 */
export function userConnectReadyForPayoutTransfer(userSnap) {
  if (!userSnap.exists) {
    return false;
  }
  const u = userSnap.data();
  if (!u || typeof u !== 'object') {
    return false;
  }
  const rec = /** @type {Record<string, unknown>} */ (u);
  const acct = rec.stripeConnectAccountId;
  if (typeof acct !== 'string' || !acct.startsWith('acct_')) {
    return false;
  }
  if (rec.stripeConnectPayoutsEnabled !== true) {
    return false;
  }
  if (rec.stripeConnectChargesEnabled !== true) {
    return false;
  }
  if (rec.stripeConnectDetailsSubmitted !== true) {
    return false;
  }
  return true;
}

/**
 * @param {string} contestId
 * @param {string} uid
 * @param {number} rank
 */
export function stripePayoutTransferIdempotencyKey(contestId, uid, rank) {
  const raw = `rr_payout_${contestId}_${uid}_${rank}`;
  return raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 255);
}
