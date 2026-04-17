# Leaderboards — composite indexes & pagination (Story B3)

**Status:** Implemented (spec + `firestore.indexes.json` + TS limits)  
**Depends on:** [leaderboards-phase3-adr.md](leaderboards-phase3-adr.md) (Story A0), [leaderboards-schema-query-path.md](leaderboards-schema-query-path.md) (Story B1), [leaderboards-schema-precomputed.md](leaderboards-schema-precomputed.md) (Story B2, optional hybrid)

## Scope (v1)

| Topic | v1 |
|-------|-----|
| **Weekly / `weekId` + score** | **Not indexed** — weekly boards are out of scope for Leaderboards v1 (ADR). No composite indexes for weekly dimensions until a future story adds fields and queries. |
| **All-time global + per-mode** | **Four collection-group indexes** on `stats` (see below). |
| **Precomputed path (B2)** | **No composite indexes** — reads are `get(leaderboards/snapshots/boards/{boardId})` by path. |

## Collection group vs path

| Read strategy | Mechanism | Indexes |
|---------------|-----------|---------|
| **Query path (B1)** | `collectionGroup('stats')` with `orderBy` on a wins field (no `documentId == 'summary'` filter in Admin SDK — see [Canonical query](#canonical-server-query-per-board)) | Required — see [Deployed indexes](#deployed-indexes). |
| **Batch path (B2)** | Single document read per board | None |

All collection-group leaderboard queries run in **trusted code** (Admin SDK). Clients **cannot** run cross-user `stats` queries under current rules.

## Deployed indexes

Definitions live in **`firestore.indexes.json`** (source of truth). Each index is **`COLLECTION_GROUP`** on collection id **`stats`**, with **exactly two fields**: the **score field** (descending) and **`__name__`** (ascending). Firestore requires **`__name__` last** in the index definition.

| # | Sort field (`orderBy` first) | Use case (board) |
|---|------------------------------|------------------|
| 1 | `totals.wins` | Global all-time |
| 2 | `totalsByMode.\`bio-ball\`.wins` | Mode `bio-ball` |
| 3 | `totalsByMode.\`career-path\`.wins` | Mode `career-path` |
| 4 | `totalsByMode.\`nickname-streak\`.wins` | Mode `nickname-streak` |

Hyphenated map keys in field paths use **backticks** in `firestore.indexes.json`, matching Firestore’s path syntax.

## Canonical server query (per board)

For each board, the Admin SDK query must **match the index**: primary `orderBy` on the **wins** field for that board **descending**, secondary **`orderBy` on `FieldPath.documentId()` ascending** (same as **`__name__`** in the index). Example (Node `firebase-admin`):

```js
const { FieldPath } = require('firebase-admin/firestore');

// Global board — use the row matching firestore.indexes.json index #1
db.collectionGroup('stats')
  .orderBy('totals.wins', 'desc')
  .orderBy(FieldPath.documentId(), 'asc')
  .limit(pageSize);
```

Per-mode boards replace the first `orderBy` field with the corresponding `totalsByMode.<mode>.wins` path (same strings as in the index).

**Do not** add `where(FieldPath.documentId(), '==', 'summary')` on a **collection group** query: Firestore requires the `documentId` equality value to be a **full document path** (an even number of path segments), not the bare last segment `'summary'`. In v1 the only document under each user’s `stats` subcollection is **`summary`** (see Phase 2 pipeline), so ordering over `collectionGroup('stats')` is sufficient. If other `stats/*` docs are added later, introduce a dedicated field (e.g. `leaderboardSource: 'summary'`) and `where` on that field plus a matching composite index.

## Stable ordering & ties

- **Primary:** `wins` descending (the score field for that board).
- **Secondary:** document id ascending — for these paths, full document names are unique and order is **deterministic** across pages.
- **ADR tie-break (`uid` ascending):** When assigning **`rank`** in application code, break ties on equal `wins` using **`uid`** (extracted from the document path `users/{uid}/stats/summary`). Ordering by Firestore **`__name__`** on a fixed path pattern is **stable** but may not match **lexicographic `uid` order** in every edge case; the **API layer** should re-sort tied scores by `uid` ascending if exact ADR semantics are required for a single response page. For **pagination**, always use Firestore’s `orderBy` chain as defined above and **`startAfter`** the **last snapshot** from the previous page so cursors stay consistent with the index.

## Pagination contract (trusted API)

| Rule | Value |
|------|--------|
| **Max `limit`** | **`LEADERBOARD_MAX_PAGE_SIZE`** (50) — enforced **server-side**; see `src/app/shared/models/leaderboard-query.model.ts`. |
| **Default page size** | **`LEADERBOARD_DEFAULT_PAGE_SIZE`** (25) — recommended for UI. |
| **Cursor** | Opaque **`pageToken`** (implementation choice): e.g. **base64url** encoding of the **last row’s** `(score, uid)` **or** pass-through of Firestore’s **last `DocumentSnapshot` reference** only in server-side pagination (not serializable to clients). For **HTTP JSON APIs**, prefer encoding **`(winsValue, documentPathOrUid)`** enough to reconstruct **`startAfter`** on the same query. |
| **Next page** | Same query + **`startAfter(cursorDoc)`** where `cursorDoc` is the **last document** from the previous query result (Admin SDK), or deserialize token to a **`DocumentReference`** / snapshot boundary consistent with the index ordering. |
| **No `offset`** | Do **not** use `offset` for leaderboards — cost grows with page depth; cursors only. |

### Firestore-native pattern (in-process)

```js
let q = db.collectionGroup('stats')
  .orderBy('totals.wins', 'desc')
  .orderBy(FieldPath.documentId(), 'asc')
  .limit(pageSize);

if (cursorSnap) {
  q = q.startAfter(cursorSnap); // last doc from previous page
}
const snap = await q.get();
```

### Client-facing HTTP shape (suggested)

- **Request:** `GET /leaderboards/:scope?pageSize=&pageToken=`
- **Response:** `{ entries: LeaderboardEntryRow[], nextPageToken?: string }`
- **`pageToken`:** absent when no more rows; server validates token against the same `scope` and query hash to prevent injection.

## Deploying indexes (staging / production)

Use the same flow as [firestore-rules-deploy.md](firestore-rules-deploy.md) § **Composite indexes**: deploy **`firestore:roster-riddles`** (or your configured database id) so **rules + indexes** stay aligned. Wait until indexes show **Enabled** in the console before load-testing queries.

## References

- `firestore.indexes.json`
- `src/app/shared/models/leaderboard-query.model.ts` — `LEADERBOARD_*_PAGE_SIZE`
- [leaderboards-schema-query-path.md](leaderboards-schema-query-path.md) — physical schema for B1
