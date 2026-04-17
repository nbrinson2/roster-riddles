# Leaderboards — batch / scheduled refresh (Story E2)

**Status:** Implemented  
**Depends on:** [leaderboards-schema-precomputed.md](leaderboards-schema-precomputed.md) (B2), [leaderboards-trusted-writer-c1.md](leaderboards-trusted-writer-c1.md) (C1), [leaderboards-api-d1.md](leaderboards-api-d1.md) (D1)

## What runs

A **trusted batch job** rebuilds all four v1 boards under **`leaderboards/snapshots/boards/{boardId}`** by:

1. Querying the same **collection-group `stats`** ordering as `GET /api/v1/leaderboards` (top **K** rows per board, **K ≤ 500**).
2. Resolving **display names** via Firebase Auth (Admin SDK).
3. **`set()`**-replacing each snapshot document with **`generatedAt`** = server timestamp, **`schemaVersion`**, **`tieBreakPolicy`**, optional **`aggregateSchemaVersion`** / **`sourceRowCount`**.

Implementation: [`server/leaderboard-snapshot-job.js`](../server/leaderboard-snapshot-job.js).

## HTTP hook (Cloud Scheduler / cron)

| | |
|---|---|
| **Method / path** | `POST /api/internal/v1/leaderboard-snapshots/rebuild` |
| **Auth** | Shared secret: header **`Authorization: Bearer <secret>`** or **`X-Cron-Secret: <secret>`** |
| **Env** | **`LEADERBOARD_SNAPSHOT_CRON_SECRET`** — required; if unset, endpoint returns **503** |

**Response (200):** `{ "ok": true, "durationMs": number, "boards": [ { "scope", "entryCount", "scannedStatsDocs" }, … ] }`

**Logs:** JSON lines to stdout with **`component: leaderboard_snapshot_job`**, **`outcome`** (`ok` \| `error` \| `unauthorized` \| `not_configured`), **`latencyMs`**, **`requestId`** — aligned with Story 9 structured logging.

## Local / CI rebuild (no HTTP)

```bash
npm run rebuild:leaderboard-snapshots
```

Uses the same Admin credentials as Express (`FIREBASE_SERVICE_ACCOUNT_JSON` or `GOOGLE_APPLICATION_CREDENTIALS`).

## “Data as of” in API and UI

- **`GET /api/v1/leaderboards`** includes **`snapshotGeneratedAt`** (ISO 8601 or `null`) read from the precomputed doc’s **`generatedAt`** for the requested **`scope`** (one extra document read per request).
- The Angular leaderboard panel shows **“Data as of …”** when that field is present (HTTP mode) or when using Firestore snapshot mode (E1).

## Google Cloud Scheduler (staging / prod)

Use an **HTTP** target that `POST`s to your **Cloud Run** (or other) URL where Express is served, with **OIDC** or **plain secret** per your security model.

### Example: `gcloud` (replace placeholders)

```bash
export PROJECT_ID=your-project
export REGION=us-central1
export SERVICE_URL="https://YOUR-SERVICE-XXXX-uc.a.run.app"
export JOB_NAME=leaderboard-snapshot-rebuild
export CRON="0 * * * *"   # hourly; tune for product

gcloud scheduler jobs create http "$JOB_NAME" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="$CRON" \
  --uri="${SERVICE_URL}/api/internal/v1/leaderboard-snapshots/rebuild" \
  --http-method=POST \
  --headers="Authorization=Bearer YOUR_SECRET_FROM_SECRET_MANAGER" \
  --attempt-deadline=540s
```

Store **`YOUR_SECRET_FROM_SECRET_MANAGER`** in [Secret Manager](https://cloud.google.com/secret-manager) and inject the header via a **second** job revision or Cloud Run env — do **not** commit secrets. For staging, a manually created strong random string in Scheduler UI is acceptable if rotated.

### Console (screenshot substitute)

1. **GCP Console** → **Cloud Scheduler** → **Create job**.
2. **Frequency:** e.g. hourly cron `0 * * * *`.
3. **Target type:** HTTP.
4. **URL:** `https://<your-api-host>/api/internal/v1/leaderboard-snapshots/rebuild`.
5. **HTTP method:** POST.
6. **Auth header:** Add **`Authorization: Bearer <LEADERBOARD_SNAPSHOT_CRON_SECRET>`** (same value as configured on the server).

## Failure alerting

- **Scheduler:** enable **retry** and **email / PagerDuty** on job failure in Cloud Scheduler or Cloud Monitoring.
- **Application logs:** filter **`component":"leaderboard_snapshot_job"`** and **`outcome":"error"`** in Cloud Logging; alert on error rate.

## References

- [leaderboards-phase3-jira.md](leaderboards-phase3-jira.md) — Story E2
- [leaderboards-realtime-e1.md](leaderboards-realtime-e1.md) — optional listener vs poll
