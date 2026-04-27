# Weekly contests — Stripe webhooks (Phase 5 Story P5-C2+)

**Status:** Signature verification (P5-C2); **success** (P5-E1), **failure / expired** (P5-E2), **refunds** (P5-E3); **Connect** `account.updated` (P6-B3).  
**Endpoint:** `POST /api/v1/webhooks/stripe`  
**Implementation:** [`server/payments/stripe-webhook.http.js`](../server/payments/stripe-webhook.http.js), registered in [`index.js`](../index.js) **before** `express.json()` so the raw body is available for `stripe.webhooks.constructEvent`.  
**Structured logs / metrics (P5-H1):** [`weekly-contests-phase5-observability.md`](weekly-contests-phase5-observability.md), [`contest-payments-observability.js`](../../server/payments/contest-payments-observability.js).

---

## Requirements

| Item | Notes |
|------|--------|
| **Raw body** | Stripe signs the **exact** JSON bytes. Use `express.raw({ type: 'application/json' })` **only** on this route, registered **before** global `express.json()`. |
| **Header** | `Stripe-Signature` — required; missing → **400** `stripe_webhook_missing_signature`. |
| **Secret** | `STRIPE_WEBHOOK_SECRET` (Dashboard → Webhooks → signing secret, or `stripe listen` CLI secret). Unset → **503** `stripe_webhook_not_configured` (do not accept unsigned traffic). |
| **API key** | `STRIPE_SECRET_KEY` must be set for `getStripeClient()` — same as Checkout (see [stripe.md](../payments/stripe.md)). |
| **Auth** | **No** Firebase `Authorization` — Stripe calls this endpoint; trust is **HMAC signature only**. |

---

## Verification behavior

- **Valid signature:** **200** `{ "received": true }` and structured log with `eventId`, `eventType` (no full payload in logs by default).
- **Invalid / tampered payload:** **400** `stripe_webhook_invalid_signature` — generic message; details only in server logs (`signature_verify_failed`).
- **Replay / tolerance:** Handled inside Stripe SDK (`constructEvent`) using timestamp tolerance (default **300 seconds**); see [Stripe docs](https://docs.stripe.com/webhooks/signatures).

---

## Story P5-E1 — Paid entry success (`CONTESTS_PAYMENTS_ENABLED=true`)

**Implementation:** [`stripe-webhook.http.js`](../server/payments/stripe-webhook.http.js) → [`stripe-webhook-contest-payment.js`](../server/payments/stripe-webhook-contest-payment.js).

| Stripe event | When handled |
|--------------|----------------|
| **`checkout.session.completed`** | `mode === payment`, `payment_status === paid`, session metadata includes `contestId`, `uid`, `entryFeeCents` (same shape as [checkout-session](../server/contests/contest-checkout.http.js) creates). |
| **`payment_intent.succeeded`** | PaymentIntent metadata includes the same keys (copied from Checkout via `payment_intent_data.metadata`). |

**Firestore writes (Admin SDK, single transaction per delivery):**

1. **`processedStripeEvents/{event.id}`** — first-class idempotency for Stripe **event id** redelivery (same `evt_...` → no duplicate work).
2. **`ledgerEntries/{event.id}`** — at most **one ledger credit per successful first settlement** for a given **PaymentIntent** (see below).
3. **`contests/{contestId}/entries/{uid}`** — `paymentStatus: paid`, fee snapshot, Stripe ids, `paidAt`, `schemaVersion` 2, etc.
4. **`contests/{contestId}/stripePiSettlements/{paymentIntentId}`** — records which Stripe event id created the fee ledger line so the **companion** success event (Checkout session vs PaymentIntent) does **not** append a second credit.

**Validation:** Contest must exist with `entryFeeCents > 0`, contest fee must equal `metadata.entryFeeCents`, and the paid amount (`amount_total` / `amount_received`) must equal that fee. Mismatches write `processedStripeEvents` with `outcome: rejected` and **200** to stop blind retries on bad data.

**Structured logs:** JSON lines with `component: stripe_webhook`, `requestId`, `eventType`, `eventId`, and when applicable `contestId`, `uid`, `outcome` (e.g. `ok`, `ok_duplicate_pi_event`, `already_paid_same_payment_intent`, `duplicate_stripe_event`, `rejected` reasons).

**Payments disabled:** When `CONTESTS_PAYMENTS_ENABLED` is not `true`, contest success events are **not** applied to Firestore; the handler still returns **200** after logging (`contestPaymentSkipped: payments_disabled`).

---

## Story P5-E2 — Payment failed / session expired (`CONTESTS_PAYMENTS_ENABLED=true`)

**Implementation:** [`stripe-webhook.http.js`](../server/payments/stripe-webhook.http.js) → [`stripe-webhook-contest-payment-failure.js`](../server/payments/stripe-webhook-contest-payment-failure.js).

**Ledger:** **No** `ledgerEntries` writes on failure (v1 — no informational ledger lines).

### Event type → Firestore behavior

| Stripe `type` | Parsed when | `processedStripeEvents/{event.id}` | `entries/{uid}` update |
|---------------|-------------|--------------------------------------|-------------------------|
| **`payment_intent.payment_failed`** | `metadata.contestId` + `metadata.uid` present; `pi_` id on object | Always written when handled (idempotency) | **`paymentStatus: failed`** only if doc exists and current status is **`pending`** or **`failed`**; merge `stripePaymentIntentId`, `lastStripeEventId`, `schemaVersion` 2 |
| **`checkout.session.async_payment_failed`** | `mode === payment` + same metadata keys on session | Same | Same; may set **`stripeCheckoutSessionId`** from session id |
| **`checkout.session.expired`** | `mode === payment` + same metadata | Same | Same; may set **`stripeCheckoutSessionId`** |

### Outcomes (no entry / skip / terminal)

| Condition | `processedStripeEvents.outcome` (representative) | Entry doc |
|-----------|---------------------------------------------------|-----------|
| Contest missing | `failure_no_contest` | — |
| Contest has no entry fee (`entryFeeCents` 0 / absent) | `failure_ignored_free_contest` | — |
| No `entries/{uid}` (typical abandoned Checkout) | `failure_no_entry` | — |
| Entry **`paid`**, **`free`**, or **`refunded`** | `failure_skip_terminal_entry` | Unchanged (never downgrade from paid) |
| Entry exists but **`paymentStatus`** is not `pending` / `failed` (e.g. legacy Phase 4 row) | `failure_skipped_legacy_entry` | Unchanged |
| Entry **`pending`** or **`failed`** | `failure_entry_marked_failed` | `paymentStatus: failed` + Stripe ids / `lastStripeEventId` |

**Structured logs:** Same `component: stripe_webhook` JSON lines with `contestId`, `uid`, `outcome` (e.g. `failure_no_entry`, `failure_entry_marked_failed`).

**Payments disabled:** Same as P5-E1 — no Firestore updates; **200** + `contestPaymentSkipped: payments_disabled` in the generic `received` log when applicable.

---

## Story P5-E3 — Refunds (`CONTESTS_PAYMENTS_ENABLED=true`)

**Implementation:** [`stripe-webhook.http.js`](../server/payments/stripe-webhook.http.js) → [`stripe-webhook-contest-payment-refund.js`](../server/payments/stripe-webhook-contest-payment-refund.js).

**Stripe API:** Contest `contestId` / `uid` are read from **PaymentIntent metadata** (same as Checkout) via `paymentIntents.retrieve` using the PaymentIntent on the refund or charge.

### Event type → ledger + entry

| Stripe `type` | When applied | `ledgerEntries/{event.id}` | `entries/{uid}` |
|---------------|--------------|----------------------------|-----------------|
| **`refund.updated`** | `status === succeeded`, `currency === usd`, `amount > 0`, PI has contest metadata | **`contest_entry_refund`**, **`direction: debit`**, `amountCents` = refund amount, `stripeObjectType: refund`, `stripeObjectId` = `re_...` | Increments **`refundedAmountCents`** (capped at `entryFeeCentsSnapshot`); **`paymentStatus`** stays **`paid`** until cumulative refund reaches snapshot, then **`refunded`** |
| **`charge.refunded`** | Charge is **fully** refunded: `amount_refunded >= amount`, USD | **None** (avoids double-counting with `refund.updated`) | Sets **`paymentStatus: refunded`** + `lastStripeEventId`; **does not** set `refundedAmountCents` — `refund.updated` remains the source of truth for cents + ledger |

**Idempotency:** `processedStripeEvents/{event.id}` for each Stripe event. **`refund.updated`:** skips with **`refund_skip_already_fully_refunded`** when cumulative refunds already reached the fee snapshot (no extra ledger row).

**Subscribe in Stripe:** Use both **`refund.updated`** and **`charge.refunded`** for correct UX; ledger reconciliation relies on **`refund.updated` (succeeded)**.

### Skip / error outcomes (representative)

| Outcome | Meaning |
|---------|---------|
| `refund_skip_non_succeeded` | `refund.updated` not terminal success yet |
| `refund_not_contest_metadata` | PI metadata missing `contestId` / `uid` |
| `refund_no_entry` / `refund_no_contest` | Row or contest missing |
| `refund_skip_entry_not_paid` | Entry not in a refundable payment state |
| `refund_pi_mismatch` | Entry’s `stripePaymentIntentId` does not match refund PI |
| `charge_refunded_skip_partial_or_non_usd` | Partial charge refund (handled via `refund.updated`) or non-USD |

---

## Phase 6 Story P6-B3 — Connect `account.updated` (`CONTESTS_PAYMENTS_ENABLED=true`)

**Implementation:** [`stripe-webhook.http.js`](../server/payments/stripe-webhook.http.js) → [`stripe-webhook-connect.js`](../server/payments/stripe-webhook-connect.js).  
**User document field names:** [weekly-contests-schema-users-payouts.md](weekly-contests-schema-users-payouts.md) (Story P6-C1).

### Stripe Dashboard — subscribe to this event

| Stripe `type` | When handled |
|---------------|--------------|
| **`account.updated`** | Connected account object includes `metadata.firebase_uid` (set by P6-B2 onboarding); updates **`users/{uid}`** snapshot fields only when the user doc exists and any stored **`stripeConnectAccountId`** matches the event’s `acct_…` (or is absent, in which case the id is healed from the event). |

**Not v1-handled (optional later):** `capability.updated`, `person.updated` — rely on Stripe emitting **`account.updated`** after capability / person changes for Express accounts.

### Firestore writes (Admin SDK, one transaction per delivery)

1. **`processedStripeEvents/{event.id}`** — idempotency for Stripe **event id** redelivery (same collection as P5-E1; `outcome` values prefixed with `connect_`).
2. **`users/{uid}`** — merge-only snapshot (no full Stripe account JSON):

| Field | Meaning |
|-------|---------|
| `stripeConnectChargesEnabled` | boolean |
| `stripeConnectPayoutsEnabled` | boolean |
| `stripeConnectDetailsSubmitted` | boolean |
| `stripeConnectRequirementsCurrentlyDueCount` | length of `requirements.currently_due` |
| `stripeConnectRequirementsCurrentlyDueSummary` | comma-joined requirement strings, truncated (~500 chars) |
| `stripeConnectLastWebhookEventId` | Stripe `evt_…` |
| `stripeConnectLastAccountUpdatedAt` | server timestamp |
| `stripeConnectAccountType` | from Stripe Account `type` when present |
| `stripeConnectAccountId` | set only when missing on the user doc (**self-heal**) |

### Skip / reject outcomes (representative)

| `processedStripeEvents.outcome` | Meaning |
|----------------------------------|---------|
| `connect_rejected_missing_firebase_uid_metadata` | Connected account has no usable `metadata.firebase_uid` |
| `connect_rejected_user_doc_missing` | No `users/{uid}` document |
| `connect_rejected_stored_account_mismatch` | User doc has a different `stripeConnectAccountId` than this `acct_…` |
| `connect_duplicate_stripe_event` | Same `evt_…` replayed |

**Payments disabled:** When `CONTESTS_PAYMENTS_ENABLED` is not `true`, Connect events are **not** applied; the handler still returns **200** after logging (`connectWebhookSkipped: payments_disabled`).

---

## Phase 6 Story P6-E2 — Prize `transfer.*` + Connect bank `payout.*`

**Implementation:** [`stripe-webhook.http.js`](../server/payments/stripe-webhook.http.js) → [`stripe-webhook-payouts.js`](../server/payments/stripe-webhook-payouts.js).

### Stripe Dashboard — subscribe to these events

| Stripe `type` | When handled |
|---------------|----------------|
| **`transfer.created`**, **`transfer.paid`**, **`transfer.updated`** | When Transfer **`metadata`** includes **`contest_id`**, **`firebase_uid`**, and (optionally) **`rank`** (same keys as [payout execute](../server/contests/contest-payout-execute.job.js) metadata): merge **`lastStripeEventId`** on the matching row in **`contests/{contestId}/payouts/final`**, set line **`status`** to **`succeeded`** for positive money lines when Stripe shows no failure/reversal, or **`failed`** with a **`failurePublicCode`** enum when appropriate; recompute **`aggregateStatus`**. |
| **`transfer.failed`** | Same metadata gate: mark matching **`payouts/final`** line **`failed`** with mapped **`failurePublicCode`** / **`failureCode`** (enum strings only). |
| **`transfer.reversed`** | Same metadata gate: mark line **`failed`**, append **`ledgerEntries/prize_reversal_{tr_…}`** with **`prize_transfer_reversal`** (**`credit`**) for the reversed cents **once per Transfer** (so `transfer.updated` with `reversed` does not double-credit; duplicate `evt_…` still idempotent via **`processedStripeEvents`**). |
| **`payout.paid`**, **`payout.failed`**, **`payout.canceled`**, **`payout.updated`** | Always write **`processedStripeEvents/{event.id}`** (idempotency). When **exactly one** `users/{uid}` has **`stripeConnectAccountId === event.account`**, merge optional **`stripePayoutLast*`** fields ([schema](weekly-contests-schema-users-payouts.md)). |

**Non-contest transfers:** Transfers **without** contest metadata still write **`processedStripeEvents/{event.id}`** with `outcome: transfer_not_contest_metadata` so Stripe redeliveries do not spam work.

### Idempotency & ledger

- **`processedStripeEvents/{event.id}`** — same collection as P5-E1 / P6-B3; one document per Stripe event id.
- **`ledgerEntries/prize_reversal_{tr_…}`** for prize reversals — **not** the same doc id as **`prize_transfer_out`** (`ledgerEntries/{tr_…}` from the execute job).

### Mapped failure enums (no raw Stripe strings on `payouts/final`)

Server maps Stripe `failure_code` / types to stable **`failurePublicCode`** / **`stripePayoutLastFailurePublicCode`** strings (see `mapTransferStripeFailureToPublicCode` / `mapPayoutStripeFailureToPublicCode` in code). Clients should display **copy keyed off these enums**, not raw Stripe text.

---

## Local development

```bash
# Forward test events to your API (install Stripe CLI)
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

The CLI prints a **webhook signing secret** (`whsec_...`) — set `STRIPE_WEBHOOK_SECRET` to that value in `.env` (test mode only).

---

## Related

- [stripe.md](../payments/stripe.md) — env vars  
- [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) — backlog / exit criteria  
- [weekly-contests-phase5-staging-qa.md](weekly-contests-phase5-staging-qa.md) — staging QA & reconciliation (P5-H2)  
