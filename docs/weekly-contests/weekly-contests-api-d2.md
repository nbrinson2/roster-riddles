# Weekly contests — read APIs (Story D2)

**Status:** Implemented (Express + Admin SDK)  
**Depends on:** [weekly-contests-schema-contests.md](weekly-contests-schema-contests.md), [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md)

## Auth

Both routes require **`Authorization: Bearer <Firebase ID token>`** (same as `GET /api/v1/me` and contest join). This matches the ADR posture: **authenticated** reads of **non-sensitive** contest fields; operator **`metadata`** is never returned.

## List

`GET /api/v1/contests`

**Query parameters**

| Name | Default | Description |
|------|---------|-------------|
| `limit` | `25` | Max items returned after merge/sort (clamped **1–50**). |
| `status` | *(all)* | Optional filter: comma-separated subset of **`open`**, **`scheduled`**. Example: `open` or `open,scheduled`. Invalid values alone → **400**. |

**Behavior:** Loads **`open`** contests (ordered by `windowStart` desc, cap 50) and **`scheduled`** contests (cap 50), merges Bio Ball (`gameMode === bio-ball`) rows, sorts (open first, then scheduled; open by soonest `windowEnd`, scheduled by soonest `windowStart`), then applies **`limit`**.

**Response — 200**

```json
{
  "schemaVersion": 1,
  "contests": [
    {
      "contestId": "…",
      "schemaVersion": 1,
      "status": "open",
      "gameMode": "bio-ball",
      "rulesVersion": 1,
      "leagueGamesN": 10,
      "windowStart": "2026-04-14T04:00:00.000Z",
      "windowEnd": "2026-04-21T04:00:00.000Z",
      "title": "Bio Ball mini-league — Week of Apr 14",
      "createdAt": "…",
      "updatedAt": "…"
    }
  ]
}
```

`title` may be omitted when absent. `createdAt` / `updatedAt` are ISO strings when present on the document.

## Detail

`GET /api/v1/contests/:contestId`

**Path:** `contestId` matches `^[a-zA-Z0-9_-]+$` (max 128 chars), URL-encoded as needed.

**Response — 200**

```json
{
  "schemaVersion": 1,
  "contest": {
    "contestId": "…",
    "schemaVersion": 1,
    "status": "open",
    "gameMode": "bio-ball",
    "rulesVersion": 1,
    "leagueGamesN": 10,
    "windowStart": "…",
    "windowEnd": "…",
    "title": "…",
    "createdAt": "…",
    "updatedAt": "…"
  }
}
```

## Errors

| HTTP | `error.code` | When |
|------|----------------|------|
| 400 | `validation_error` | Bad `contestId`, bad `status` filter, or detail exists but not Bio Ball v1 |
| 400 | `wrong_game_mode` | Detail: contest is not `bio-ball` |
| 401 | `unauthenticated` | Missing/invalid Bearer token |
| 404 | `contest_not_found` | No `contests/{contestId}` |
| 429 | `rate_limited` | Per-uid read cap (see below) |
| 500 | `internal_error` | Firestore failure |
| 503 | `server_misconfigured` | Admin SDK / Firestore not configured |

## Rate limits (F1-style)

| Env | Default |
|-----|---------|
| `CONTEST_READ_RATE_LIMIT_MAX` | **120** / window |
| `CONTEST_READ_RATE_LIMIT_WINDOW_MS` | **60000** |

Disable all rate limits (local): `RATE_LIMITS_DISABLED=true`.

## Logging

Structured lines: `component: contest_read`, `route` (`list` \| `detail`), `outcome`, `requestId`, `httpStatus`, optional `contestId`, **`uid`** (authenticated subject).

## Implementation

| File | Role |
|------|------|
| `server/contests/contest-read.http.js` | Handlers |
| `server/contests/contest-public.js` | Public projection (no `metadata`) |
| `server/contests/contest-read-log.js` | JSON logs |
| `server/middleware/rate-limit-hooks.middleware.js` | `contestReadRateLimitHookMiddleware` |
| `index.js` | Route registration |

## References

- [weekly-contests-api-c1.md](weekly-contests-api-c1.md) — join API  
- [weekly-contests-api-contest-live-leaderboard.md](weekly-contests-api-contest-live-leaderboard.md) — public live standings (`GET …/leaderboard`, no auth)  
- [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — Story D2  
