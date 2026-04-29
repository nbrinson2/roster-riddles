# Stripe (test vs live) — Phase 1 placeholders

**Broader roadmap:** entry fees, webhooks, and payouts sit in [product-roadmap-contests-and-payments.md](product-roadmap-contests-and-payments.md) (Phases 5–6).

**Phase 5** (contest entry fees) uses Checkout + webhooks in-repo; **Phase 6** (winner payouts via **Connect**) is specified in docs and ADR — see [Connect appendix](#stripe-connect-phase-6--winner-payouts) below. Use this doc so **non-production** never uses **live** Stripe keys by mistake.

## Rules

| Environment | Secret key (`sk_*`) | Publishable key (`pk_*`) |
|-------------|---------------------|---------------------------|
| **Local / staging** | `sk_test_…` only | `pk_test_…` only |
| **Production** | `sk_live_…` from Secret Manager / Cloud Run secrets | `pk_live_…` injected at **build** time for the Angular bundle (or loaded from a safe config source) |

Never commit keys. Never put **secret** keys in the Angular app — only **publishable** keys belong in the client bundle.

## Environment variables (names only)

| Variable | Used by | Where to set |
|----------|---------|----------------|
| `STRIPE_SECRET_KEY` | Express — [`server/payments/stripe-server.js`](../server/payments/stripe-server.js) (`getStripeClient`) | **Local:** `.env` with `sk_test_…` **or** a path to a one-line file (e.g. `./secrets/stripe-secret-key.txt`), same as operator secrets — see [`resolveSecretFromEnv`](../server/lib/contest-internal-auth.js). **Cloud Run:** Secret Manager → env var (value is the key, not a path). |
| `CONTESTS_PAYMENTS_ENABLED` | Express — if **`true`**, **`STRIPE_SECRET_KEY` is required** or the process **exits on startup** (Phase 5 Story P5-C1). Omit or `false` until payment routes are deployed. **Angular:** same variable at **build** time → `environment.contestsPaymentsEnabled` via [`generate-env-prod.mjs`](../../scripts/generate-env-prod.mjs); Cloud Build substitution **`_CONTESTS_PAYMENTS_ENABLED`** (defaults **`true`** in [`cloudbuild.yaml`](../../cloudbuild.yaml)). See [weekly-contests-gl-c1-production-paid-ui-build.md](../weekly-contests/weekly-contests-gl-c1-production-paid-ui-build.md). | Cloud Run / `.env` / **Docker build-arg** |
| `CONTESTS_CHECKOUT_APP_ORIGIN` | Express — public **browser** origin for Stripe Checkout **success/cancel** URLs (Phase 5 Story P5-D1). Example: `http://localhost:4300` when using `ng serve`; production: `https://your-domain.com`. **No trailing slash.** | `.env` / Cloud Run |
| `STRIPE_PUBLISHABLE_KEY` | Angular build (`environment.*` via `generate-env-prod.mjs`) | **Cloud Build:** substitution `_STRIPE_PUBLISHABLE_KEY` → Docker `--build-arg STRIPE_PUBLISHABLE_KEY` → `generate-env-prod.mjs`. Use **`pk_test_…`** on staging triggers; **`pk_live_…`** only on the production trigger (Story **GL-C3:** [weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md](../weekly-contests/weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md)). |
| `STRIPE_WEBHOOK_SECRET` | Express — `POST /api/v1/webhooks/stripe` ([`server/payments/stripe-webhook.http.js`](../server/payments/stripe-webhook.http.js); see [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md)) | Same file-path pattern as `STRIPE_SECRET_KEY` when local. **test** `whsec_…` from Stripe CLI or Dashboard. |
| `CONTESTS_PAYMENTS_METRIC_COUNTERS` | Optional — set to **`1`** to emit extra **`contest_payments_metrics`** JSON lines (failure counters) alongside webhook logs; see [weekly-contests-phase5-observability.md](../weekly-contests/weekly-contests-phase5-observability.md) (P5-H1). | Omit in dev unless testing sinks. |
| `CONTESTS_PAYOUT_METRIC_COUNTERS` | Optional — set to **`1`** to emit extra **`contest_payout_metrics`** JSON lines for Phase 6 **prize payout job** and **`transfer.*` / `payout.*`** webhook failures; see [weekly-contests-phase6-observability.md](../weekly-contests/weekly-contests-phase6-observability.md) (P6-H2). | Omit in dev unless testing sinks. |

## Server module (Phase 5 — P5-C1, P5-C2)

- **`server/payments/stripe-server.js`** — official **Stripe Node SDK**; lazy singleton. Logs **`stripeSecretKeyMode`** (`test` \| `live` \| `unknown`) on first init — **never** logs the secret.
- **`validateStripeConfigAtStartup()`** — runs from `index.js` before `listen`. If `CONTESTS_PAYMENTS_ENABLED=true` and `STRIPE_SECRET_KEY` is missing → JSON error log and **`process.exit(1)`**.
- **`sendStripeServiceUnavailable(res)`** — JSON **503** for future payment routes when Stripe is unavailable.
- **`POST /api/v1/webhooks/stripe`** (Story **P5-C2**) — raw JSON body + `Stripe-Signature`; `constructEvent` with `STRIPE_WEBHOOK_SECRET`. See [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md).
- **Checkout redirect (P5-D2):** the Angular app does **not** need `stripePublishableKey` for the hosted Checkout redirect flow — only the server creates the session. Publishable key remains for future Payment Element / client-side Stripe.js.
- **Angular bundle:** `generate-env-prod.mjs` does **not** include `STRIPE_SECRET_KEY` — only optional **`stripePublishableKey`**.

## Repository wiring

- **`.env.example`** — lists `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `CONTESTS_PAYMENTS_ENABLED` as comments (no values).
- **`src/environment.ts`** — `stripePublishableKey: ''` until CI supplies `STRIPE_PUBLISHABLE_KEY` at build time.
- **`scripts/generate-env-prod.mjs`** — emits `stripePublishableKey` from `STRIPE_PUBLISHABLE_KEY` (optional; empty if unset).
- **`STRIPE_PUBLISHABLE_KEY` (prod)** — set **`pk_live_…`** on the production Cloud Build trigger before relying on client Stripe.js — [weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md](../weekly-contests/weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md) (Story **GL-C3**).
- **`SIMULATED_CONTESTS_UI_ENABLED`** — Angular-only; dashed simulated contest strip defaults **off** on production builds unless explicitly `true` — [weekly-contests-gl-c2-simulated-contests-ui-build.md](../weekly-contests/weekly-contests-gl-c2-simulated-contests-ui-build.md) (Story **GL-C2**).
- **`Dockerfile` (build stage)** — optional `ARG STRIPE_PUBLISHABLE_KEY` for the Angular bundle.
- **`cloudbuild.yaml`** — optional `_STRIPE_PUBLISHABLE_KEY` substitution passed as build-arg (defaults to empty).

## Cloud Run (runtime)

When you add server-side Stripe calls, set **`STRIPE_SECRET_KEY`** on the **staging** and **production** services separately (staging = test key, prod = live key). Do not bake secret keys into the Docker image; use **secrets** or **environment variables** configured in the Cloud Run console / Terraform.

**Contest payments flag (Story GL-D1):** set **`CONTESTS_PAYMENTS_ENABLED=true`** on the service when enabling paid entry server-side; **`GET /health`** exposes **`contestsPaymentsEnabled`** and **`stripeSecretKeyMode`** (non-secret). See [weekly-contests-gl-d1-api-contest-payments-enabled.md](../weekly-contests/weekly-contests-gl-d1-api-contest-payments-enabled.md).

---

## Stripe Connect (Phase 6 — winner payouts)

**Product / architecture ADR:** [weekly-contests-phase6-payouts-adr.md](../weekly-contests/weekly-contests-phase6-payouts-adr.md) § *Stripe Connect account model* (Story **P6-B1**).  
**Firestore field names on `users/{uid}`:** [weekly-contests-schema-users-payouts.md](../weekly-contests/weekly-contests-schema-users-payouts.md) (Story **P6-C1**).

### Account type chosen for v1

| v1 choice | Notes |
|-----------|--------|
| **Express** connected accounts | Stripe-hosted **onboarding** and **KYC**; platform uses **`stripe.transfers.create`** to move funds to `destination: acct_…`. **Standard** and **Custom** are documented as **not v1** unless ADR is revised. |

### Platform prerequisites (Stripe Dashboard)

- **Connect** enabled on the **platform** Stripe account (same account as **`STRIPE_SECRET_KEY`**).
- **Branding** and **Express** settings configured per Stripe Connect onboarding docs.
- **Webhooks** for Connect lifecycle events must hit the same verified endpoint as Phase 5 (`POST /api/v1/webhooks/stripe`). Subscribe to **`account.updated`** on your Connect webhook (see [weekly-contests-phase5-webhooks.md](../weekly-contests/weekly-contests-phase5-webhooks.md) Phase 6 section — Story **P6-B3**).

### Keys and permissions

- The platform **secret key** (`sk_test_…` / `sk_live_…`) must be able to call **Connect** APIs (`accounts.create`, `accountLinks.create`, `transfers.create`, etc.). Restricted keys are **allowed** only if every required capability is included — for early development, a **standard secret key** in a locked-down runtime is simpler.
- **Never** send the platform secret key to the browser. Connect **Account Links** are created **server-side**; the client only receives a **one-time URL** (P6-B2).

### Test vs live (same rule as above)

| Environment | Connect |
|-------------|---------|
| **Staging / local** | **Test mode** Connect accounts only — create and onboard test connected accounts in the Stripe test Dashboard. |
| **Production** | **Live mode** Connect + live transfers — **only** after Phase 0 legal sign-off on prizes ([product-roadmap](../product/product-roadmap-contests-and-payments.md) Phase 6). |

### Operational links

- Stripe docs: **Connect onboarding** (Express), **Transfers**, **Account Links**.
- **Tax / 1099 / winner reporting (v1, document-only):** [weekly-contests-tax-winner-reporting-posture.md](../weekly-contests/weekly-contests-tax-winner-reporting-posture.md) (Story **GL-A2**). Stripe: [Connect tax reporting](https://docs.stripe.com/connect/tax-reporting).
- Support runbook (copy / UX): [weekly-contests-phase6-payouts-ux.md](../weekly-contests/weekly-contests-phase6-payouts-ux.md).
- Staging QA (Connect + transfer E2E): [weekly-contests-phase6-staging-qa.md](../weekly-contests/weekly-contests-phase6-staging-qa.md) (Story **P6-I1**).
- Disputes / chargebacks (entry fee vs prize): [weekly-contests-phase6-disputes-runbook.md](../weekly-contests/weekly-contests-phase6-disputes-runbook.md) (Story **P6-F2**).

## Sanity check

- Test secret keys start with `sk_test_`.
- Live secret keys start with `sk_live_`.
- If you see `sk_live_` in a staging log or `.env` for local dev, stop and rotate keys.
