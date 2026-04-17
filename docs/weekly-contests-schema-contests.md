# Weekly contests — `contests/{contestId}` schema (Story B1)

**Status:** Implemented (rules + indexes + TS model)  
**Depends on:** [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md) (Story A0)  
**Path:** Firestore collection **`contests`**, document id **`contestId`** (opaque string).

## Rules of use

- **Writes:** **Clients never** create or update contest documents. Only **Admin SDK** (Express, Cloud Functions, jobs) after validation.
- **Reads:** **Signed-in** users may read contest metadata for list/detail UIs (`firestore.rules`). Subcollections (`entries`, `results`, …) remain **denied** to clients until later stories (B2+).
- **Phase 4 v1:** **`gameMode`** is always **`bio-ball`**; other modes are reserved.

## Field reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | Yes | Contest document schema version. **`1`** for this shape. |
| `status` | `string` | Yes | `scheduled` \| `open` \| `scoring` \| `paid` \| `cancelled`. |
| `gameMode` | `string` | Yes | Phase 4 v1: **`bio-ball`**. |
| `rulesVersion` | `number` \| `string` | Yes | Version copied to entries at join (monotonic or semver-like string). |
| `windowStart` | `Timestamp` | Yes | Inclusive start of the contest window. |
| `windowEnd` | `Timestamp` | Yes | Exclusive end; events use **[windowStart, windowEnd)**. |
| `leagueGamesN` | `number` (int) | Yes | Mini-league slate size. **Product default: `10`**. |
| `title` | `string` | No | Display title. |
| `createdAt` | `Timestamp` | Yes | Server time at create. |
| `updatedAt` | `Timestamp` | Yes | Server time at last update. |
| `metadata` | `map` | No | Admin-only notes; **no PII**. |

## Example document

```json
{
  "schemaVersion": 1,
  "status": "open",
  "gameMode": "bio-ball",
  "rulesVersion": 1,
  "windowStart": "2026-04-14T04:00:00.000Z",
  "windowEnd": "2026-04-21T04:00:00.000Z",
  "leagueGamesN": 10,
  "title": "Bio Ball mini-league — Week of Apr 14",
  "createdAt": "2026-04-10T12:00:00.000Z",
  "updatedAt": "2026-04-10T12:00:00.000Z",
  "metadata": {
    "environment": "staging"
  }
}
```

(JSON shows ISO strings; Firestore stores **`Timestamp`**.)

## Queries & indexes

Composite indexes in **`firestore.indexes.json`** support:

| Use case | Query shape (illustrative) |
|----------|----------------------------|
| Open contests by window start | `where('status','==','open')` + `orderBy('windowStart','desc')` |
| Scheduled / open by end time | `where('status','in',[...])` + `orderBy('windowEnd','asc')` — *may require index tuning if `in` + `orderBy` differ; add indexes when the exact client query is fixed* |

**Deployed indexes (B1):**

1. **`status`** ↑, **`windowStart`** ↓ — list by status and sort by start (e.g. “newest open contest first”).
2. **`status`** ↑, **`windowEnd`** ↑ — sort by contest end (e.g. “ending soon” for open).

**Single-field** filters on `gameMode` use automatic indexes; combine with `orderBy`/`where` in implementation stories and add composite indexes if the console suggests.

## TypeScript

See **`src/app/shared/models/contest.model.ts`** — `ContestDocument`, `ContestStatus`, `CONTEST_SCHEMA_VERSION`.

## References

- [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md) — lifecycle and scoring semantics  
- [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — Story B1  
