# Leaderboards HTTP API (Story D1)

**Status:** Implemented  
**Depends on:** [leaderboards-indexes-pagination.md](leaderboards-indexes-pagination.md) (B3), [leaderboards-schema-query-path.md](leaderboards-schema-query-path.md) (B1)

## Endpoint

`GET /api/v1/leaderboards`

**Auth:** None required for v1 (public read). Rows include **`uid`**; **`displayName`** is filled from Firebase Auth when the Admin SDK can resolve users (best effort).

**Rate limiting:** Middleware attaches **`req.consumeLeaderboardRateLimit()`** (stub allows all traffic; Epic F can enforce limits). The handler returns **429** when the hook reports `allowed: false`.

**Logging:** JSON lines to stdout (`component: leaderboards`) with **`requestId`**, **`scope`**, **`latencyMs`**, **`rowCount`**, **`outcome`** — same pattern as gameplay events (Story 9).

## Query parameters

| Param | Required | Description |
|-------|----------|-------------|
| **`scope`** | Yes | `global` \| `bio-ball` \| `career-path` \| `nickname-streak` |
| **`pageSize`** | No | Default **25**, max **50** |
| **`pageToken`** | No | Opaque cursor from **`nextPageToken`** (alias: **`cursor`**) |
| **`week`** | — | **Unsupported** in v1 — returns **400** if present |

v1 does **not** use a separate `gameMode` param; per-mode boards use **`scope`** (`bio-ball`, etc.).

## Response JSON

```json
{
  "schemaVersion": 1,
  "scope": "global",
  "pageSize": 25,
  "entries": [
    {
      "rank": 1,
      "uid": "…",
      "score": 42,
      "scope": "global",
      "tieBreakKey": "…",
      "displayName": "Player Name"
    }
  ],
  "snapshotGeneratedAt": "2026-04-15T12:00:00.000Z",
  "nextPageToken": "…"
}
```

- **`snapshotGeneratedAt`:** ISO 8601 time from the precomputed snapshot doc’s **`generatedAt`** for this **`scope`** (Story E2), or **`null`** if no snapshot exists yet. One extra Firestore read per request.

`nextPageToken` is omitted when there is no further page.

## Batch rebuild hook (Story E2)

| | |
|---|---|
| **POST** | `/api/internal/v1/leaderboard-snapshots/rebuild` |
| **Auth** | `Authorization: Bearer <LEADERBOARD_SNAPSHOT_CRON_SECRET>` (or `X-Cron-Secret`) |
| **Purpose** | Rebuild all **`leaderboards/snapshots/boards/*`** documents from **`stats/summary`** |

See [leaderboards-batch-e2.md](leaderboards-batch-e2.md) for Scheduler setup and `npm run rebuild:leaderboard-snapshots`.

## Errors

| HTTP | `error.code` | When |
|------|----------------|------|
| 400 | `weekly_not_supported` | `week` was passed |
| 400 | `validation_error` | bad / missing `scope` |
| 400 | `invalid_page_token` | bad `pageToken` |
| 400 | `stale_page_token` | cursor doc missing (data changed) |
| 429 | `rate_limited` | rate limit hook (future) |
| 503 | `server_misconfigured` | Admin SDK / Firestore not configured |

## OpenAPI 3.0 fragment

```yaml
paths:
  /api/v1/leaderboards:
    get:
      summary: Leaderboard page (v1 all-time)
      parameters:
        - name: scope
          in: query
          required: true
          schema:
            type: string
            enum: [global, bio-ball, career-path, nickname-streak]
        - name: pageSize
          in: query
          schema: { type: integer, minimum: 1, maximum: 50, default: 25 }
        - name: pageToken
          in: query
          schema: { type: string }
        - name: cursor
          in: query
          description: Alias for pageToken
          schema: { type: string }
      responses:
        '200':
          description: OK
          content:
            application/json:
              schema:
                type: object
                required: [schemaVersion, scope, pageSize, entries, snapshotGeneratedAt]
                properties:
                  schemaVersion: { type: integer }
                  scope: { type: string }
                  pageSize: { type: integer }
                  snapshotGeneratedAt: { type: string, nullable: true, format: date-time }
                  entries:
                    type: array
                    items:
                      type: object
                      required: [rank, uid, score, scope, tieBreakKey]
                      properties:
                        rank: { type: integer }
                        uid: { type: string }
                        score: { type: number }
                        scope: { type: string }
                        tieBreakKey: { type: string }
                        displayName: { type: string, nullable: true }
                  nextPageToken: { type: string }
```

## Examples

First page (global, default size):

```http
GET /api/v1/leaderboards?scope=global
```

Second page:

```http
GET /api/v1/leaderboards?scope=global&pageToken=eyJ2IjoxLCJzY29wZSI6Imdsb2JhbCIsImFmdGVyUGF0aCI6InVzZXJzL3h5ei9zdGF0cy9zdW1tYXJ5Iiwic3RhcnRSYW5rIjoyNn0
```

(Actual token is base64url JSON; use the `nextPageToken` from the previous response verbatim.)

Bio Ball board:

```http
GET /api/v1/leaderboards?scope=bio-ball&pageSize=10
```

## Implementation

| File | Role |
|------|------|
| `server/leaderboards.http.js` | Express handler, **`snapshotGeneratedAt`** |
| `server/auth-display-names.js` | Auth display name lookup (shared with snapshot job) |
| `server/leaderboard-query.js` | Scope → Firestore field, token encode/decode, tie-break sort |
| `server/leaderboard-log.js` | Structured logs |
| `server/leaderboard-snapshot-job.js` | Batch rebuild of B2 snapshot docs (Story E2) |
| `server/leaderboards-snapshot-rebuild.http.js` | `POST` rebuild endpoint |
| `server/rate-limit-hooks.middleware.js` | `consumeLeaderboardRateLimit` stub |
| `index.js` | Route registration |

### Angular UI (Story D2)

| File | Role |
|------|------|
| `src/app/nav/leaderboard-panel/` | Panel in `mat-sidenav` — scope toggles, table, load more, loading/error/empty |
| `src/app/nav/nav.component.*` | `leaderboard` Material Symbol next to `info`; `openLeaderboard()` opens **start** sidenav |

Manual check: run Express + `ng serve` with `proxy.conf.json`; click **leaderboard** (left of info); sidenav opens from the left; data loads from `GET /api/v1/leaderboards`.

## References

- [leaderboards-phase3-jira.md](leaderboards-phase3-jira.md) — Story D1
- [leaderboards-batch-e2.md](leaderboards-batch-e2.md) — Story E2 (scheduled rebuild + `snapshotGeneratedAt`)
- [leaderboards-realtime-e1.md](leaderboards-realtime-e1.md) — Story E1 (optional HTTP short-poll vs B2 snapshot listener)
