# Weekly contests — `contests/{contestId}/payouts/final` & optional run attempts (Phase 6 Story P6-C2)

**Status:** Schema + TS types (execution job P6-D* may write these paths).  
**Physical paths (v1):**

| Path | Role |
|------|------|
| **`contests/{contestId}/payouts/final`** | **Option A** — single immutable **execution** snapshot: intended winner lines + Stripe transfer ids + per-line status after a payout job completes (or reaches a terminal partial state per ADR). |
| **`contests/{contestId}/payouts/run_{opaqueId}`** | **Option B (light)** — optional **per-attempt** documents as **sibling docs** under the same `payouts` collection (same Firestore rules as `dryRun` / `final`). Use when retries need an audit trail without nested subcollections. |

**Depends on:** [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md), [weekly-contests-schema-results.md](weekly-contests-schema-results.md) (`results/final`, `payouts/dryRun`), [weekly-contests-schema-users-payouts.md](weekly-contests-schema-users-payouts.md)  
**TypeScript:** [`contest-payout-final.model.ts`](../../src/app/shared/models/contest-payout-final.model.ts)  
**Payout line computation (Story P6-D1):** [`server/contests/contest-payout-compute.js`](../../server/contests/contest-payout-compute.js) — `buildPayoutLinesFromFinal(resultsFinal, dryRun?, contest?)` produces the same `{ rank, uid, amountCents }[]` as scoring dry-run when inputs align.  
**Execution (Story P6-D2):** [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md) — internal HTTP route writes this document after Stripe Transfers.

## Immutability & idempotency (executor contract)

- **Clients:** **No** creates/updates/deletes on `payouts/*` — **Admin SDK / trusted workers only** ([`firestore.rules`](../../firestore.rules) — same block as Story B3 `payouts/dryRun`).
- **Doc idempotency (recommended):**
  1. **`payouts/final`:** Before create, read existing doc. If **`payoutJobId`** matches the incoming job’s id → **no-op** (Stripe-safe redelivery / duplicate scheduler tick).
  2. If a **different** job id would overwrite a **committed** final artifact → **do not** silently replace; either reject, or write a new **`payouts/run_{runId}`** attempt first and only promote to `final` via an explicit operator-approved path (document the choice in the payout executor story).
  3. **Retries / partial failures:** Write or update **`payouts/run_{opaqueId}`** (worker-only) until all lines succeed, then create **`payouts/final`** once. Optional: set **`supersedesRunDocumentId`** on `final` to point at the last successful run doc id.
- **`supersedesRunId` (logical):** Stored as **`supersedesRunDocumentId`** (string, Firestore doc id under `payouts/`, e.g. `run_01J9…`) when `final` supersedes a prior attempt document.

## `payouts/final` field reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | Yes | **`1`** for this shape. |
| `contestId` | `string` | Yes | Denormalized parent id (equals path `contestId`). |
| `currency` | `string` | Yes | ISO-like code for prize pool, e.g. **`USD`**. |
| `notRealMoney` | `boolean` | No | **`true`** only in staging / dry environments; omit or **`false`** for real payouts. |
| `lines` | `array` | Yes | [Execution line](#execution-line-payoutsfinal) — ordered winner rows with transfer outcome. |
| `scoringJobId` | `string` | Yes | Copied from **`results/final.scoringJobId`** (or equivalent) for traceability. |
| `payoutJobId` | `string` | Yes | Opaque idempotency key for **this** payout execution (must be stable across retries of the same logical run). |
| `lockedAt` | `Timestamp` | Yes | Server time when this snapshot was committed. |
| `supersedesRunDocumentId` | `string` \| `null` | No | When promotion from a **`payouts/run_*`** doc occurred, store that document id. |
| `aggregateStatus` | `string` | No | Roll-up: e.g. **`succeeded`** \| **`partial_failure`** \| **`failed`** — optional UX / support. |

### Execution line (`payouts/final`)

Each element of **`lines`**:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rank` | `number` | Yes | 1-based rank (align with dry-run / standings). |
| `uid` | `string` | Yes | Winner’s Firebase uid. |
| `amountCents` | `number` (int) | Yes | Non-negative integer cents for this line. |
| `status` | `string` | Yes | Per-line lifecycle: e.g. **`pending`**, **`processing`**, **`succeeded`**, **`failed`**, **`skipped`**. |
| `stripeTransferId` | `string` \| `null` | No | Stripe Transfer id **`tr_…`** when created. |
| `failureCode` | `string` \| `null` | No | Stripe or app error code when **`status === failed`** (executor may set Stripe codes; P6-E2 webhooks prefer enums). |
| `failurePublicCode` | `string` \| `null` | No | P6-E2 — **safe enum** for UI (`prize_payout_transfer_*`, …) from webhook mappers; avoids raw Stripe strings on clients. |
| `lastStripeEventId` | `string` \| `null` | No | Last Stripe **`evt_…`** applied to this line (debug / idempotency). |

**Never store** full bank details, full tax ids, or unrelated PII — Stripe holds sensitive data.

## Optional `payouts/run_{opaqueId}` (attempt / retry)

Same **`lines`** shape as `final` (or a subset while in-flight). Typical fields:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | Yes | **`1`**. |
| `contestId` | `string` | Yes | Denormalized. |
| `runId` | `string` | Yes | Same as document id suffix or opaque uuid (must match **`payouts/{docId}`**). |
| `payoutJobId` | `string` | Yes | Idempotency for this attempt. |
| `supersedesRunDocumentId` | `string` \| `null` | No | Previous attempt doc id, if any. |
| `lines` | `array` | Yes | Same columns as [Execution line](#execution-line-payoutsfinal). |
| `attemptStatus` | `string` | Yes | e.g. **`in_progress`**, **`superseded`**, **`promoted_to_final`**, **`abandoned`**, **`failed`**. |
| `createdAt` | `Timestamp` | Yes | When the attempt doc was created. |

## Access control (rules)

- **Writes:** denied to clients for all `contests/{contestId}/payouts/{payoutDocId}` (including **`final`** and **`run_*`**).
- **Reads (v1):** any **signed-in** user may read `payouts/*` (same as `dryRun` / Story B3). A future hardening story may restrict **`payouts/final`** (e.g. entrants + admins only) if prize amounts must not be widely visible.

## Example `payouts/final` payload (QA)

```json
{
  "schemaVersion": 1,
  "contestId": "c1",
  "currency": "USD",
  "notRealMoney": true,
  "scoringJobId": "job_01J8XK2N4S8Q9V0ABCDEF",
  "payoutJobId": "payout_01J9ABCDEF_RUN1",
  "lockedAt": "2026-04-27T15:00:00.000Z",
  "aggregateStatus": "succeeded",
  "supersedesRunDocumentId": null,
  "lines": [
    {
      "rank": 1,
      "uid": "uidAlice",
      "amountCents": 10000,
      "status": "succeeded",
      "stripeTransferId": "tr_test_1",
      "failureCode": null,
      "lastStripeEventId": "evt_transfer_1"
    },
    {
      "rank": 2,
      "uid": "uidBob",
      "amountCents": 5000,
      "status": "skipped",
      "stripeTransferId": null,
      "failureCode": null,
      "lastStripeEventId": null
    }
  ]
}
```

## References

- [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md) — **`ledgerEntries`** prize `lineType` + `direction` (P6-C3) and entry-fee lines.  
- [weekly-contests-phase6-payouts-jira.md](weekly-contests-phase6-payouts-jira.md) — Story P6-C2 backlog.
