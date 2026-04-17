# Weekly contests — join API (Story C1)

**Status:** Implemented (Express)  
**Depends on:** [weekly-contests-schema-contests.md](weekly-contests-schema-contests.md), [weekly-contests-schema-entries.md](weekly-contests-schema-entries.md)

## Endpoint

`POST /api/v1/contests/:contestId/join`

**Auth:** `Authorization: Bearer <Firebase ID token>` (same as `GET /api/v1/me`).

**Body (optional JSON):**

```json
{
  "clientRequestId": "opaque-string-for-logging-optional"
}
```

## Success — **200**

```json
{
  "idempotentReplay": false,
  "entry": {
    "schemaVersion": 1,
    "contestId": "…",
    "uid": "…",
    "rulesAcceptedVersion": 1,
    "joinedAt": "2026-04-17T12:00:00.000Z",
    "displayNameSnapshot": "Player",
    "clientRequestId": "…"
  },
  "contest": {
    "contestId": "…",
    "status": "open",
    "gameMode": "bio-ball",
    "rulesVersion": 1,
    "leagueGamesN": 10,
    "windowStart": "…",
    "windowEnd": "…",
    "title": "…"
  }
}
```

If the user already has an entry document, **`idempotentReplay`** is **`true`** and the same shapes are returned (no duplicate write).

## Errors

| HTTP | `error.code` | When |
|------|----------------|------|
| 400 | `validation_error` | Bad `contestId` or JSON body |
| 400 | `contest_not_open` | Contest `status !== open` |
| 400 | `join_window_closed` | Server time not in `[windowStart, windowEnd)` |
| 400 | `wrong_game_mode` | Contest is not Bio Ball (Phase 4 v1) |
| 401 | `unauthenticated` | Missing/invalid Bearer token |
| 404 | `contest_not_found` | No `contests/{contestId}` document |
| 429 | `rate_limited` | Per-uid join rate cap (see below) |
| 500 | `internal_error` | Firestore/Auth failure |
| 503 | `server_misconfigured` | Admin SDK / Firestore not configured |

## Rate limits (F1-style)

| Env | Default |
|-----|---------|
| `CONTEST_JOIN_RATE_LIMIT_MAX` | **30** / window |
| `CONTEST_JOIN_RATE_LIMIT_WINDOW_MS` | **60000** |

Disable all rate limits (local stress): `RATE_LIMITS_DISABLED=true` (same as leaderboards/gameplay).

## Logging

Structured lines: `component: contest_join`, `outcome`, `requestId`, `httpStatus`, **`contestId`** — **no** email; **uid** is implied by authenticated subject only in your access logs if at all.

## Implementation

| File | Role |
|------|------|
| `server/contest-join.http.js` | Handler |
| `server/contest-join-log.js` | JSON logs |
| `server/rate-limit-hooks.middleware.js` | `contestJoinRateLimitHookMiddleware` |
| `index.js` | Route registration |

## References

- [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — Story C1  
