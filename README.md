# Roster Riddles

Angular + Express app for roster-based games, with Firebase (Auth, Firestore, Analytics) and MLB data.

## Prerequisites

- **Node.js 20** (matches `Dockerfile` and local development)
- **npm**

## Install

```bash
npm install
```

## Development

### Frontend only

```bash
npm run frontend
```

Serves the app at **http://localhost:4300** with live reload. `proxy.conf.json` forwards **`/api`** to **http://localhost:3000** when the Express server is running (same-origin MLB proxy and future API routes).

### Backend (Express)

```bash
npm run dev
```

Runs `nodemon index.js`. Default port **3000** (or `PORT`).

**`index.js`** registers API routes **before** static files, including:

- **`GET /api/v1/mlb/people/:id`** — server-side proxy to `statsapi.mlb.com`. In **production** builds, the Angular app uses this so the browser does not call MLB directly (only same-origin requests).

### Full stack

```bash
npm run dev:fullstack
```

Runs the Angular dev server and Express together (`concurrently`).

### Environment & Firebase

| Concern | Location |
|--------|----------|
| Local Firebase web config | `src/config/firebase.development.ts` (restrict API keys by HTTP referrer in Google Cloud) |
| Production build | `npm run build:prod` runs `scripts/generate-env-prod.mjs` → writes gitignored `src/environment.prod.ts`, then `ng build --configuration production` |
| HTTP `baseUrl` for the Angular app | `src/environment.ts` / generated `environment.prod.ts` — empty `baseUrl` in production means same-origin (`/api/v1/...`) |

The app uses the **named Firestore database** **`roster-riddles`** (`initializeFirestore(..., 'roster-riddles')`). Deploy **security rules** for that database in the Firebase console (not only the default database).

## Build

| Command | Purpose |
|--------|---------|
| `npm run build` | Development-style Angular build |
| `npm run build:prod` | Generate `environment.prod.ts` from env vars, then production Angular build |

`build:prod` **requires** (non-empty): `FIREBASE_API_KEY`, `FIREBASE_AUTH_DOMAIN`, `FIREBASE_PROJECT_ID`, `FIREBASE_STORAGE_BUCKET`, `FIREBASE_MESSAGING_SENDER_ID`, `FIREBASE_APP_ID`. Optional: `FIREBASE_MEASUREMENT_ID`, `API_BASE_URL` (default `''` for same-origin API).

## Production (Docker & Cloud Build)

- **`Dockerfile`**: install deps, `npm run build:prod` with Firebase build-args, serve `dist/roster-riddles/browser` with **`node index.js`** on port **3000** (or `PORT`). The container serves the Angular app **and** the Express MLB proxy route above.
- **`cloudbuild.yaml`**: Docker image for the web app; substitutions such as `_AR_HOSTNAME`, `_AR_PROJECT_ID`, `_AR_REPOSITORY`, `_SERVICE_NAME`, and `_FIREBASE_*` — mirror these on your Cloud Build trigger.

### Troubleshooting: `Missing required environment variables` during `npm run build:prod` in Docker

The production Angular bundle is built **inside the image**; `scripts/generate-env-prod.mjs` needs Firebase settings as **environment variables**. Those come from Docker **`--build-arg`**, which Cloud Build must pass from **substitution variables** on the trigger (e.g. `_FIREBASE_API_KEY`, `_FIREBASE_AUTH_DOMAIN`, … — see comments at the top of **`cloudbuild.yaml`**).

**How to tell you are on the wrong build path:** In the failed build log, **Step 0** shows only `docker build ... -f Dockerfile` (often with `--no-cache`) and **no** `--build-arg FIREBASE_...`. That is Cloud Run’s **autodetected Dockerfile** pipeline; it never reads **`cloudbuild.yaml`**, so Firebase args are always empty.

**Fix (switch the trigger to this repo’s `cloudbuild.yaml`):**

1. Open [Cloud Build → Triggers](https://console.cloud.google.com/cloud-build/triggers) and edit the **roster-riddles** trigger (or create one for branch `main`).
2. Under **Configuration**, choose **Cloud Build configuration file (yaml or json)** (not “Dockerfile” or “Autodetected”).
3. Set **Location** to the repository and path **`cloudbuild.yaml`** (repository root).
4. Under **Substitution variables**, add **user-defined** substitutions for **`_FIREBASE_API_KEY`**, **`_FIREBASE_AUTH_DOMAIN`**, **`_FIREBASE_PROJECT_ID`**, **`_FIREBASE_STORAGE_BUCKET`**, **`_FIREBASE_MESSAGING_SENDER_ID`**, **`_FIREBASE_APP_ID`** (and optionally **`_FIREBASE_MEASUREMENT_ID`**, **`_API_BASE_URL`**) using the same values as your Firebase web app. Adjust **`_AR_IMAGE_PATH`** only if your Artifact Registry image path differs from the default in **`cloudbuild.yaml`** (it matches Cloud Run **source deploy** paths like `.../roster-riddles/roster-riddles`).

The Cloud Build service account needs permission to push to Artifact Registry and to deploy Cloud Run (for example **Artifact Registry Writer** and **Cloud Run Admin** on the project, or a custom role that includes those capabilities).

## Firestore cache documents (`cache/`)

The app reads public data from documents under **`cache/`** on database **`roster-riddles`**. Allow **`read`** for these in security rules (client writes should stay **`false`**; updates come from Cloud Functions / Admin SDK).

| Document(s) | Source | Contents |
|---------------|--------|----------|
| `mlb_players_snapshot` | Cloud Function `update_mlb_players_snapshot` | Bio Ball–style player rows |
| `career_path_players_snapshot_meta` + `career_path_shard_0`, … | Cloud Function `update_career_path_players_snapshot` | Career-path data (**sharded**; ~1 MiB doc limit). Meta includes `shardDocPrefix`, `shardCount`. Legacy `career_path_players_snapshot` is removed after a successful sharded write. |
| `mlb_nicknames` | One-time or manual upload | Nickname Streak: `{ entries: [{ name, nicknames[] }], count, generatedAt, … }`. Source JSON: `src/assets/mlb-nicknames.json`. |

If **`mlb_nicknames`** is missing, the Nickname Streak resolver returns an empty list until the document exists.

## Google Cloud Scheduler (MLB 40-man snapshot)

| | |
|---|---|
| **Job** (example) | `mlb-players-hourly-update` |
| **Region** | `us-central1` |
| **Schedule** | `0 * * * *` (UTC) |
| **Target** | HTTP to Cloud Function **`update_mlb_players_snapshot`** |

Manage jobs in [Cloud Scheduler](https://console.cloud.google.com/cloudscheduler).

## Cloud Functions (Python, `daily-job/`)

Gen **2** functions are deployed with **`gcloud functions deploy`** (not Cloud Run “Connect to repo”). Source: **`daily-job/`** (`main.py`, `requirements.txt`).

| Artifact | Purpose |
|----------|---------|
| `cloudbuild.functions.yaml` | Build/deploy **40-man** snapshot function |
| `cloudbuild.career-path.yaml` | **Career-path** snapshot (long timeout / memory; many MLB API calls) |

Typical trigger: push to **`main`**, path filter **`daily-job/**`**, IAM on the Cloud Build service account for Cloud Functions + Firestore.

Each function **`cloudbuild`** runs **`gcloud functions deploy`** only. **`_FUNCTION_NAME` must match the function id from **`gcloud functions list`** (hyphens vs underscores are different resources; the MLB snapshot function id is **`update_mlb_players_snapshot`**).

### Troubleshooting: `409` — Cloud Run service already exists (functions deploy)

Gen **2** functions are backed by a **Cloud Run** service with the same name. If **`gcloud functions deploy`** returns **`Could not create Cloud Run service ... already exists`**, a **standalone Cloud Run** service may be using the name without going through Cloud Functions, or Functions/Run state may be out of sync.

**Resolve (pick one):**

1. In [Cloud Run](https://console.cloud.google.com/run), open the function’s region, find the conflicting service, and delete it if it is not the live Gen2 backing service you need, then rerun the build.
2. Or change **`_FUNCTION_NAME`** / the deploy name in **`cloudbuild.functions.yaml`** (or **`cloudbuild.career-path.yaml`**), redeploy, and point **Cloud Scheduler** at the new URL.

## Tests

```bash
npm test
```

Karma + Jasmine.

## Other

- **`scripts/generate-env-prod.mjs`** — production `environment.prod.ts` for Docker/CI.
- **`src/assets/mlb-nicknames.json`** — canonical nickname list used when seeding **`cache/mlb_nicknames`** in Firestore.

## Angular CLI

Angular **19** (see `package.json`).

```bash
npx ng help
```

Reference: [Angular CLI](https://angular.dev/tools/cli).
