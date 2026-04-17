# Leaderboards & gameplay — API rate limits (Story F1)

**Status:** Implemented (Express)  
**Depends on:** [leaderboards-api-d1.md](leaderboards-api-d1.md) (D1), [gameplay-stats-phase2.md](gameplay-stats-phase2.md)

## Scope

| Surface | Limit key | Default (60s window) | Env |
|---------|-----------|----------------------|-----|
| **`GET /api/v1/leaderboards`** | Client IP | **90** requests / window | `LEADERBOARD_RATE_LIMIT_MAX`, `LEADERBOARD_RATE_LIMIT_WINDOW_MS` |
| **`POST /api/v1/me/gameplay-events`** | Authenticated **uid** | **30** requests / window | `GAMEPLAY_EVENT_RATE_LIMIT_MAX`, `GAMEPLAY_EVENT_RATE_LIMIT_WINDOW_MS` |

**Not rate-limited here:** `POST /api/internal/v1/leaderboard-snapshots/rebuild` (protected by cron secret only).

## Behavior

- **Implementation:** In-process **fixed window** counters (`server/in-memory-rate-limit.js`). Resets per window; returns **429** with JSON `error.code: rate_limited`, optional `retryAfterSec`, and HTTP **`Retry-After`** header when set.
- **Disable (stress tests / local):** `RATE_LIMITS_DISABLED=true` — allows all traffic through both hooks.
- **IP behind proxies:** Set **`TRUST_PROXY_FOR_RATE_LIMIT=true`** on Cloud Run (or one trusted hop) so **`X-Forwarded-For`** first address is used for leaderboard limits. If unset, the socket remote address is used (fine for direct `ng serve` → Express).

## Firestore rules

Firestore **security rules** do **not** support per-request rate limiting. Abuse of **reads** on paths clients can hit is mitigated by **small query surfaces** and **public snapshot docs** (B2); heavy **server** reads use the HTTP API with the limits above. Optional tightening (e.g. signed-in-only reads) is a product decision, not Story F1.

## Logs and errors

- Structured logs use **`outcome: rate_limited`** (leaderboard: `component: leaderboards`; gameplay: `component: gameplay_events`). **No** IP, uid, tokens, or secrets in those lines beyond what those components already log for normal requests.
- **429 body:** Generic message + `retryAfterSec` only — **no** stack traces or env values.

## Staging: prove 429

1. Run API with tight limits, e.g.  
   `LEADERBOARD_RATE_LIMIT_MAX=3 LEADERBOARD_RATE_LIMIT_WINDOW_MS=60000 TRUST_PROXY_FOR_RATE_LIMIT=true npm run backend`
2. From the same client, loop:  
   `for i in $(seq 1 5); do curl -sS -o /dev/null -w "%{http_code}\n" "http://localhost:3000/api/v1/leaderboards?scope=global"; done`  
   Expect **200** then **429**; fourth line onward should show **429** with `Retry-After` header:  
   `curl -sSI "http://localhost:3000/api/v1/leaderboards?scope=global" | grep -i retry`

## Multi-instance note

In-memory limits are **per Node process**. Behind multiple replicas, effective budget is roughly **per-replica × limit**. For strict global caps, use **Redis**, **Cloud Armor**, or **API Gateway** in a follow-up.

## References

- `server/rate-limit-hooks.middleware.js`, `server/client-ip.js`
- [leaderboards-phase3-jira.md](leaderboards-phase3-jira.md) — Story F1
