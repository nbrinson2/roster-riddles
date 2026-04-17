# Weekly contests — `contests/{contestId}/entries/{uid}` schema (Story B2)

**Status:** Implemented (rules + indexes + TS model)  
**Depends on:** [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md), [weekly-contests-schema-contests.md](weekly-contests-schema-contests.md)  
**Physical path:** Subcollection **`entries`** under each contest; document id **`{uid}`** = Firebase Auth uid (deterministic, idempotent join).

## Idempotent join

- **One row per `(contestId, uid)`:** document id is **`uid`**, so create-with-merge from a trusted API always targets the same path.
- **Retries:** Same logical join retried (e.g. same `clientRequestId`) must not create duplicates — only **`contests/{contestId}/entries/{uid}`** exists.
- **Late join:** If the contest is not **`open`** or **`now >= windowEnd`**, the **join API** rejects with a stable error (enforced in Express / Cloud Function in Story C1 — not in rules alone).

## Field reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | Yes | Entry document schema version. **`1`** for this shape. |
| `contestId` | `string` | Yes | Denormalized parent id (equals path `contestId`). |
| `uid` | `string` | Yes | Same as document id; Firebase Auth uid. |
| `rulesAcceptedVersion` | `number` \| `string` | Yes | Snapshot of **`contests/{contestId}.rulesVersion`** at join. |
| `joinedAt` | `Timestamp` | Yes | Server time when join committed. |
| `displayNameSnapshot` | `string` \| `null` | No | Optional display name from Auth at join. |
| `clientRequestId` | `string` | No | Optional idempotency key for logging / support. |

## Example document

```json
{
  "schemaVersion": 1,
  "contestId": "contest_2026_w16",
  "uid": "firebaseUidAbC12",
  "rulesAcceptedVersion": 1,
  "joinedAt": "2026-04-15T18:30:00.000Z",
  "displayNameSnapshot": "Alice",
  "clientRequestId": "550e8400-e29b-41d4-a716-446655440000"
}
```

## Security rules

- **Read:** Authenticated user may read **only** `contests/{contestId}/entries/{uid}` where **`uid == request.auth.uid`**. No public or cross-user reads of other entrants’ entry docs (product may relax in a later story).
- **Write:** **Denied** to clients — joins go through **Admin SDK** (trusted `POST` in Story C1).

## Queries & indexes

| Use case | Suggested query | Index |
|----------|-----------------|--------|
| **My entries (all contests)** | `collectionGroup('entries').where('uid','==', authUid).orderBy('joinedAt','desc')` | Composite **collection group** `entries`: `uid` ↑, `joinedAt` ↓ (see `firestore.indexes.json`). |
| **Entries in one contest** | `collection( db, 'contests', contestId, 'entries' )` with optional `orderBy('joinedAt')` | Typically automatic single-field on `joinedAt` for one subcollection; add composite if you combine filters. |

Deploy indexes after changing **`firestore.indexes.json`**.

## TypeScript

See **`src/app/shared/models/contest-entry.model.ts`**.

## References

- [weekly-contests-schema-results.md](weekly-contests-schema-results.md) — Story B3 (immutable `results/final`, `payouts/dryRun`)
- [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — Story B2  
