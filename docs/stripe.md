# Stripe (test vs live) — Phase 1 placeholders

**Broader roadmap:** entry fees, webhooks, and payouts sit in [product-roadmap-contests-and-payments.md](product-roadmap-contests-and-payments.md) (Phases 5–6).

Payment integration is not wired yet. Use this doc so **non-production** never uses **live** Stripe keys by mistake.

## Rules

| Environment | Secret key (`sk_*`) | Publishable key (`pk_*`) |
|-------------|---------------------|---------------------------|
| **Local / staging** | `sk_test_…` only | `pk_test_…` only |
| **Production** | `sk_live_…` from Secret Manager / Cloud Run secrets | `pk_live_…` injected at **build** time for the Angular bundle (or loaded from a safe config source) |

Never commit keys. Never put **secret** keys in the Angular app — only **publishable** keys belong in the client bundle.

## Environment variables (names only)

| Variable | Used by | Where to set |
|----------|---------|----------------|
| `STRIPE_SECRET_KEY` | Express — [`server/stripe-server.js`](../server/stripe-server.js) (`getStripeClient`) | **Local:** `.env` with `sk_test_…` **or** a path to a one-line file (e.g. `./secrets/stripe-secret-key.txt`), same as operator secrets — see [`resolveSecretFromEnv`](../server/contest-internal-auth.js). **Cloud Run:** Secret Manager → env var (value is the key, not a path). |
| `CONTESTS_PAYMENTS_ENABLED` | Express — if **`true`**, **`STRIPE_SECRET_KEY` is required** or the process **exits on startup** (Phase 5 Story P5-C1). Omit or `false` until payment routes are deployed. | Cloud Run / `.env` |
| `CONTESTS_CHECKOUT_APP_ORIGIN` | Express — public **browser** origin for Stripe Checkout **success/cancel** URLs (Phase 5 Story P5-D1). Example: `http://localhost:4300` when using `ng serve`; production: `https://your-domain.com`. **No trailing slash.** | `.env` / Cloud Run |
| `STRIPE_PUBLISHABLE_KEY` | Angular build (`environment.*` via `generate-env-prod.mjs`) | **Cloud Build:** substitution `_STRIPE_PUBLISHABLE_KEY` → Docker `--build-arg STRIPE_PUBLISHABLE_KEY` → `generate-env-prod.mjs`. Use **test** publishable key for staging triggers; **live** only on the production trigger. |
| `STRIPE_WEBHOOK_SECRET` | Express — `POST /api/v1/webhooks/stripe` ([`server/stripe-webhook.http.js`](../server/stripe-webhook.http.js); see [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md)) | Same file-path pattern as `STRIPE_SECRET_KEY` when local. **test** `whsec_…` from Stripe CLI or Dashboard. |

## Server module (Phase 5 — P5-C1, P5-C2)

- **`server/stripe-server.js`** — official **Stripe Node SDK**; lazy singleton. Logs **`stripeSecretKeyMode`** (`test` \| `live` \| `unknown`) on first init — **never** logs the secret.
- **`validateStripeConfigAtStartup()`** — runs from `index.js` before `listen`. If `CONTESTS_PAYMENTS_ENABLED=true` and `STRIPE_SECRET_KEY` is missing → JSON error log and **`process.exit(1)`**.
- **`sendStripeServiceUnavailable(res)`** — JSON **503** for future payment routes when Stripe is unavailable.
- **`POST /api/v1/webhooks/stripe`** (Story **P5-C2**) — raw JSON body + `Stripe-Signature`; `constructEvent` with `STRIPE_WEBHOOK_SECRET`. See [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md).
- **Checkout redirect (P5-D2):** the Angular app does **not** need `stripePublishableKey` for the hosted Checkout redirect flow — only the server creates the session. Publishable key remains for future Payment Element / client-side Stripe.js.
- **Angular bundle:** `generate-env-prod.mjs` does **not** include `STRIPE_SECRET_KEY` — only optional **`stripePublishableKey`**.

## Repository wiring

- **`.env.example`** — lists `STRIPE_SECRET_KEY` / `STRIPE_PUBLISHABLE_KEY` / `CONTESTS_PAYMENTS_ENABLED` as comments (no values).
- **`src/environment.ts`** — `stripePublishableKey: ''` until CI supplies `STRIPE_PUBLISHABLE_KEY` at build time.
- **`scripts/generate-env-prod.mjs`** — emits `stripePublishableKey` from `STRIPE_PUBLISHABLE_KEY` (optional; empty if unset).
- **`Dockerfile` (build stage)** — optional `ARG STRIPE_PUBLISHABLE_KEY` for the Angular bundle.
- **`cloudbuild.yaml`** — optional `_STRIPE_PUBLISHABLE_KEY` substitution passed as build-arg (defaults to empty).

## Cloud Run (runtime)

When you add server-side Stripe calls, set **`STRIPE_SECRET_KEY`** on the **staging** and **production** services separately (staging = test key, prod = live key). Do not bake secret keys into the Docker image; use **secrets** or **environment variables** configured in the Cloud Run console / Terraform.

## Sanity check

- Test secret keys start with `sk_test_`.
- Live secret keys start with `sk_live_`.
- If you see `sk_live_` in a staging log or `.env` for local dev, stop and rotate keys.
