# Weekly contests — scoring worker (Story E2)

**Status:** Implemented (Express + Admin SDK)  
**Depends on:** [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md) (mini-league scoring), [weekly-contests-schema-results.md](weekly-contests-schema-results.md) (B3 artifacts)

## Preconditions

- Contest **`status`** must be **`scoring`** (normally set by [Story E1](weekly-contests-ops-e1.md) close-window hook).
- **`gameMode`** must be **`bio-ball`**.
- Entrants are **`contests/{contestId}/entries/{uid}`**; for each, qualifying **`users/{uid}/gameplayEvents`** docs are those with:
  - **`gameMode === bio-ball`**
  - **`createdAt`** in **[max(windowStart, joinedAt), windowEnd)** (half-open on the right, matching ADR)
  - Ordered by **`createdAt` asc**, **first `leagueGamesN`** events form the **slate**.

## Endpoint

`POST /api/internal/v1/contests/run-scoring`

**Auth:** same as other internal hooks — **`Authorization: Bearer`** using **`CONTEST_WINDOW_CRON_SECRET`** or **`CONTESTS_OPERATOR_SECRET`**, or header **`x-contest-window-cron-secret`**.

**Body (JSON):**

```json
{
  "contestId": "your-contest-id",
  "scoringJobId": "optional-trace-id",
  "trigger": "window_closed",
  "requestId": "optional-echo"
}
```

Only **`contestId`** is required (regex same as other contest routes).

**Success — 200**

```json
{
  "ok": true,
  "contestId": "…",
  "scoringJobId": "score_…",
  "transitioned": true,
  "standingsCount": 12
}
```

- **`transitioned: false`** — contest was already **`paid`** (idempotent replay or concurrent worker).

## Writes (atomic batch transaction)

1. **`contests/{contestId}/results/final`** — standings, tie policy, `eventSource`, `scoringJobId`, structured **`tieResolution`** audit ([Story E3](weekly-contests-schema-results.md#tie-resolution-tieresolution)).
2. **`contests/{contestId}/payouts/dryRun`** — `FAKE_USD`, **`notRealMoney: true`**, simple lines (rank 1 → **10000** cents dry-run; others **0** in v1).
3. **`contests/{contestId}`** — **`status: paid`**, **`updatedAt`**.

**Idempotency:** Deterministic inputs → same standings. Re-running on **`scoring`** overwrites **`results/final`** and **`payouts/dryRun`** with the same logical content. If another run already moved the contest to **`paid`**, the transaction **no-ops** safely.

## Performance

- **Bounded reads:** one query per entrant (`entries` list size) on `users/{uid}/gameplayEvents` with **`limit leagueGamesN`**, not a global scan of all events.
- Deploy composite index **`gameplayEvents`: `gameMode` + `createdAt`** ([`firestore.indexes.json`](../firestore.indexes.json)).

## E1 webhook wiring

Set **`CONTEST_SCORING_WEBHOOK_URL`** to your API base + **`/api/internal/v1/contests/run-scoring`**.

Use **`CONTEST_SCORING_WEBHOOK_SECRET`** equal to the same value as **`CONTESTS_OPERATOR_SECRET`** (or **`CONTEST_WINDOW_CRON_SECRET`** if that is what the hook validates) so the POST is authorized. The body from E1 already includes **`contestId`** and **`requestId`**.

## Manual recovery

- **`scoring`** but job failed: re-POST **`run-scoring`** with the same **`contestId`** (idempotent).
- Wrong state: use D1 **`transition`** only per [weekly-contests-ops-d1.md](weekly-contests-ops-d1.md).

## Logging

JSON lines: **`component: contest_scoring`**, **`contestId`**, `phase: score`, `outcome`, `scoringJobId`, `requestId`.

## Implementation

| File | Role |
|------|------|
| `server/contest-scoring-core.js` | Slate tally + ADR sort + dense ranks |
| `server/contest-scoring-tie-audit.js` | Story E3 — `tieResolution` blob |
| `server/contest-scoring-job.js` | Firestore reads/writes |
| `server/contest-scoring.http.js` | HTTP handler |
| `server/contest-internal-auth.js` | Shared internal secret helpers |

## References

- [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — Stories E2, E3  
