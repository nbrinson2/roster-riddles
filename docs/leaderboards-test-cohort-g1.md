# Leaderboards — test cohort: seed + correctness checklist (Story G1)

**Status:** Implemented (fixture + verify script + checklist)  
**Depends on:** [leaderboards-api-d1.md](leaderboards-api-d1.md) (D1), [leaderboards-trusted-writer-c1.md](leaderboards-trusted-writer-c1.md) (C1), optional E1/E2 paths

## Goal

Provide a **repeatable** way to prove that a **small known set of staging users** has leaderboard-related **`stats/summary`** wins that match expectations and that **within-cohort** ordering follows the ADR tie-break (**wins desc**, **`uid` asc**).

This does **not** replace full production monitoring; it is an **exit gate** for “leaderboard correct for test cohort” before release.

## Fixture

1. Copy **[`docs/fixtures/leaderboard-cohort.example.json`](fixtures/leaderboard-cohort.example.json)** to **`leaderboard-test-cohort.json`** in the repo root (gitignored).
2. Replace placeholder UIDs with **real staging** Firebase Auth `uid`s whose `users/{uid}/stats/summary` you control (seed gameplay events or manual writes per Phase 2).
3. Set **`expected`** wins per scope (`global` required per row; per-mode keys optional).
4. Set **`expectedGlobalOrder`** to the cohort UIDs sorted by **global** wins descending, then **`uid` ascending** for ties — same as [`sortLeaderboardPageRows`](../server/leaderboard-query.js).

## Automated check

```bash
# From repo root; Admin credentials for staging (see docs/environment-matrix.md)
export GOOGLE_APPLICATION_CREDENTIALS=./secrets/roster-riddles-staging-adminsdk.json
export FIRESTORE_DATABASE_ID='(default)'

npm run verify:leaderboard-cohort
# or: node scripts/verify-leaderboard-cohort.mjs ./path/to/cohort.json
```

Exit **0** = wins match fixture and within-cohort global order matches. Exit **1** = mismatch or missing `stats/summary`. Exit **2** = bad fixture path / JSON / Firestore init.

## Manual spot-check (API)

After the script passes, hit the real read path (proxy or staging host):

```bash
curl -sS "https://<staging-api>/api/v1/leaderboards?scope=global&pageSize=50" | jq '.entries[] | {rank,uid,score}'
```

Confirm cohort members appear with plausible ranks (other users may interleave; the script only locks **cohort-internal** order and scores).

## Edge cases (known)

| Topic | v1 handling |
|-------|-------------|
| **Ties** | Same global wins → lower **`uid` string** ranks higher on the board (see ADR). Fixture **`expectedGlobalOrder`** must follow that rule. |
| **Weekly board** | **Not in v1** — no week boundary or timezone test for weekly leaderboard until a weekly story ships. |
| **Timezone / week boundary** | Reserved for weekly follow-up; ADR uses **`America/New_York`** when implemented. |
| **Email verified (F2)** | Production API **omits** `emailVerified: false` users from listings. For staging cohort accounts, either use **verified** test emails or set **`LEADERBOARD_REQUIRE_EMAIL_VERIFIED=false`** on Express **only** for QA (see [leaderboards-duplicate-accounts-f2.md](leaderboards-duplicate-accounts-f2.md)). |

## Sign-off checklist (staging)

Copy this table into a PR comment or release ticket and complete before “leaderboard OK for cohort.”

| Step | Done | Initials | Date |
|------|:----:|----------|------|
| Cohort `stats/summary` docs seeded / reconciled (see [stats-reconciliation.md](stats-reconciliation.md) per user if needed) | [ ] | | |
| `leaderboard-test-cohort.json` present locally (not committed) with real UIDs + expected wins + `expectedGlobalOrder` | [ ] | | |
| `npm run verify:leaderboard-cohort` exits **0** | [ ] | | |
| Manual `GET /api/v1/leaderboards?scope=global` spot-check | [ ] | | |
| Manual spot-check at least **one** per-mode board (`bio-ball`, `career-path`, or `nickname-streak`) | [ ] | | |
| If using F2 in staging: confirm test accounts **verified** or env bypass documented for this run | [ ] | | |

**Attestation (optional):** “I confirm leaderboard data matches the fixture for this cohort for the scopes checked above.”

**Signature:** __________________ **Date:** __________

## References

- Fixture example: [`docs/fixtures/leaderboard-cohort.example.json`](fixtures/leaderboard-cohort.example.json)
- Script: [`scripts/verify-leaderboard-cohort.mjs`](../scripts/verify-leaderboard-cohort.mjs)
- Jira: [leaderboards-phase3-jira.md](leaderboards-phase3-jira.md) — Story G1
- Ops: [leaderboards-runbook.md](leaderboards-runbook.md) — Story G2 (indexes, rebuild, kill switch)
