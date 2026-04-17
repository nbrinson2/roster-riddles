# Weekly contests — close-window detector + enqueue (Story E1)

**Status:** Implemented (Express + Admin SDK)  
**Depends on:** [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md), [weekly-contests-ops-d1.md](weekly-contests-ops-d1.md) (D1 transitions)

## Behavior

1. **Query** `contests` where **`status == open`** and **`windowEnd <= now`** (uses composite index `status` + `windowEnd`), ordered by `windowEnd` ascending, **batched** (default 25, max 100 via env).
2. For each candidate, a **Firestore transaction** re-reads the doc and:
   - Skips if no longer `open` (concurrent scheduler — **dedupe**).
   - Skips if **`gameMode !== bio-ball`**.
   - Applies the same **`open` → `scoring`** guard as D1 (`evaluateTransitionGuards`, no `force`).
   - Updates **`status: scoring`**, **`updatedAt`** server timestamp.
3. After a successful transition, **optionally** `POST`s to **`CONTEST_SCORING_WEBHOOK_URL`** (Story E2 worker). Non-2xx or network errors are **logged** but do **not** roll back the transition (at-least-once enqueue; worker must be idempotent).

## Endpoint

`POST /api/internal/v1/contests/close-due-windows`

**Auth** (either):

- `Authorization: Bearer <CONTEST_WINDOW_CRON_SECRET>`, or  
- `CONTESTS_OPERATOR_SECRET` if `CONTEST_WINDOW_CRON_SECRET` is unset (small deployments), or  
- Header `x-contest-window-cron-secret: <same value>`

If **neither** cron nor operator secret is configured → **503** `server_misconfigured`.

**Response — 200**

```json
{
  "ok": true,
  "examined": 2,
  "transitioned": ["contest-a", "contest-b"],
  "skipped": [],
  "webhookFailures": [],
  "hasMore": false
}
```

- **`hasMore`:** `true` when the query returned **batch size** hits (there may be additional due contests — run again or shorten scheduler interval).
- **`webhookFailures`:** Contest IDs where the scoring webhook returned non-2xx or fetch failed (status already **`scoring`**).

## Environment

| Variable | Role |
|----------|------|
| `CONTEST_WINDOW_CRON_SECRET` | Preferred secret for this hook (omit if reusing operator secret). |
| `CONTESTS_OPERATOR_SECRET` | Fallback when `CONTEST_WINDOW_CRON_SECRET` is unset. |
| `CONTEST_CLOSE_WINDOW_BATCH_SIZE` | Batch size (default **25**, max **100**). |
| `CONTEST_SCORING_WEBHOOK_URL` | Optional. Point to **`POST /api/internal/v1/contests/run-scoring`** (Story E2). Body: `{ contestId, trigger, requestId }`. |
| `CONTEST_SCORING_WEBHOOK_SECRET` | Optional `Authorization: Bearer` for the outbound POST — typically the **same** value as `CONTESTS_OPERATOR_SECRET` so the E2 route accepts the call. |

## Logging

Structured JSON lines: **`component: contest_scoring`**, with **`contestId`** on per-contest lines (`phase`: `transition` \| `enqueue`, `outcome`, `requestId`).

## Missed trigger / manual recovery

1. **Re-run the hook** — safe and idempotent for contests already in **`scoring`** (transaction no-ops).
2. **Single contest** — use D1 **`POST /api/internal/v1/contests/:contestId/transition`** with `{ "to": "scoring", "force": true }` only if you must close before `windowEnd` in staging (see [weekly-contests-ops-d1.md](weekly-contests-ops-d1.md)).
3. **Webhook only failed** — contest is already **`scoring`**; replay worker via your ops pipeline or call the webhook manually with `{ "contestId", "trigger": "window_closed", "requestId": "…" }`.

## Cloud Scheduler (example)

```bash
curl -sS -X POST "$API_BASE/api/internal/v1/contests/close-due-windows" \
  -H "Authorization: Bearer $CONTEST_WINDOW_CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}'
```

## Implementation

| File | Role |
|------|------|
| `server/contest-close-due-windows.http.js` | HTTP handler |
| `server/contest-scoring-log.js` | `component: contest_scoring` logs |
| `server/contest-transitions.js` | Shared `open`→`scoring` guard |
| `index.js` | Route registration |

## References

- [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — Story E1  
