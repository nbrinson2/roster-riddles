/**
 * Phase 5 Story P5-F1 — paid contest join replay rule (shared with tests without loading full join handler).
 * @param {FirebaseFirestore.DocumentData | undefined} data
 * @returns {boolean}
 */
export function isPaidContestEntryForJoinReplay(data) {
  if (data == null || typeof data !== 'object' || Array.isArray(data)) {
    return false;
  }
  return /** @type {Record<string, unknown>} */ (data).paymentStatus === 'paid';
}
