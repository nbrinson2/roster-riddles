# ADR: Phase 5 — Entry fees (Stripe, data model + join lifecycle)

| Field | Value |
|-------|--------|
| **Status** | Accepted (engineering draft — legal/commerce review required before **live** Stripe keys) |
| **Date** | 2026-04-21 |
| **Scope** | **Paid entry** for existing weekly contests (`contests/{contestId}` / `entries/{uid}`) using **Stripe**; **single currency USD**; **no** winner payouts, **no** Stripe Connect — those are [Phase 6](../product/product-roadmap-contests-and-payments.md) ([payouts ADR](weekly-contests-phase6-payouts-adr.md)). |
| **Depends on** | [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md), [weekly-contests-schema-entries.md](weekly-contests-schema-entries.md), [stripe.md](../payments/stripe.md) |
| **Implements (backlog)** | [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) Story P5-A1 |

---

## Context

Phase 4 established **dry-run** payouts and a **free** join path: `POST /api/v1/contests/:contestId/join` creates **`contests/{contestId}/entries/{uid}`** with a **rules snapshot**, **no** card data and **no** Stripe.

Phase 5 adds **real entry fees** (test mode in staging, live only after **Phase 0** compliance). This ADR locks **amounts**, **join vs payment order**, **Stripe Checkout** as the v1 collection surface, **metadata**, **entry `paymentStatus`**, and **non-goals** so implementation stories (P5-B onward) do not fork accidentally.

---

## Decision summary

| Topic | Decision |
|--------|-----------|
| **Currency (v1)** | **USD only**; all amounts are **integer cents** (same convention as `prizePoolCents` / `entryFeeCents` on contest docs). |
| **Fee source of truth** | **`contests/{contestId}.entryFeeCents`** (optional). **`0` or omitted** means **free** — Phase 4 join API behavior, **no** Stripe. |
| **Snapshot on entry** | Store **`entryFeeCentsSnapshot`** on the entry at the time the payment is **committed** (successful webhook), equal to the contest value used for line-item validation (must match contest fee at session creation; if contest fee changes mid-flight, **reject** or **cancel session** — see [Race conditions](#race-conditions)). |
| **Stripe surface (v1)** | **Stripe Checkout** (`mode: payment`) — redirect flow. **Payment Element** embedded UI is **deferred** unless product requests it in a later story. |
| **Join vs pay order (v1)** | **Checkout-first, entry on success:** the user **accepts rules** in the client, then the **server** creates a **Checkout Session** with metadata (`contestId`, `uid`, `rulesAcceptedVersion`). The **entry document is created (or finalized) only when payment succeeds**, via **verified Stripe webhook** (`checkout.session.completed` / payment success path — exact event mapping in implementation). **Do not** treat return URL alone as proof of payment. |
| **Free contests** | If **`entryFeeCents`** is **`0` or absent**, **no** Checkout Session; use existing **`POST .../join`** only. **No** `paymentStatus` required, or set to `free` (implementation choice — see [Entry `paymentStatus`](#entry-paymentstatus)). |
| **Authoritative payment state** | **Stripe webhooks** processed server-side with **signature verification** and **idempotent** handling (`event.id` deduplication). Client redirect is **UX only**. |
| **PAN / card storage** | **Forbidden** on our systems. Store only Stripe object ids (**PaymentIntent**, **Checkout Session**, **Customer** id if used). |
| **Ledger** | Append-only **`ledgerEntries`** collection — [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md) (Story P5-B2); webhook writes entry + ledger in a **consistent** order (implementation P5-E). |

---

## Non-goals (Phase 5)

| Topic | Stance |
|--------|--------|
| **Stripe Connect**, **transfers** to winners, **KYC** for recipients | **Out of scope** — [Phase 6](../product/product-roadmap-contests-and-payments.md) ([payouts ADR](weekly-contests-phase6-payouts-adr.md)). |
| **Tax**, **1099**, **withholding** | **Out of scope** — requires product + finance; not blocking test-mode entry fees. |
| **Refunds** | **Hooks only** in Phase 5 (webhook handlers for `charge.refunded` / similar); **policy** (when operator may refund) remains **Phase 0** / legal. |
| **Non-USD currency** | **Deferred** — v1 USD cents only. |
| **Apple Pay / Link** | **Nice-to-have** via Checkout; no separate ADR required if enabled in Dashboard. |

---

## Entry `paymentStatus`

Stored on **`contests/{contestId}/entries/{uid}`** for **paid** contests once implementation lands (schema update in P5-B1).

| Value | Meaning |
|-------|---------|
| **`free`** | Contest had no entry fee; **only** for entries created via the **free** join path. |
| **`pending`** | *Optional in v1* — reserved if product adds “entry row before webhook” in a follow-up; may be **unused** if we strictly **create entry only on successful payment**. |
| **`paid`** | Entry fee **succeeded**; Stripe ids recorded; user is a **confirmed entrant** for scoring eligibility. |
| **`failed`** | Payment **failed** or **canceled** without success; user is **not** entered unless they complete a new Checkout attempt. |
| **`refunded`** | Entry fee **refunded** (full or partial — detail in ledger); entrant may be **voided** for scoring per product policy (implementation + rules doc). |

**Rules:**

- **Free path:** `paymentStatus: 'free'` **or** omit payment fields per backward compatibility — implementation must pick one and document in [weekly-contests-schema-entries.md](weekly-contests-schema-entries.md).
- **Eligibility for scoring:** Only **`paid`** (or **`free`**) entries count as entrants; **`failed`** / **`refunded`** entries do **not** earn leaderboard-style contest participation unless product explicitly allows edge cases (default: **do not**).

---

## Join lifecycle (paid contest)

```
┌─────────────────────────────────────────────────────────────────┐
│  Client: user reads rules, accepts checkbox (rulesVersion V)     │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  POST /api/v1/contests/:id/checkout-session (auth required)     │
│  Server validates: open window, entryFeeCents > 0, not already │
│  entered (paid/free). Creates Stripe Checkout Session with      │
│  metadata: contestId, uid, rulesAcceptedVersion, …              │
│  Returns: checkout URL                                          │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  User pays on Stripe-hosted Checkout (redirect)                 │
└────────────────────────────┬────────────────────────────────────┘
                             ▼
┌─────────────────────────────────────────────────────────────────┐
│  Stripe → POST /webhooks/stripe (verified signature)            │
│  On success: create entries/{uid} OR update from pending        │
│  paymentStatus = paid, entryFeeCentsSnapshot, stripe* ids,       │
│  joinedAt (server), rulesAcceptedVersion from metadata          │
│  Append ledger line (P5-B2)                                     │
└─────────────────────────────────────────────────────────────────┘
```

**Relationship to `POST .../join`:** For **`entryFeeCents > 0`**, the **join** endpoint returns a **clear error** (e.g. `payment_required`) **or** is not used until payment completes — exact HTTP contract in [weekly-contests-api-c1.md](weekly-contests-api-c1.md) update (Story P5-F1). **Recommended:** paid contests **do not** use the legacy join body until fee is satisfied; **single** code path after webhook creates the entry document.

---

## Join lifecycle (free contest)

Unchanged from Phase 4: **`POST .../join`** creates **`entries/{uid}`** immediately with **`paymentStatus: free`** (or no payment fields), **`rulesAcceptedVersion`**, **`joinedAt`**.

---

## Stripe metadata (minimum)

On **Checkout Session** (and propagated to **PaymentIntent** where applicable):

| Key | Purpose |
|-----|---------|
| **`contestId`** | Firestore contest id |
| **`uid`** | Firebase Auth uid of payer (must match session creator) |
| **`rulesAcceptedVersion`** | Same type as contest doc; copied to entry on success |
| **`rulesAcceptanceSource`** | Optional: `checkbox_v1` for audit |

**Never** put secrets or full card numbers in metadata.

---

## Race conditions

| Scenario | Mitigation |
|----------|------------|
| **Double tab / two Checkout Sessions** | At most **one** successful entry per `(contestId, uid)`; second webhook **idempotently** no-ops or errors safely. |
| **Contest fee or rules change during checkout** | Server validates **amount** and **metadata** on webhook against current contest doc; **mismatch** → do not mark `paid`; surface support alert; refund policy per Phase 0. |
| **User returns from Checkout success URL before webhook** | UI **polls** or listens until **`entries/{uid}`** exists with `paymentStatus: paid` or timeout message (“Confirming payment…”). |
| **Abandoned Checkout** | No entry document (or optional `pending` story later); user may start again. |

---

## Phase 0 — Legal and policy gates (before live money)

The following are **not** satisfied by this ADR alone:

- **Regional** gambling / sweepstakes analysis, **age**, **jurisdiction** gating.
- Published **Terms of Service**, **Privacy Policy**, **Contest Rules**, **Refund Policy** appropriate for **paid** entry.
- **Success metrics** (e.g. payout SLA) — see [product-roadmap-contests-and-payments.md](../product/product-roadmap-contests-and-payments.md) Phase 0.

**Engineering rule:** **Production** builds may use **Stripe live** keys only after **product + legal** sign-off recorded below and operator process in [stripe.md](../payments/stripe.md).

Related posture: [leaderboards-prize-verification-f3.md](../leaderboards/leaderboards-prize-verification-f3.md) (eligibility / verification — contests may adopt analogous patterns for prizes in Phase 6).

---

## Relationship to Phase 4 ADR

- **Contest status machine** (`scheduled` → … → `paid` \| `cancelled`) is **unchanged**; **`paid`** on the **contest** still means “scoring complete / dry-run payouts published,” **not** “entry fees settled.”
- **Dry-run `payouts/dryRun`** remains **separate** from Stripe **Charges** for entry fees.
- This ADR **amends** entry semantics: paid contests gain **payment fields** and a **new join path** via Checkout + webhooks.

---

## Sign-off

**Canonical Phase 0 production sign-off** (paid entry **and** prizes, checklist C1–C8, waiver register):  
**[weekly-contests-phase0-production-sign-off.md](weekly-contests-phase0-production-sign-off.md)**

Fill that document before Stripe **live** keys. The ADR-specific intent remains: **Checkout-first**, **USD cents**, **free path unchanged**, **webhook-authoritative** payment state, **no PAN** storage ([stripe.md](../payments/stripe.md)).

---

## References

- [product-roadmap-contests-and-payments.md](../product/product-roadmap-contests-and-payments.md) — Phases 5–7  
- [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) — implementation stories  
- [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md) — append-only **`ledgerEntries`** (P5-B2)  
- [weekly-contests-api-c1.md](weekly-contests-api-c1.md) — join API (**409** `payment_required` for paid contests — Story P5-F1)  
- [stripe.md](../payments/stripe.md) — environment variables and key safety  
