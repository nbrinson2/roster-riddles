# Weekly contests — `contests/{contestId}/entries/{uid}` schema (Story B2, Phase 5 P5-B1)

**Status:** Implemented (rules + indexes + TS model); **Phase 5 payment fields** documented — server writes only  
**Depends on:** [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md), [weekly-contests-schema-contests.md](weekly-contests-schema-contests.md), [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md)  
**Physical path:** Subcollection **`entries`** under each contest; document id **`{uid}`** = Firebase Auth uid (deterministic, idempotent join).

## Idempotent join

- **One row per `(contestId, uid)`:** document id is **`uid`**, so create-with-merge from a trusted API always targets the same path.
- **Retries:** Same logical join retried (e.g. same `clientRequestId`) must not create duplicates — only **`contests/{contestId}/entries/{uid}`** exists.
- **Late join:** If the contest is not **`open`** or **`now >= windowEnd`**, the **join API** rejects with a stable error (enforced in Express / Cloud Function in Story C1 — not in rules alone).

## Field reference

### Core (Phase 4)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | Yes | **`1`** — Phase 4 free join only. **`2`** — includes Phase 5 payment semantics (explicit `paymentStatus` and/or Stripe ids). |
| `contestId` | `string` | Yes | Denormalized parent id (equals path `contestId`). |
| `uid` | `string` | Yes | Same as document id; Firebase Auth uid. |
| `rulesAcceptedVersion` | `number` \| `string` | Yes | Snapshot of **`contests/{contestId}.rulesVersion`** at join (or at Checkout metadata for paid path). |
| `joinedAt` | `Timestamp` | Yes | Server time when join committed **or** when paid entry is finalized (per [Phase 5 ADR](weekly-contests-phase5-entry-fees-adr.md)). |
| `displayNameSnapshot` | `string` \| `null` | No | Optional display name from Auth at join. |
| `clientRequestId` | `string` | No | Optional idempotency key for logging / support. |

### Payment (Phase 5 — Story P5-B1)

**Writes:** Express / Admin SDK / webhooks only — **not** client-writable ([`firestore.rules`](../firestore.rules)).

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `paymentStatus` | `string` | For new writes: **recommended** | `free` \| `pending` \| `paid` \| `failed` \| `refunded` — see [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md#entry-paymentstatus). **Free** contests: use `free` for new docs with `schemaVersion: 2`, or omit on legacy **`schemaVersion: 1`** rows (still treated as free when contest has no fee). |
| `entryFeeCentsSnapshot` | `number` (int) | When `paid` | Non-negative integer cents; must match fee validated at Checkout / webhook. |
| `stripeCheckoutSessionId` | `string` | When paid via Checkout | Stripe id prefix `cs_`. |
| `stripePaymentIntentId` | `string` | When paid | Stripe id prefix `pi_`. |
| `stripeCustomerId` | `string` \| `null` | No | Stripe Customer `cus_...` if used. |
| `paidAt` | `Timestamp` | When `paid` | Server time when payment success was recorded. |
| `refundedAmountCents` | `number` (int) | When refunds apply (P5-E3) | Cumulative USD cents refunded via Stripe webhooks; capped at `entryFeeCentsSnapshot`. |
| `lastStripeEventId` | `string` \| `null` | No | Last processed Stripe event id (e.g. `evt_...`) for support / idempotency debugging. |

**Never store** full card numbers, CVC, or Stripe **secret** keys on this document.

## Example documents

**Free entry (Phase 4 — `schemaVersion: 1`, or `2` + `paymentStatus: free`):**

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

**Paid entry (Phase 5 — after successful webhook; illustrative ids):**

```json
{
  "schemaVersion": 2,
  "contestId": "contest_2026_w16",
  "uid": "firebaseUidAbC12",
  "rulesAcceptedVersion": 1,
  "joinedAt": "2026-04-15T18:35:02.000Z",
  "displayNameSnapshot": "Alice",
  "paymentStatus": "paid",
  "entryFeeCentsSnapshot": 999,
  "stripeCheckoutSessionId": "cs_test_a1b2c3",
  "stripePaymentIntentId": "pi_test_x9y8z7",
  "stripeCustomerId": "cus_test_123",
  "paidAt": "2026-04-15T18:35:02.000Z",
  "lastStripeEventId": "evt_test_456"
}
```

(JSON shows ISO strings; Firestore stores **`Timestamp`**.)

## Security rules

- **Read:** Authenticated user may read **only** `contests/{contestId}/entries/{uid}` where **`uid == request.auth.uid`**. No public or cross-user reads of other entrants’ entry docs (product may relax in a later story).
- **Write:** **Denied** to clients — including **Phase 5 payment fields** (`paymentStatus`, Stripe ids, `paidAt`, …). Joins and payment finalization use **`POST /api/v1/contests/:contestId/join`** (free) or server/webhook paths (paid). See [weekly-contests-api-c1.md](weekly-contests-api-c1.md).

## Queries & indexes

| Use case | Suggested query | Index |
|----------|-----------------|--------|
| **My entries (all contests)** | `collectionGroup('entries').where('uid','==', authUid).orderBy('joinedAt','desc')` | Composite **collection group** `entries`: `uid` ↑, `joinedAt` ↓ (see `firestore.indexes.json`). |
| **Entries in one contest** | `collection( db, 'contests', contestId, 'entries' )` with optional `orderBy('joinedAt')` | Typically automatic single-field on `joinedAt` for one subcollection; add composite if you combine filters. |

Deploy indexes after changing **`firestore.indexes.json`**.

## TypeScript

See **`src/app/shared/models/contest-entry.model.ts`** — `ContestEntryDocument`, `ContestEntryPaymentStatus`, `CONTEST_ENTRY_SCHEMA_VERSION`, `CONTEST_ENTRY_SCHEMA_VERSION_PHASE5`.

## References

- [weekly-contests-schema-results.md](weekly-contests-schema-results.md) — Story B3 (immutable `results/final`, `payouts/dryRun`)
- [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — Story B2  
- [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md) — Phase 5 paid entry (`paymentStatus`, Checkout + webhooks)  
- [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md) — append-only **`ledgerEntries`** audit trail (P5-B2)  
