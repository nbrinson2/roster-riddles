# Weekly contests — Stripe webhooks (Phase 5 Story P5-C2+)

**Status:** Signature verification implemented (Story P5-C2); **event handling** (entries, ledger) in P5-E.  
**Endpoint:** `POST /api/v1/webhooks/stripe`  
**Implementation:** [`server/payments/stripe-webhook.http.js`](../server/payments/stripe-webhook.http.js), registered in [`index.js`](../index.js) **before** `express.json()` so the raw body is available for `stripe.webhooks.constructEvent`.

---

## Requirements

| Item | Notes |
|------|--------|
| **Raw body** | Stripe signs the **exact** JSON bytes. Use `express.raw({ type: 'application/json' })` **only** on this route, registered **before** global `express.json()`. |
| **Header** | `Stripe-Signature` — required; missing → **400** `stripe_webhook_missing_signature`. |
| **Secret** | `STRIPE_WEBHOOK_SECRET` (Dashboard → Webhooks → signing secret, or `stripe listen` CLI secret). Unset → **503** `stripe_webhook_not_configured` (do not accept unsigned traffic). |
| **API key** | `STRIPE_SECRET_KEY` must be set for `getStripeClient()` — same as Checkout (see [stripe.md](stripe.md)). |
| **Auth** | **No** Firebase `Authorization` — Stripe calls this endpoint; trust is **HMAC signature only**. |

---

## Verification behavior

- **Valid signature:** **200** `{ "received": true }` and structured log with `eventId`, `eventType` (no full payload in logs by default).
- **Invalid / tampered payload:** **400** `stripe_webhook_invalid_signature` — generic message; details only in server logs (`signature_verify_failed`).
- **Replay / tolerance:** Handled inside Stripe SDK (`constructEvent`) using timestamp tolerance (default **300 seconds**); see [Stripe docs](https://docs.stripe.com/webhooks/signatures).

---

## Local development

```bash
# Forward test events to your API (install Stripe CLI)
stripe listen --forward-to localhost:3000/api/v1/webhooks/stripe
```

The CLI prints a **webhook signing secret** (`whsec_...`) — set `STRIPE_WEBHOOK_SECRET` to that value in `.env` (test mode only).

---

## Related

- [stripe.md](stripe.md) — env vars  
- [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) — P5-E handlers next  
