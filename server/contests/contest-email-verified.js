/**
 * Contest join / paid checkout require a verified email on the Firebase ID token
 * (`email_verified`), unless `CONTESTS_REQUIRE_EMAIL_VERIFIED=false` (QA only).
 */

export function isContestJoinEmailVerifiedEnforced() {
  return process.env.CONTESTS_REQUIRE_EMAIL_VERIFIED !== 'false';
}
