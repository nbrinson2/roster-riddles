# Weekly contests — payment ledger (Phase 5 Story P5-B2)

**Status:** Schema defined (writes via Admin SDK / server only)  
**Depends on:** [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md)  
**Physical path:** Top-level collection **`ledgerEntries`**, document id **`{ledgerEntryId}`** (see [Document ids](#document-ids-and-idempotency)).

## Purpose

**Append-only audit trail** for contest entry fees and related money movement: credits (charges), debits (refunds), and future line types. Used for **disputes**, **reconciliation** with Stripe, and **support**. **No deletes** — corrections are **new lines** (e.g. reversing entries), not edits to existing docs.

**Clients:** **No** Firestore read or write ([`firestore.rules`](../firestore.rules)); access only via **Admin SDK** / trusted backends / operator tools.

---

## Field reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | Yes | Document schema version. **`1`** for this shape. |
| `uid` | `string` | Yes | Firebase Auth uid affected by this line (payer / recipient context). |
| `contestId` | `string` | Yes | Contest id; ties line to `contests/{contestId}`. |
| `entryPathHint` | `string` | No | Denormalized hint, e.g. `contests/{contestId}/entries/{uid}` for support (not a Firestore reference type). |
| `lineType` | `string` | Yes | `contest_entry_charge` \| `contest_entry_refund` \| `contest_entry_adjustment` \| `other` — extend in code with validation. |
| `direction` | `string` | Yes | `credit` (money in to platform / fee captured) or `debit` (refund out / reversal) — **accounting sense** for your ledger convention; document consistently in webhook handlers. |
| `amountCents` | `number` (int) | Yes | Non-negative magnitude in **USD cents** (v1 single currency). |
| `currency` | `string` | Yes | ISO-like code; v1 use **`usd`**. |
| `stripeEventId` | `string` \| `null` | No | Stripe **`evt_...`** when this line is derived from a webhook; **`null`** for manual/admin lines. |
| `stripeObjectType` | `string` \| `null` | No | e.g. `charge`, `payment_intent`, `checkout.session`. |
| `stripeObjectId` | `string` \| `null` | No | Stripe object id (`ch_...`, `pi_...`, `cs_...`). |
| `source` | `string` | Yes | `webhook` \| `admin_adjustment` \| `system` — who caused the line. |
| `createdAt` | `Timestamp` | Yes | Server time when the line was written. |
| `metadata` | `map` | No | Small debug map; **no PII**, no secrets. |

**Never store** card numbers, CVC, or API secret keys.

---

## Document ids and idempotency

| Source | Recommended document id | Rule |
|--------|-------------------------|------|
| **Stripe webhook** | Use Stripe **`event.id`** (`evt_...`) as **`ledgerEntryId`** | At most **one ledger document per Stripe event**; duplicate delivery retries **fail create** with “already exists” → treat as success (idempotent). |
| **Admin / manual** | Auto-generated id (Firestore `add()` / random UUID) | No `stripeEventId` collision; include `source: admin_adjustment`. |

If a single Stripe event must produce **multiple** ledger lines (rare), either use **subcollection** under a parent `evt_...` doc (future) or **one doc per event** with an array of line items — **v1:** **one doc per `evt_...`** for webhook-driven lines unless product amends this ADR.

---

## Queries and indexes

| Use case | Query | Index (see `firestore.indexes.json`) |
|----------|-------|--------------------------------------|
| Lines for a user (newest first) | `ledgerEntries.where('uid','==', uid).orderBy('createdAt','desc')` | `uid` ↑, `createdAt` ↓ |
| Lines for a contest (newest first) | `ledgerEntries.where('contestId','==', id).orderBy('createdAt','desc')` | `contestId` ↑, `createdAt` ↓ |
| Lookup by Stripe event | `ledgerEntries.doc(stripeEventId)` | Single-field `stripeEventId` optional if querying by field; **prefer id = `evt_...`**. |

---

## Security rules

- **Read / write:** Denied to **all** client SDK requests (`allow read, write: if false`).
- **Trusted writers:** Express webhooks, Cloud Functions, or Admin scripts using **Admin SDK** (bypasses rules).

---

## TypeScript

See **`src/app/shared/models/contest-ledger-entry.model.ts`**.

## References

- [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) — Story P5-B2  
- [weekly-contests-schema-entries.md](weekly-contests-schema-entries.md) — entry payment fields  
