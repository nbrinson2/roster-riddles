# Environment matrix (dev / staging / prod)

Separate **Firebase projects** (or at minimum separate web apps + Admin credentials) per tier so production data and keys stay isolated.

| Tier | Angular source | Firebase web config | Admin SDK (Express / jobs) | Notes |
|------|----------------|---------------------|-----------------------------|--------|
| **Development** | `src/environment.ts` → `config/firebase.staging.ts` | **Staging** project (`roster-riddles-staging`), `(default)` Firestore | Local Express: service account for **staging** (`GOOGLE_APPLICATION_CREDENTIALS` / `FIREBASE_SERVICE_ACCOUNT_JSON`) so `/api/v1/me` and Admin match the same project | `ng serve` hits staging data; avoid pointing local Admin at prod. |
| **Staging** | Generated `src/environment.staging.ts` (`DEPLOYMENT=staging` + `npm run build:staging`); checked-in reference: `src/config/firebase.staging.ts` | **Staging** Firebase project (`roster-riddles-staging`) | Staging service account or Cloud Run SA with access to **staging** project only | Same `FIREBASE_*` env names as prod; **different values** in the staging CI trigger / Secret Manager. **Firestore:** uses the **`(default)`** database (Spark-friendly); see `firestoreDatabaseId` in generated env + `getConfiguredFirestore()`. |
| **Production** | Generated `src/environment.prod.ts` (`npm run build:prod` or Docker default `DEPLOYMENT=production`) | **Production** Firebase project | Prod service account; Cloud Run workload identity or `FIREBASE_SERVICE_ACCOUNT_JSON` from secrets | Cloud Build passes `_FIREBASE_*` substitutions; never log or commit keys. |

## CI/CD

- **Cloud Build / Docker**: `--build-arg` passes `FIREBASE_*`, `API_BASE_URL`, and `DEPLOYMENT` (`production` | `staging`). See `Dockerfile` and `cloudbuild.yaml`.
- **Secrets**: Prefer **Secret Manager** or trigger **substitutions**, not literals in `cloudbuild.yaml` for real projects.

## Express

- Loads Admin credentials only from **`FIREBASE_SERVICE_ACCOUNT_JSON`** or **default credentials** / **`GOOGLE_APPLICATION_CREDENTIALS`** (`server/firebase-admin-init.js`). No keys in source control.
- **Local dev:** copy `.env.example` → `.env` and set `GOOGLE_APPLICATION_CREDENTIALS` to a **staging** service account JSON path under `secrets/` (see `.env.example`). `index.js` loads `.env` via **`dotenv`**.
- **Copy prod cache → staging:** see [firestore-mirror.md](./firestore-mirror.md) and `npm run mirror:firestore-cache`.

## Angular

- **Dev** uses checked-in `firebase.staging.ts` (same staging project as CI staging builds; client-safe web config only).
- **Staging / prod** bundles must **not** embed production config in git: run `scripts/generate-env-prod.mjs` before `ng build`, which writes gitignored `environment.prod.ts` or `environment.staging.ts`.
