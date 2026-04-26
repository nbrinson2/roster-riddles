# API — Live contest leaderboard (Phases 1–2)

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
| `standings` | `array` | Same row shape as [weekly-contests-schema-results.md](weekly-contests-schema-results.md#standing-row) (`rank`, `uid`, `wins`, `gamesPlayed`, `losses`, `abandoned`, `displayName`, `tieBreakKey`, `tier`). |
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

## Related

- [leaderboards-contest-live-roadmap.md](../leaderboards/leaderboards-contest-live-roadmap.md) — Phases 0–5  
- [weekly-contests-api-d2.md](weekly-contests-api-d2.md) — Authenticated contest list/detail (different route family)
