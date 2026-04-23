# Duplicate accounts — friction (Story F2)

**Status:** Implemented (minimal)  
**Depends on:** [leaderboards-phase3-adr.md](leaderboards-phase3-adr.md) (Story A0 — anti-abuse P1)

## Decision (v1)

**One lever:** users who do **not** have **`emailVerified === true`** in Firebase Auth are **omitted** from published leaderboard rows returned by **`GET /api/v1/leaderboards`** and from **precomputed snapshot** documents rebuilt by the E2 job.

- **Rationale:** Reduces throwaway unverified accounts cluttering public rankings; aligns with ADR “verified email to appear on board” (P1).
- **Not in v1:** Captcha at signup, device fingerprinting, or “shadow period” — track separately if product wants them.

## Enforcement

| Layer | Behavior |
|-------|----------|
| **HTTP API** | After each Firestore page is sorted, Auth **`getUsers`** supplies `emailVerified`; unverified `uid`s are skipped. **Ranks** keep global positions within the queried slice (gaps where omitted users would have been). |
| **Snapshot job** | Same filter before writing **`leaderboards/snapshots/boards/{boardId}`**; ranks are **dense** 1…N among listed users only. |

Firestore **rules** are unchanged; listing policy is **server-side** only.

## API contract

Successful **`GET /api/v1/leaderboards`** responses include:

```json
"listingPolicy": { "emailVerifiedRequired": true }
```

When **`emailVerifiedRequired`** is `false` (QA / env bypass), all users with stats may appear.

## QA and test accounts

Set **`LEADERBOARD_REQUIRE_EMAIL_VERIFIED=false`** on the **Express** process (e.g. staging Cloud Run env or local `.env`). **Do not** use this in production unless product explicitly allows it.

- Document in runbooks who may toggle it and for how long.
- **Never** commit `false` into checked-in prod config.

## User-facing copy (FAQ)

**Q: I have wins but I’m not on the leaderboard.**  
**A:** Confirm your account email is **verified** in Firebase Auth (same email you use to sign in). Until verification, wins still count in your private stats; they are not shown on the public board.

The Angular leaderboard panel may show a short line when **`listingPolicy.emailVerifiedRequired`** is true (see `leaderboard-panel` template).

## References

- `server/leaderboards/leaderboard-email-verified.js`, `server/lib/auth-display-names.js` (`fetchAuthFieldsForUids`)
- [leaderboards-phase3-jira.md](leaderboards-phase3-jira.md) — Story F2
