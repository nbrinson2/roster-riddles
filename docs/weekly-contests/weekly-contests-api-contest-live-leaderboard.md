# API — Live contest leaderboard (Phases 1–2, 5 ops)

**Route:** `GET /api/v1/contests/:contestId/leaderboard`  
**Auth:** None (public read). **Rate limit:** per client IP — `CONTEST_LIVE_STANDINGS_RATE_LIMIT_MAX` / `CONTEST_LIVE_STANDINGS_RATE_LIMIT_WINDOW_MS` (defaults match global leaderboard scale; see [leaderboards-rate-limits-f1.md](../leaderboards/leaderboards-rate-limits-f1.md)).

## Preconditions

- Contest document exists at `contests/{contestId}`.
- **`status` must be `open`.** For `scoring`, `paid`, `scheduled`, etc., the handler returns **400** with `error.code: contest_not_open` (use `results/final` after close when available).
- **`gameMode` must be `bio-ball`** (v1); otherwise **400** `wrong_game_mode`.

## Computation

Standings use the same pipeline as E2 scoring: `loadQualifyingSlate` → `tallySlate` → `assignDenseRanks` from `server/contests/contest-standings-compute.js` (shared with `contest-scoring-job.js`). See [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md).

## Limits

- At most **`500`** entry documents are read per request (`CONTEST_LIVE_LEADERBOARD_MAX_ENTRANTS` in `server/contests/contest-live-leaderboard.constants.js`). If the slice is full, **`entrantsCapped`** is **`true`** in the JSON body.

## Firestore (Phase 4 rules posture)

`contests/{contestId}/liveStandings/{docId}` is **denied** for all client reads and writes in `firestore.rules`. If you add a worker-written projection later, keep the SPA on **this HTTP route** unless rules and abuse controls are explicitly designed for direct reads.

## Caching (Phase 2)

- **Process-local** in-memory cache (not shared across Cloud Run replicas).
- **TTL:** `CONTEST_LIVE_LEADERBOARD_CACHE_TTL_MS` (default **30000**). Set **`0`** to disable caching.
- **Eviction:** `CONTEST_LIVE_LEADERBOARD_CACHE_MAX_KEYS` (default **250**); oldest inserted key dropped when full.
- **Fingerprint** invalidates on new/changed entries (`joinedAt` per uid), contest `updatedAt`, window, `leagueGamesN`, or entrant-cap boundary.
- **JSON:** `cache: { hit: true | false }`. On **`hit: true`**, **`computedAt`** is from the first computation in the TTL window (not “now”).

## Success response (`200`)

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `number` | **`1`**. |
| `contestId` | `string` | Path id. |
| `status` | `string` | Always **`open`** when this endpoint succeeds. |
| `gameMode` | `string` | **`bio-ball`**. |
| `leagueGamesN` | `number` | From contest. |
| `windowStart` | `string` \| `null` | ISO 8601 from contest `windowStart`. |
| `windowEnd` | `string` \| `null` | ISO 8601 from contest `windowEnd`. |
| `computedAt` | `string` | ISO 8601 wall time when the response was built (not a Firestore server timestamp). |
| `tieBreakPolicy` | `string` | Same constant as `results/final` (e.g. `mini_league_wins_desc_losses_asc_uid_asc`). |
| `eventSource` | `string` | Same as `results/final` (e.g. `gameplayEvents_first_n_bio_ball_after_join`). |
| `entrantsConsidered` | `number` | Entry docs read (≤ 500). |
| `entrantsCapped` | `boolean` | `true` if `entrantsConsidered` hit the cap. |
| `standings` | `array` | Same row shape as [weekly-contests-schema-results.md](weekly-contests-schema-results.md#standing-row) (`rank`, `uid`, `wins`, `gamesPlayed`, `losses`, `abandoned`, `displayName`, `tieBreakKey`, `tier`). **`displayName`:** join snapshot when present; otherwise **Firebase Auth email local part** (never full email); if still absent, clients may show `uid`. |
| `cache` | `object` | **`{ hit: boolean }`** — `hit: true` when served from TTL cache. |

## Errors

| HTTP | `error.code` | When |
|------|----------------|------|
| 400 | `validation_error` | Invalid `contestId`. |
| 400 | `contest_not_open` | Contest exists but is not `open`. |
| 400 | `wrong_game_mode` | Not Bio Ball v1. |
| 404 | `contest_not_found` | Missing contest doc. |
| 429 | `rate_limited` | IP limit exceeded. |
| 503 | `server_misconfigured` | Admin Firestore not available. |
| 500 | `internal_error` | Unexpected failure while computing. |

## Angular (Phase 3)

The nav **leaderboard panel** weekly tab calls this route using `environment.baseUrl` (same-origin in prod). Polling interval: **`contestLiveLeaderboardPollIntervalMs`** / build env above.

## Operations & monitoring (Phase 5)

### Server / build environment

| Variable | Where | Effect |
|----------|--------|--------|
| `CONTEST_LIVE_STANDINGS_RATE_LIMIT_MAX` | Cloud Run / `.env` | Max requests per IP per window (default **90**). |
| `CONTEST_LIVE_STANDINGS_RATE_LIMIT_WINDOW_MS` | Cloud Run / `.env` | Window length in ms (default **60000**). |
| `CONTEST_LIVE_LEADERBOARD_CACHE_TTL_MS` | Cloud Run / `.env` | In-process cache TTL; **`0`** disables. |
| `CONTEST_LIVE_LEADERBOARD_CACHE_MAX_KEYS` | Cloud Run / `.env` | Max cached fingerprints per replica. |
| `CONTEST_LIVE_LEADERBOARD_POLL_MS` | **Cloud Build** / `generate-env-prod.mjs` | Angular poll interval; **`0`** / off / none disables client polling. |
| `LEADERBOARD_CONTEST_TAB_ENABLED` | **Cloud Build** | **`false`** hides the weekly-contest segment in the leaderboard panel. |

See [.env.example](../../.env.example) and [leaderboards-rate-limits-f1.md](../leaderboards/leaderboards-rate-limits-f1.md).

### Structured logs

Each request emits one JSON line to stdout with **`component`: `contest_live_leaderboard`** (`server/contests/contest-live-leaderboard-log.js`). Typical fields:

| Field | Meaning |
|-------|---------|
| `outcome` | e.g. `ok`, `ok_cache_hit`, `contest_not_open`, `rate_limited`, `query_failed`, … |
| `httpStatus` | Response status. |
| `latencyMs` | Wall time for the handler. |
| `contestId` | Contest id (may be null on validation / rate-limit paths). |
| `rowCount` | Length of `standings` returned. |
| `entrantsConsidered` | Entry documents read from Firestore (≤ 500). |
| `entrantsCapped` | `true` if read hit the cap. |
| `cacheHit` | `true` / `false` on success paths (cache served vs recomputed). |
| `requestId` | Correlate with HTTP middleware. |

**Severity:** **`ERROR`** for `httpStatus >= 500`, **`WARNING`** for **429**, else **INFO** (unless overridden).

### Alerts (GCP)

Use **Logs Explorer** filters on `jsonPayload.component="contest_live_leaderboard"`, then **log-based metrics**:

- **Latency:** distribution metric on `jsonPayload.latencyMs` with a Logs filter such as `jsonPayload.outcome="ok" OR jsonPayload.outcome="ok_cache_hit"`; alert on **p95** or **p99** above a threshold for your tier.  
- **Errors:** count lines where `jsonPayload.httpStatus >= 500` or `jsonPayload.outcome` is `query_failed`, `firestore_init_failed`, `invalid_contest_document`, etc.

**Runbook:** [leaderboards-runbook.md §8](../leaderboards/leaderboards-runbook.md#8-live-contest-leaderboard-phase-5) — staging smoke, E2 parity procedure, rollout table.

## Related

- [leaderboards-contest-live-roadmap.md](../leaderboards/leaderboards-contest-live-roadmap.md) — Phases 0–5  
- [weekly-contests-api-d2.md](weekly-contests-api-d2.md) — Authenticated contest list/detail (different route family)
