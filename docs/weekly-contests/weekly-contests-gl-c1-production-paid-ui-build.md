# Story GL-C1 — Paid contest UI in production Angular builds (`CONTESTS_PAYMENTS_ENABLED`)

**Story:** **GL-C1** in [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md) (Epic **GL-C** — Production Angular bundle configuration).

**Purpose:** Ensure **production** SPA bundles set **`environment.contestsPaymentsEnabled`** to **`true`** when operators enable paid entry — by passing **`CONTESTS_PAYMENTS_ENABLED=true`** into **`scripts/generate-env-prod.mjs`** at **Docker build** time (same variable name as the Express feature gate).

## Wiring (repo default)

| Layer | Behavior |
|-------|----------|
| **`scripts/generate-env-prod.mjs`** | Sets **`contestsPaymentsEnabled`** to **`true`** only when **`process.env.CONTESTS_PAYMENTS_ENABLED === 'true'`** (applies to both production and staging output files). |
| **`Dockerfile`** (builder) | **`ARG CONTESTS_PAYMENTS_ENABLED`** defaults to **`false`** (safe for local image builds that omit the flag). **`ENV`** exports it before **`node scripts/generate-env-prod.mjs`**. |
| **`cloudbuild.yaml`** | Passes **`--build-arg CONTESTS_PAYMENTS_ENABLED=$_CONTESTS_PAYMENTS_ENABLED`** and sets **`_CONTESTS_PAYMENTS_ENABLED: 'true'`** by default — so **production triggers** using this file bake **`contestsPaymentsEnabled: true`** unless the substitution is overridden to **`false`**. |
| **Cloud Run deploy** | **`--update-env-vars=CONTESTS_PAYMENTS_ENABLED=$_CONTESTS_PAYMENTS_ENABLED`** keeps **runtime** API behavior aligned with the same substitution (see Story **GL-D1** in [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md)). |

**Staging stays configurable:** Use a **separate trigger** with **`_DEPLOYMENT=staging`** (and staging Firebase substitutions). Set **`_CONTESTS_PAYMENTS_ENABLED`** per environment — e.g. **`true`** on shared staging for Phase 5 QA, **`false`** to hide paid UX without changing API routing strategy.

## Coordination with GL-D1

Avoid **`contestsPaymentsEnabled: true`** in the client while **`CONTESTS_PAYMENTS_ENABLED`** is off on the server — users would see paid-entry UI but **`POST …/checkout-session`** returns **503** (`contest_payments_disabled`). Roll out **GL-C1** and **GL-D1** together per [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md).

## Verification (acceptance)

1. **Cloud Build:** Confirm the **production** trigger leaves **`_CONTESTS_PAYMENTS_ENABLED`** at **`true`** (or sets it explicitly) — **Substitution variables** in Google Cloud Console.
2. **Artifact:** After build, confirm the Angular output contains paid UI flag on — e.g. search **`dist/`** `main-*.js` (and optional sourcemap) for **`contestsPaymentsEnabled`** with a **truthy** value, **or** inspect CI logs / a saved copy of generated **`src/environment.prod.ts`** from the build step.

## References

- [`scripts/generate-env-prod.mjs`](../../scripts/generate-env-prod.mjs)
- [`cloudbuild.yaml`](../../cloudbuild.yaml)
- [`Dockerfile`](../../Dockerfile) (builder stage)
- [`docs/payments/stripe.md`](../payments/stripe.md)
- [`docs/weekly-contests/weekly-contests-api-phase5.md`](weekly-contests-api-phase5.md) — client **`contestsPaymentsEnabled`**
