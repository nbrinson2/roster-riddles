# Story GL-D2 — Stripe webhook endpoint + signing secret (live mode)

**Story:** **GL-D2** in [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md) (Epic **GL-D** — Production server runtime).

**Purpose:** Register the app’s **live mode** webhook endpoint in the Stripe **live** Dashboard, subscribe to Phase 5 + 6 event types, and set **`STRIPE_WEBHOOK_SECRET`** on **production** Cloud Run so **`POST /api/v1/webhooks/stripe`** verifies signatures and idempotency works under real traffic.

## Endpoint (implementation)

| Item | Value |
|------|--------|
| **Path** | **`POST /api/v1/webhooks/stripe`** |
| **Public URL** | **`https://<your-production-host>/api/v1/webhooks/stripe`** (HTTPS, no auth header — trust **Stripe-Signature** only) |
| **Code** | [`server/payments/stripe-webhook.http.js`](../../server/payments/stripe-webhook.http.js), raw body registered **before** `express.json()` in [`index.js`](../../index.js) |

## Live mode vs test mode

- Use Stripe **live mode** in the Dashboard for production URLs and for the **`whsec_…`** signing secret that matches **that** endpoint.
- **Do not** use a **test** Dashboard webhook secret (`whsec_…` from test mode) with **live** Stripe events or the inverse — signature verification will fail or events will never match production money movement.

## Environment

| Variable | Role |
|----------|------|
| **`STRIPE_WEBHOOK_SECRET`** | Signing secret for the **live** endpoint you registered (`whsec_…`). Resolve via env value or one-line file path like **`STRIPE_SECRET_KEY`** ([`docs/payments/stripe.md`](../payments/stripe.md)). Unset → **503** `stripe_webhook_not_configured`. |

Set on **Cloud Run** (Secret Manager reference or env) — **not** in the Angular bundle.

## Events to subscribe (summary)

Authoritative list and behavior: **[weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md)** — at minimum:

- **Phase 5 — payments:** e.g. **`checkout.session.completed`**, **`payment_intent.succeeded`**, failure/expiry types, **`refund.updated`**, **`charge.refunded`**, etc.
- **Phase 6 — Connect:** **`account.updated`**
- **Phase 6 — payouts:** **`transfer.created`**, **`transfer.updated`**, **`transfer.reversed`**, and **`payout.*`** as documented

Use the Dashboard **event picker** to match the sections above; duplicate subscriptions are harmless.

## Verification (acceptance)

1. **Dashboard:** Developers → Webhooks → your **live** endpoint → **Send test event** (or wait for a real event) → delivery shows **2xx**. Misconfigured signing secret typically yields **400** invalid signature or **503** if secret unset.
2. **`GET /health`:** Response includes **`stripeWebhookSecretConfigured":true`** when **`STRIPE_WEBHOOK_SECRET`** resolves (boolean only — no `whsec` value). See [`getStripeHealthFields`](../../server/payments/stripe-server.js) (Story GL-D1 / GL-D2).
3. **Idempotency:** After a successful contest payment webhook, confirm **`processedStripeEvents/{eventId}`** in Firestore; resend the same event from the Dashboard → **200** without duplicate **`ledgerEntries`** / entry side effects ([weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) § Verification).

## References

- [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md)
- [`docs/payments/stripe.md`](../payments/stripe.md)
- [weekly-contests-phase5-staging-qa.md](weekly-contests-phase5-staging-qa.md) (test-mode rehearsal)
