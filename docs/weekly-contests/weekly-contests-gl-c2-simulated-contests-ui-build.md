# Story GL-C2 — Simulated contests UI default for production (`SIMULATED_CONTESTS_UI_ENABLED`)

**Story:** **GL-C2** in [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md) (Epic **GL-C** — Production Angular bundle configuration).

**Purpose:** Keep **production** contest strip and card copy **live-oriented** (no dashed “simulated” treatment, no “(simulated)” fee phrasing, etc.) unless operators **explicitly** opt in to dry-run / simulated labeling — controlled only at **Angular build** time via **`SIMULATED_CONTESTS_UI_ENABLED`**.

## Behavior (`scripts/generate-env-prod.mjs`)

| Deployment output | `simulatedContestsUiEnabled` when |
|-------------------|-------------------------------------|
| **Production** (`DEPLOYMENT` not `staging`) | **`true`** only if **`SIMULATED_CONTESTS_UI_ENABLED===`'true'`** (string). **Unset, empty, or any other value → `false`.** |
| **Staging** (`DEPLOYMENT=staging`) | **`true`** unless **`SIMULATED_CONTESTS_UI_ENABLED===`'false'`** (default simulated UX for QA). |

Production therefore uses the dashed / simulated strip **only** when the build explicitly sets the env var to **`true`** (e.g. a special branded dry-run environment).

## Wiring (repo default)

| Layer | Behavior |
|-------|----------|
| **`cloudbuild.yaml`** | Optional substitution **`_SIMULATED_CONTESTS_UI_ENABLED`** (default **empty**) → Docker **`SIMULATED_CONTESTS_UI_ENABLED`**. Empty means **do not** set simulated mode on production builds. |
| **`Dockerfile`** (builder) | **`ARG SIMULATED_CONTESTS_UI_ENABLED`** (default empty) exported to **`ENV`** before **`generate-env-prod.mjs`**. Omitted in local Docker builds → production branch still yields **`simulatedContestsUiEnabled: false`**. |
| **Cloud Run** | Not applicable — this flag affects **only** the SPA bundle, not Express. |

**Staging stays configurable:** Use **`_DEPLOYMENT=staging`** on a staging trigger; override **`_SIMULATED_CONTESTS_UI_ENABLED=false`** if you need live-oriented copy on staging without changing production defaults.

## Verification (acceptance)

1. **Production trigger:** Leave **`_SIMULATED_CONTESTS_UI_ENABLED`** **unset** or **empty** (repo default) — or explicitly **`false`**. Confirm built output has **`simulatedContestsUiEnabled`** falsy (search **`dist/`** `main-*.js` / sourcemap, or inspect generated **`environment.prod.ts`** in the build).
2. **Explicit opt-in (optional):** Set **`_SIMULATED_CONTESTS_UI_ENABLED=true`** only on a dedicated trigger / dry-run environment; confirm dashed simulated UX appears.

## References

- [`scripts/generate-env-prod.mjs`](../../scripts/generate-env-prod.mjs)
- [`cloudbuild.yaml`](../../cloudbuild.yaml)
- [`Dockerfile`](../../Dockerfile) (builder stage)
- [`.env.example`](../../.env.example) — commented **`SIMULATED_CONTESTS_UI_ENABLED`**
