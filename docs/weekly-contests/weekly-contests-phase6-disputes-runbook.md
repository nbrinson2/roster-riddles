# Weekly contests — disputes & chargebacks (Phase 6 Story P6-F2)

**Status:** Playbook (documentation only; no new server routes in this story)  
**Depends on:** [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) (entry fee webhooks), [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md), [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md), [stripe.md](../payments/stripe.md)  
**Related ops:** [weekly-contests-ops-p6-f1-void-prize.md](weekly-contests-ops-p6-f1-void-prize.md) (void after real prize transfers)

## Why this doc exists

Stripe **disputes** (cardholder chargebacks) attach to **card payments** — in this product, primarily **contest entry fees** (`PaymentIntent` / `Charge` created by Checkout). **Prize money** moves as **Connect Transfers** from the platform to winners’ **`acct_…`** balances; those objects **do not** share a 1:1 mapping with a single “contest dispute” record in Stripe. A support ticket that says “dispute on the contest” may refer to **entry fee**, **prize**, or **both** — operators must **split the financial story** before acting.

---

## Quick triage

| Symptom | Likely Stripe object | First place to look |
|---------|----------------------|----------------------|
| Email from Stripe / “Dispute opened” on a **card** payment | **`Dispute`** on underlying **`Charge`** / **`PaymentIntent`** | [Payments → Disputes](#stripe-dashboard--docs-links) — correlate **`metadata.contestId`** / **`metadata.uid`** from the PaymentIntent (Phase 5 Checkout metadata). |
| Winner says money **reversed** from their Connect balance | **`transfer.reversed`** / Transfer Reversal | [Balances / Connect](#stripe-dashboard--docs-links), **`ledgerEntries`** for `prize_transfer_reversal`, [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) (section **Phase 6 Story P6-E2**), [P6-F1 void-after-prize](weekly-contests-ops-p6-f1-void-prize.md). |
| Accounting mismatch between **Firestore ledger** and Stripe | Either path | [Reconciliation](#reconciliation-checklist) below; do **not** edit ledger docs — **append** corrective lines per [ledger rules](weekly-contests-phase5-ledger-schema.md). |

---

## Entry fee disputes (Phase 5)

**Money flow:** Player pays entry fee → **`contest_entry_charge`** ledger line (webhook idempotency on `evt_…`). Disputes attach to the **card charge**, not to `contests/{id}` as a first-class Stripe object.

**Operational steps (high level):**

1. Open **Stripe Dashboard → Payments** (or **Disputes**) and locate the dispute by **`dp_…`**, **`ch_…`**, or **`pi_…`**.
2. Confirm **contest scope** using PaymentIntent / Checkout Session **metadata** (`contestId`, `uid`, `entryFeeCents`) — same keys as [checkout session creation](../../server/contests/contest-checkout.http.js).
3. Follow Stripe’s evidence / accept / counter workflow for the **dispute lifecycle** — see [Stripe Disputes documentation](https://docs.stripe.com/disputes).
4. If the dispute **closes** in favor of the cardholder, Stripe creates balance movements; **v1** ledger may need a **manual** line (today: **`contest_entry_adjustment`** or **`other`** with `metadata.rationale` — see [Ledger annotation (future `dispute_adjustment`)](#ledger-annotation-future-dispute_adjustment)).

**Webhooks:** Subscribe to dispute-related events in Stripe if product requires automated reactions (not fully implemented in v1 — treat as **operator-led** unless a future story adds handlers).

---

## Prize / Connect disputes (Phase 6)

**Money flow:** Platform **`stripe.transfers.create`** → winner Connect account; ledger **`prize_transfer_out`** (doc id often `tr_…`). Reversals may appear as **`transfer.reversed`**, Admin **[void-after-prize](weekly-contests-ops-p6-f1-void-prize.md)**, or Stripe-initiated flows.

**Important:** A **card dispute on the entry fee** does **not** automatically claw back **prize Transfers** already sent to Connect. Product / Legal must decide **policy** (e.g. void contest and reverse prizes via P6-F1, or absorb loss). This runbook does not replace that policy — it ensures **engineering and support use the same vocabulary**.

**Operational steps (high level):**

1. Identify whether the user’s complaint is **entry**, **prize**, or **both** (separate Stripe surfaces).
2. For **prize** issues after payout: inspect **`contests/{contestId}/payouts/final`**, **`ledgerEntries`**, and Connect **Transfers** in Dashboard.
3. If policy requires undoing prizes: **[void-after-prize](weekly-contests-ops-p6-f1-void-prize.md)** (Admin) or manual Stripe reversal **plus** ledger alignment (see ledger section).

---

## Stripe Dashboard & docs links

Use the **same mode** as the incident (**Test** vs **Live**). Replace the hostname if your team uses a custom Dashboard domain.

| Area | Dashboard (typical path) | Stripe docs |
|------|---------------------------|---------------|
| **Disputes (card)** | [Dashboard → Disputes](https://dashboard.stripe.com/test/disputes) (toggle Live in the UI) | [Disputes](https://docs.stripe.com/disputes) |
| **Payments / PaymentIntents** | [Dashboard → Payments](https://dashboard.stripe.com/test/payments) | [PaymentIntents](https://docs.stripe.com/payments/paymentintents) |
| **Connect → Transfers** | [Dashboard → Connect → Transfers](https://dashboard.stripe.com/test/connect/transfers) | [Connect Transfers](https://docs.stripe.com/connect/charges#transfer-options) |
| **Connect → Payouts (bank)** | [Dashboard → Connect → Payouts](https://dashboard.stripe.com/test/connect/payouts) | [Payouts](https://docs.stripe.com/payouts) |
| **Logs / Events** | [Dashboard → Developers → Events](https://dashboard.stripe.com/test/workbench/events) | [Webhooks](https://docs.stripe.com/webhooks) |

---

## Internal escalation

| Severity | Example | Suggested routing |
|----------|---------|-------------------|
| **P1 — money movement wrong or duplicate** | Duplicate `contest_entry_charge`, prize sent to wrong `uid`, ledger total ≠ Stripe | Page **on-call engineer**; freeze further payouts for that contest if needed; open incident doc with **`contestId`**, **`pi_`/`tr_` ids**, timestamps. |
| **P2 — dispute window / evidence** | Stripe dispute needs evidence before deadline | **Finance / ops** owner for Stripe Dashboard + **product** for copy; engineering supplies **`metadata`** and Firestore snapshots (read-only export). |
| **P3 — user comms only** | Confusion about “pending” prize | **Support** with scripted reply; link to in-app rules / contest status; no ledger change without finance sign-off. |

**Artifacts to attach to tickets:** Stripe object ids (`dp_`, `pi_`, `ch_`, `tr_`, `re_`), **`contestId`**, **`uid`**, relevant **`ledgerEntries`** doc ids, and (if applicable) **`payoutJobId`** / **`voidJobId`** from **`payouts/final`** or **`voidPrizeAttempts`**.

---

## Reconciliation checklist

1. **Stripe balance / Connect balance** — does the platform show the expected funds after dispute or reversal?
2. **`ledgerEntries`** — sum **credits vs debits** for `contestId` + `uid` (support query via Admin SDK / BigQuery export — not client-exposed).
3. **`contests/.../entries/{uid}`** — `paymentStatus`, `refundedAmountCents`, `stripePaymentIntentId` align with Phase 5 behavior ([webhooks doc](weekly-contests-phase5-webhooks.md)).
4. **`payouts/final`** — if present, do **`lines[].stripeTransferId`** match Transfers in Dashboard?

---

## Ledger annotation (future `dispute_adjustment`)

**Today (v1):** `contest-ledger-entry-validate.js` does **not** allow `dispute_adjustment`. For manual corrections after a dispute or chargeback, use:

- **`contest_entry_adjustment`** with explicit **`direction`** and **`metadata`** (`rationale`, `stripeDisputeId: dp_…`, `contestId`) — preferred for **entry-fee** side effects; or  
- **`other`** — only when no existing line type fits; **must** document rationale in `metadata`.

**Future (P6+):** When product adds **`dispute_adjustment`** to validation and ADR:

| Field | Convention (proposal) |
|-------|------------------------|
| **`lineType`** | **`dispute_adjustment`** |
| **`direction`** | **`credit`** \| **`debit`** — platform-centric, same as `contest_entry_adjustment` (document per case). |
| **`stripeObjectType`** | **`dispute`** |
| **`stripeObjectId`** | **`dp_…`** |
| **`metadata`** | **`contestId`**, **`uid`**, **`feeOrPrize`**: **`entry_fee`** \| **`prize`** \| **`mixed`**, optional link to internal ticket id. |
| **`source`** | **`webhook`** if automated from a future handler; else **`admin_adjustment`**. |

Until that line type exists, **do not** write `dispute_adjustment` to Firestore — validation will reject it.

---

## References

- [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md) — ADR table row on disputes vs prizes  
- [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) — P5-E1–E3 + P6-E2  
- [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md) — append-only discipline  
- [stripe.md](../payments/stripe.md) — environment and keys
