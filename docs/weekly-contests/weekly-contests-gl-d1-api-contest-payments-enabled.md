# Story GL-D1 — Enable contest payments on the API (`CONTESTS_PAYMENTS_ENABLED=true`)

**Story:** **GL-D1** in [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md) (Epic **GL-D** — Production server runtime).

**Purpose:** Turn on **`CONTESTS_PAYMENTS_ENABLED`** for the **Express / Cloud Run** process so Checkout, webhooks, Connect handlers, and payout gates run against Stripe — with **`STRIPE_SECRET_KEY`** provisioned and startup validation passing.

## Wiring

| Layer | Behavior |
|-------|----------|
| **`server/payments/stripe-server.js`** | **`isContestsPaymentsEnabled()`** — **`true`** only when **`process.env.CONTESTS_PAYMENTS_ENABLED === 'true'`**. **`validateStripeConfigAtStartup()`** — if enabled and **`STRIPE_SECRET_KEY`** missing → JSON error log and **`process.exit(1)`**. First **`getStripeClient()`** logs **`stripe_client_initialized`** with **`stripeSecretKeyMode`** (`test` \| `live` \| `unknown`). |
| **`index.js`** | Calls **`validateStripeConfigAtStartup()`** before **`listen`**. **`GET /health`** merges Stripe flags from **`getStripeHealthFields()`** plus **`contestsPayoutExecuteSecretConfigured`** ([GL-D4](weekly-contests-gl-d4-operator-secrets-payout-execute.md)). |
| **`cloudbuild.yaml`** | **`gcloud run deploy … --update-env-vars=CONTESTS_PAYMENTS_ENABLED=$_CONTESTS_PAYMENTS_ENABLED`** — default **`_CONTESTS_PAYMENTS_ENABLED: 'true'`** aligns API with Angular when using the same substitution ([GL-C1](weekly-contests-gl-c1-production-paid-ui-build.md)). |

## Secrets

- **`STRIPE_SECRET_KEY`** — **`sk_live_…`** in production (Secret Manager / Cloud Run env **value**, not baked into the image). Same resolution pattern as local **`.env`** / file path ([`docs/payments/stripe.md`](../payments/stripe.md)).
- **Never** commit secret keys.

## Coordination with GL-C1

Match **server** **`CONTESTS_PAYMENTS_ENABLED`** with **Angular** **`contestsPaymentsEnabled`** rollout — otherwise users see paid UI while **`POST …/checkout-session`** returns **503** (`contest_payments_disabled`), or the reverse.

## Verification (acceptance)

1. **Startup:** After deploy, logs contain **`stripe_client_initialized`** with **`stripeSecretKeyMode":"live"`** (prod) or **`test`** (staging) — not **`exit(1)`** from **`validateStripeConfigAtStartup`**.
2. **Health:** **`GET /health`** returns JSON including Stripe fields above plus **`contestsCheckoutAppOriginConfigured`** (GL-D3) and **`contestsPayoutExecuteSecretConfigured`** (GL-D4 — set when **`PAYOUT_OPERATOR_SECRET`** or **`CONTESTS_OPERATOR_SECRET`** resolves). Example:
   ```json
   {"status":"ok","contestsPaymentsEnabled":true,"stripeSecretKeyMode":"live","stripeWebhookSecretConfigured":true,"contestsCheckoutAppOriginConfigured":true,"contestsPayoutExecuteSecretConfigured":true}
   ```

## References

- [`server/payments/stripe-server.js`](../../server/payments/stripe-server.js)
- [`index.js`](../../index.js)
- [`cloudbuild.yaml`](../../cloudbuild.yaml)
- [`docs/payments/stripe.md`](../payments/stripe.md)
- [weekly-contests-gl-d2-stripe-webhook-live.md](weekly-contests-gl-d2-stripe-webhook-live.md) — webhook signing secret (GL-D2)
- [weekly-contests-gl-d3-checkout-redirect-origin.md](weekly-contests-gl-d3-checkout-redirect-origin.md) — Checkout / Connect redirect origin (GL-D3)
- [weekly-contests-gl-d4-operator-secrets-payout-execute.md](weekly-contests-gl-d4-operator-secrets-payout-execute.md) — payout execute operator secrets (GL-D4)
