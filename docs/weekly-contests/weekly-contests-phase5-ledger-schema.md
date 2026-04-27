# Weekly contests — payment ledger (Phase 5 Story P5-B2)

**Status:** Schema defined (writes via Admin SDK / server only); **Phase 6 P6-C3** prize `lineType` values + server validation.  
**Depends on:** [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md), [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md) (prize direction glossary)  
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
| `lineType` | `string` | Yes | See [Line types](#line-types-including-phase-6-prize-payouts-p6-c3). |
| `direction` | `string` | Yes | `credit` \| `debit` — **platform-centric** convention; must pair with `lineType` as in [Direction by `lineType`](#direction-by-linetype-p6-c3). |
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

## Line types (including Phase 6 prize payouts, P6-C3)

| `lineType` | When used |
|------------|-----------|
| **`contest_entry_charge`** | Entry fee captured (Phase 5 success webhook). |
| **`contest_entry_refund`** | Entry fee refunded (Phase 5 refund webhook). |
| **`contest_entry_adjustment`** | Manual / support correction (rare). |
| **`other`** | Escape hatch — use sparingly with `metadata` rationale. |
| **`prize_transfer_out`** | Outbound **Stripe Transfer** to a winner’s connected account (prize execution). |
| **`prize_transfer_reversal`** | Reversal / return of prize funds to the platform balance (e.g. `transfer.reversed`). |
| **`platform_fee_retained`** | Optional line when recording **platform-retained** fee or subsidy (net-of-fee flows), if product enables it. |

**Future (not in server validation yet):** **`dispute_adjustment`** — reserved for card **dispute** / chargeback outcomes tied to **`dp_…`**; convention and ops guidance in [weekly-contests-phase6-disputes-runbook.md](weekly-contests-phase6-disputes-runbook.md). Until implemented, use **`contest_entry_adjustment`** or **`other`** with documented `metadata`.

**Server validation:** `server/payments/contest-ledger-entry-validate.js` — **`assertValidContestLedgerEntryPayload`** rejects unknown `lineType` and invalid `(lineType, direction)` pairs before webhook / job writes.

### Direction by `lineType` (P6-C3)

| `lineType` | Allowed `direction` | Meaning (platform ledger) |
|------------|---------------------|----------------------------|
| `contest_entry_charge` | **`credit`** | Entry fee arrives on the platform. |
| `contest_entry_refund` | **`debit`** | Refund reduces platform-collected fee balance. |
| `contest_entry_adjustment` | **`credit`** or **`debit`** | Manual correction either way. |
| `other` | **`credit`** or **`debit`** | Document intent in `metadata`. |
| **`prize_transfer_out`** | **`debit`** | Funds **leave** the platform to the winner (`tr_…`). |
| **`prize_transfer_reversal`** | **`credit`** | Funds **return** to the platform when a prize transfer is reversed. |
| **`platform_fee_retained`** | **`credit`** | Platform **keeps** / recognizes retained fee (positive to platform in this convention). |

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
| Lines for a contest **and** user (newest first) | `ledgerEntries.where('contestId','==', id).where('uid','==', uid).orderBy('createdAt','desc')` | `contestId` ↑, `uid` ↑, `createdAt` ↓ (P6-H1; see `firestore.indexes.json`) |
| Lookup by Stripe event | `ledgerEntries.doc(stripeEventId)` | Single-field `stripeEventId` optional if querying by field; **prefer id = `evt_...`**. |
| Prize / transfer reconciliation (Phase 6) | `ledgerEntries.where('stripeObjectId','==', 'tr_...').orderBy('createdAt','desc')` | `stripeObjectId` ↑, `createdAt` ↓ (see `firestore.indexes.json`) |

---

## Security rules

- **Read / write:** Denied to **all** client SDK requests (`allow read, write: if false`).
- **Trusted writers:** Express webhooks, Cloud Functions, or Admin scripts using **Admin SDK** (bypasses rules).

---

## TypeScript

See **`src/app/shared/models/contest-ledger-entry.model.ts`** (`ContestLedgerLineType` includes P6-C3 values).

## References

- [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) — Story P5-B2  
- [weekly-contests-schema-entries.md](weekly-contests-schema-entries.md) — entry payment fields  
