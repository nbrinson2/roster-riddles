# Story GL-C3 — Stripe publishable key in the production Angular bundle (`STRIPE_PUBLISHABLE_KEY`)

**Story:** **GL-C3** in [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md) (Epic **GL-C** — Production Angular bundle configuration).

**Purpose:** Bake **`pk_live_…`** into **`environment.stripePublishableKey`** for **production** builds via **`STRIPE_PUBLISHABLE_KEY`** at **`generate-env-prod.mjs`** time — so any **client-side** Stripe.js / Payment Element / embedded surfaces use the **live** publishable key while **secret** keys (`sk_*`) stay server-only.

## Security

| Safe in Angular bundle | Never in the browser bundle |
|-------------------------|-----------------------------|
| **`pk_live_…`** / **`pk_test_…`** (publishable keys) | **`sk_live_…`**, **`sk_test_…`**, webhook secrets, restricted keys misused as client config |

**`generate-env-prod.mjs`** emits **`stripePublishableKey`** from **`STRIPE_PUBLISHABLE_KEY`** only — it does **not** read **`STRIPE_SECRET_KEY`**.

## Product note (Checkout redirect today)

Hosted **Stripe Checkout** session creation is **server-side**; the current app does **not** require **`stripePublishableKey`** for that redirect flow ([weekly-contests-api-phase5.md](weekly-contests-api-phase5.md)). You still set **`pk_live_…`** at production cutover so **future** client Stripe usage (Elements, Connect.js, etc.) matches **live** mode and does not surprise-load **test** keys.

## Wiring (repo)

| Layer | Behavior |
|-------|----------|
| **`scripts/generate-env-prod.mjs`** | **`stripePublishableKey`** ← **`process.env.STRIPE_PUBLISHABLE_KEY`** (optional string; empty if unset). |
| **`Dockerfile`** (builder) | **`ARG STRIPE_PUBLISHABLE_KEY`** passed through **`ENV`** before **`generate-env-prod.mjs`**. |
| **`cloudbuild.yaml`** | **`--build-arg STRIPE_PUBLISHABLE_KEY=$_STRIPE_PUBLISHABLE_KEY`**; default **`_STRIPE_PUBLISHABLE_KEY: ''`** — production trigger must **set** **`_STRIPE_PUBLISHABLE_KEY`** to **`pk_live_…`** when going live with client Stripe. |
| **Staging trigger** | Use **`pk_test_…`** from the Stripe **test** Dashboard for that environment. |

## Verification (acceptance)

1. **Substitutions:** Production Cloud Build trigger defines **`_STRIPE_PUBLISHABLE_KEY`** with **`pk_live_`** prefix (paste redacted id in ticket — e.g. first/last chars only).
2. **Artifact:** Search built **`dist/`** output or sourcemap for **`pk_live_`** **or** confirm **`generate-env-prod`** log / generated **`environment.prod.ts`** in CI shows non-empty **`stripePublishableKey`** (avoid committing secrets to docs — ticket evidence only).
3. **Smoke:** Load the app (e.g. Bio Ball), open weekly contests UI — **no** Stripe-related console errors **when** client code initializes Stripe.js against **`environment.stripePublishableKey`**. If no client Stripe code runs yet, verification is substitution + artifact check only.

## References

- [`scripts/generate-env-prod.mjs`](../../scripts/generate-env-prod.mjs)
- [`cloudbuild.yaml`](../../cloudbuild.yaml)
- [`Dockerfile`](../../Dockerfile)
- [`docs/payments/stripe.md`](../payments/stripe.md)
- [`README.md`](../../README.md) — Cloud Build substitution variables
