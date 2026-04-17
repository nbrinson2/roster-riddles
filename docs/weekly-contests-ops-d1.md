# Weekly contests — status transitions (Story D1)

**Status:** Implemented (Express + Admin SDK)  
**Depends on:** [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md) (lifecycle)

## Allowed transitions (server-enforced)

| From ↓ / To → | `open` | `scoring` | `paid` | `cancelled` |
|----------------|--------|-----------|--------|---------------|
| `scheduled`    | ✓      | —         | —      | ✓             |
| `open`         | —      | ✓ *       | —      | ✓             |
| `scoring`      | —      | —         | ✓      | ✓             |
| `paid`         | —      | —         | —      | —             |
| `cancelled`    | —      | —         | —      | —             |

\* **`open` → `scoring`:** requires **`now >= windowEnd`** (half-open join window is over), **unless** the request sets **`force: true`** (trusted operators / staging only — still requires `CONTESTS_OPERATOR_SECRET`).

Terminal states **`paid`** and **`cancelled`** accept **no** outgoing transitions.

Implementation: [`server/contest-transitions.js`](../server/contest-transitions.js), handler [`server/contest-transition.http.js`](../server/contest-transition.http.js).

## Endpoint

`POST /api/internal/v1/contests/:contestId/transition`

**Auth:** shared secret (same pattern as leaderboard snapshot rebuild):

- `Authorization: Bearer <CONTESTS_OPERATOR_SECRET>`, or  
- Header `x-contests-operator-secret: <CONTESTS_OPERATOR_SECRET>`

If the secret is **not** set in the environment, the route returns **503** `server_misconfigured`.

**Body (JSON):**

```json
{
  "to": "open",
  "force": false,
  "adminUid": "optional-firebase-uid-for-audit-logs"
}
```

| Field | Required | Description |
|-------|----------|-------------|
| `to` | Yes | Target status: `open`, `scoring`, `paid`, or `cancelled`. |
| `force` | No | If `true`, skips the `windowEnd` check for `open` → `scoring`. |
| `adminUid` | No | If set, structured logs use `actorType: "admin"` and this uid; otherwise `actorType: "system"`. |

**Success — 200**

```json
{
  "contestId": "…",
  "from": "scheduled",
  "to": "open",
  "actorType": "system",
  "adminUid": null
}
```

If the document is **already** at `to`, **`idempotentReplay: true`** is returned (HTTP 200).

**Errors (examples)**

| HTTP | `error.code` | When |
|------|----------------|------|
| 400 | `invalid_status_transition` | Edge not in the matrix |
| 400 | `transition_window_not_closed` | `open` → `scoring` before `windowEnd` without `force` |
| 400 | `contest_terminal` | Current status is `paid` or `cancelled` |
| 401 | `unauthorized` | Wrong or missing secret |
| 404 | `contest_not_found` | No `contests/{contestId}` |
| 503 | `server_misconfigured` | Secret or Firestore not configured |

## Logging

JSON lines: `component: contest_transition`, `outcome`, `requestId`, `httpStatus`, `contestId`, `from`, `to`, `actorType`, optional `adminUid`, optional `force`.

## Environment

| Variable | Role |
|----------|------|
| `CONTESTS_OPERATOR_SECRET` | Required for this route to accept requests |

## Example (curl)

```bash
curl -sS -X POST "http://localhost:3000/api/internal/v1/contests/$CONTEST_ID/transition" \
  -H "Authorization: Bearer $CONTESTS_OPERATOR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"to":"open"}'
```

## References

- [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — Story D1  
- [weekly-contests-schema-contests.md](weekly-contests-schema-contests.md) — contest document fields  
- [weekly-contests-ops-e1.md](weekly-contests-ops-e1.md) — Story E1 (automated `open`→`scoring` when `windowEnd` passes)  
