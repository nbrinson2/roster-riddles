# Weekly contests — dry-run override / cancel (Story F2)

**Status:** Implemented (same internal endpoint as Story D1)  
**Depends on:** [weekly-contests-ops-d1.md](weekly-contests-ops-d1.md), [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md)

## Purpose

After a contest reaches **`paid`**, dry-run rows are normally final. For **staging** or operator mistakes, you may:

1. **Void** the contest — `paid` → **`cancelled`** (clears `results/final` and `payouts/dryRun` in the same transaction).
2. **Re-open scoring** — `paid` → **`scoring`** (clears those artifacts; then run **`POST /api/internal/v1/contests/run-scoring`** with the same `contestId` to recompute).

Both require **`force: true`** and the same **`CONTESTS_OPERATOR_SECRET`** auth as D1.

## Endpoint

`POST /api/internal/v1/contests/:contestId/transition`

| Body field | Required | Notes |
|------------|----------|--------|
| `to` | Yes | `"cancelled"` or `"scoring"` |
| `force` | Yes | Must be **`true`** for any transition **from** `paid` |
| `adminUid` | No | If set, logs use `actorType: "admin"` |
| `reason` | No | Optional string (≤500 chars) appended to structured logs |

**Success (200)** includes **`dryRunArtifactsCleared: true`** when `results/final` and `payouts/dryRun` were deleted.

| `error.code` | When |
|--------------|------|
| `override_requires_force` | From `paid` without `force: true` |
| `invalid_status_transition` | e.g. `paid` → `open` |

## Examples (curl)

**Void dry-run after `paid`:**

```bash
curl -sS -X POST "http://localhost:3000/api/internal/v1/contests/$CONTEST_ID/transition" \
  -H "Authorization: Bearer $CONTESTS_OPERATOR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"to":"cancelled","force":true,"reason":"staging test — void duplicate run"}'
```

**Re-score:**

```bash
curl -sS -X POST "http://localhost:3000/api/internal/v1/contests/$CONTEST_ID/transition" \
  -H "Authorization: Bearer $CONTESTS_OPERATOR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"to":"scoring","force":true,"reason":"re-run after bad seed"}'

curl -sS -X POST "$API_BASE/api/internal/v1/contests/run-scoring" \
  -H "Authorization: Bearer $CONTESTS_INTERNAL_SECRET" \
  -H "Content-Type: application/json" \
  -d "{\"contestId\":\"$CONTEST_ID\"}"
```

(Use your deployment’s internal scoring auth — see [weekly-contests-ops-e2.md](weekly-contests-ops-e2.md).)

## Runbook (manual Firestore) — optional

If the API is unavailable, operators with **Firebase console / Admin SDK** can still align **`contests/{id}.status`** with product policy, but **client rules deny direct writes** in normal configs — prefer the endpoint above so artifacts and logs stay consistent.

## References

- [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — Story F2  
- [`server/contests/contest-transitions.js`](../server/contests/contest-transitions.js) — `paid` edges + `override_requires_force`  
- [`server/contests/contest-transition.http.js`](../server/contests/contest-transition.http.js) — transactional deletes  
