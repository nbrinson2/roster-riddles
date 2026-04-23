# Weekly contests — Stripe webhooks (Phase 5 Story P5-C2+)

**Status:** Signature verification (P5-C2); **success webhooks** for paid contest entry (P5-E1) — `checkout.session.completed` and `payment_intent.succeeded` with contest metadata. Failure/refund handlers: P5-E2/E3.  
**Endpoint:** `POST /api/v1/webhooks/stripe`  
**Implementation:** [`server/payments/stripe-webhook.http.js`](../server/payments/stripe-webhook.http.js), registered in [`index.js`](../index.js) **before** `express.json()` so the raw body is available for `stripe.webhooks.constructEvent`.

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

## Local development

```bash
# Forward test events to your API (install Stripe CLI)
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

The CLI prints a **webhook signing secret** (`whsec_...`) — set `STRIPE_WEBHOOK_SECRET` to that value in `.env` (test mode only).

---

## Related

- [stripe.md](../payments/stripe.md) — env vars  
- [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) — P5-E2 / P5-E3 (failure + refund handlers)  
