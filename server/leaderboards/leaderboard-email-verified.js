/**
 * Story F2 — duplicate-account friction: only Auth email-verified users appear on published leaderboards.
 * @see docs/leaderboards/leaderboards-duplicate-accounts-f2.md
 */

/**
 * When not `false`, leaderboard listing omits users without `emailVerified` in Firebase Auth.
 * Set `LEADERBOARD_REQUIRE_EMAIL_VERIFIED=false` for QA / staging test accounts (document only).
 */
export function isLeaderboardEmailVerifiedEnforced() {
  return process.env.LEADERBOARD_REQUIRE_EMAIL_VERIFIED !== 'false';
}

/**
 * @param {{ uid: string, score: number }[]} sorted
 * @param {Map<string, { emailVerified?: boolean }>} authByUid
 */
export function filterSortedForVerifiedLeaderboard(sorted, authByUid) {
  if (!isLeaderboardEmailVerifiedEnforced()) {
    return sorted;
  }
  return sorted.filter((r) => authByUid.get(r.uid)?.emailVerified === true);
}
