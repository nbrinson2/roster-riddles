# Leaderboards — operational runbook (Story G2)

**Status:** Implemented  
**Depends on:** [leaderboards-indexes-pagination.md](leaderboards-indexes-pagination.md) (B3), [leaderboards-batch-e2.md](leaderboards-batch-e2.md) (E2), [leaderboards-api-d1.md](leaderboards-api-d1.md) (D1), [leaderboards-realtime-e1.md](leaderboards-realtime-e1.md) (E1)  
**Related QA:** [leaderboards-test-cohort-g1.md](leaderboards-test-cohort-g1.md) (G1)

## Purpose

Give **on-call** and **release owners** a single place for **leaderboard-specific** operations: composite index rollout, refreshing precomputed data, log triage, and **emergency disable** of public reads / UI without guessing env names or URLs.

General hosting, Cloud Run revisions, and Firebase project layout stay in [environment-matrix.md](environment-matrix.md).

---

## Quick reference

| Symptom | First checks |
|---------|----------------|
| **`GET /api/v1/leaderboards` 500** / Firestore “index” errors in logs | Composite indexes missing or **building** — [Index deploy](#1-firestore-composite-index-deploy-b3). |
| **Stale ranks** / old **“Data as of”** | Run [snapshot rebuild](#3-job-replay--manual-refresh-e2); confirm [Scheduler](#scheduler-health). |
| **429** on leaderboard GET | [Rate limits](leaderboards-rate-limits-f1.md); IP / proxy trust. |
| **Need to stop public leaderboard traffic** | Set **`LEADERBOARDS_DISABLED=true`** on the API service ([Kill switch](#5-emergency-disable-public-reads--ui)). |
| **Verify data for a known cohort** | [G1 checklist](leaderboards-test-cohort-g1.md) + `npm run verify:leaderboard-cohort`. |

---

## 1. Firestore composite index deploy (B3)

**Source of truth:** `firestore.indexes.json` (collection group **`stats`**, four boards — see [leaderboards-indexes-pagination.md](leaderboards-indexes-pagination.md)).

**When:** After merging index changes, new environment, or when logs show failed queries requiring an index (Firestore error text often includes a **console link** to create the index — prefer committing that definition to `firestore.indexes.json` and redeploying).

**Commands** (from repo root; use the Firebase project for the tier):

```bash
# Staging — default database (Spark-style)
firebase deploy --only firestore:indexes --project roster-riddles-staging

# Production — this repo’s firebase.json defines rules+indexes for both
# `(default)` and named DB `roster-riddles`; align with your change.
firebase deploy --only firestore:indexes --project roster-riddles-457600
```

**Rules + indexes together** (if you intentionally bundle): see [firestore-rules-deploy.md](../platform/firestore-rules-deploy.md) and `package.json` scripts `deploy:firestore:staging` / `deploy:firestore:prod`.

**Validation:** In **GCP Console → Firestore → Indexes**, wait until status is **Enabled** (not **Building**) before relying on collection-group leaderboard queries or the E2 batch job at scale.

---

## 2. Cache bust & “fresh enough” data

| Layer | What to do |
|-------|------------|
| **Angular static assets** | New **Cloud Build** / deployment revision; users may need a **hard refresh** if a CDN caches HTML. Not leaderboard-specific. |
| **Leaderboard JSON (`GET /api/v1/leaderboards`)** | Responses are **not** long-lived CDN cached by this app; freshness is bounded by **Firestore reads** and **precomputed snapshot** `generatedAt` ([D1](leaderboards-api-d1.md)). |
| **Precomputed snapshot docs (B2)** | “Refresh” = run [E2 rebuild](#3-job-replay--manual-refresh-e2). Prod UI in **Firestore snapshot mode** ([E1](leaderboards-realtime-e1.md)) updates when those docs update. |
| **HTTP poll mode** (dev / staging) | `leaderboardPollIntervalMs` in environment; **`0`** turns off polling ([environment.ts](../src/environment.ts)). |

---

## 3. Job replay & manual refresh (E2)

**What it does:** Rebuilds `leaderboards/snapshots/boards/{boardId}` for all v1 scopes (global + three modes). See [leaderboards-batch-e2.md](leaderboards-batch-e2.md).

### From an ops laptop (Admin credentials)

```bash
export GOOGLE_APPLICATION_CREDENTIALS=./secrets/<staging-or-prod>.json
export FIRESTORE_DATABASE_ID='(default)'   # or production DB id — must match the environment

npm run rebuild:leaderboard-snapshots
```

### HTTP (same as Cloud Scheduler)

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $LEADERBOARD_SNAPSHOT_CRON_SECRET" \
  "https://<api-host>/api/internal/v1/leaderboard-snapshots/rebuild"
```

**Secrets:** `LEADERBOARD_SNAPSHOT_CRON_SECRET` must match on **Cloud Run** (or host) and in the **Scheduler** (or `curl`) header. If unset on the server, the endpoint returns **503** (`not_configured`).

### Scheduler health

- **GCP Console → Cloud Scheduler:** open the rebuild job → **Force run** to replay on demand.
- Confirm **200** and JSON `ok: true` in execution history; on failure, use [Logging](#4-cloud-logging--triage) with `leaderboard_snapshot_job`.

---

## 4. Cloud Logging & triage

Use **Logs Explorer** (GCP) on the **Cloud Run** service (or wherever Express runs). Prefer **JSON** field filters on structured lines already emitted by this codebase.

**Suggested queries** (adjust resource type / project as needed):

```text
jsonPayload.component="leaderboards"
```

```text
jsonPayload.component="leaderboards"
jsonPayload.outcome="rate_limited"
```

```text
jsonPayload.component="leaderboard_snapshot_job"
jsonPayload.outcome="error"
```

```text
jsonPayload.component="leaderboards"
jsonPayload.outcome="service_disabled"
```

**Correlate with HTTP:** filter on `httpRequest.requestUrl` containing `leaderboards` or `leaderboard-snapshots`, or trace via **`requestId`** in JSON body / logs if your log sink maps it.

**Related:** [leaderboards-rate-limits-f1.md](leaderboards-rate-limits-f1.md) (429, `TRUST_PROXY_FOR_RATE_LIMIT`), [leaderboards-duplicate-accounts-f2.md](leaderboards-duplicate-accounts-f2.md) (verified-email filtering).

---

## 5. Emergency disable (public reads + UI)

### Public API kill switch

Set on the **Express** process (Cloud Run env / revision):

| Variable | Effect |
|----------|--------|
| **`LEADERBOARDS_DISABLED`** | When set to the literal string **`true`**, **`GET /api/v1/leaderboards`** returns **503** with `error.code: service_unavailable` and logs **`outcome: service_disabled`**. Internal **`POST /api/internal/v1/leaderboard-snapshots/rebuild`** is **not** blocked (so you can still refresh data while reads are off). |

Unset or any other value → normal behavior.

### Hide the leaderboard panel (Angular)

New builds read **`LEADERBOARDS_UI_ENABLED`** at **bundle generation** time (`scripts/generate-env-prod.mjs`):

| Build-time env | Effect |
|----------------|--------|
| **`LEADERBOARDS_UI_ENABLED=false`** | Toolbar **leaderboard** icon and sidenav **leaderboard** panel are not rendered (`environment.leaderboardsUiEnabled === false`). |
| Unset or not `false` | Panel shown as usual. |

| **`LEADERBOARD_CONTEST_TAB_ENABLED=false`** | Hides only the **Weekly contest** segment inside the leaderboard panel (`environment.leaderboardContestTabEnabled === false`). Does **not** hide the weekly contests drawer (`WEEKLY_CONTESTS_UI_ENABLED`). |
| Unset or not `false` | Weekly contest tab shown when `weeklyContestsUiEnabled` is also on. |

**Local dev:** `src/environment.ts` keeps the panel **on** unless you change it manually (no `.env` hook for Angular in the default dev flow).

**Operational note:** Disabling **API** does not stop clients already in **Firestore snapshot listener** mode ([E1](leaderboards-realtime-e1.md)) from receiving snapshot updates. For a full “silent” prod UI, set **both** `LEADERBOARDS_DISABLED=true` and ship a build with **`LEADERBOARDS_UI_ENABLED=false`**, or roll back to a revision that omits the panel.

---

## 6. Health and dependencies

| Check | Command / path |
|-------|------------------|
| **Process up** | `GET /health` on the API host — returns `{ "status": "ok" }` ([index.js](../index.js)). |
| **Cohort correctness (staging)** | [leaderboards-test-cohort-g1.md](leaderboards-test-cohort-g1.md) — `npm run verify:leaderboard-cohort`. |
| **Stats vs events** | `npm run verify:stats-reconciliation` (see [stats-reconciliation.md](../platform/stats-reconciliation.md)). |

---

## 7. Escalation checklist

1. Confirm **project** (staging vs prod) and **`FIRESTORE_DATABASE_ID`** match the incident environment.  
2. **Logs** — `leaderboards` / `leaderboard_snapshot_job` outcomes; Firestore error messages.  
3. **Indexes** — Enabled in console.  
4. **Rebuild** — `npm run rebuild:leaderboard-snapshots` or Scheduler force-run.  
5. **Kill switch** — only if limiting blast radius; document in the incident ticket.  
6. **Post-incident** — update composite indexes in git if anything was created ad hoc in console.

---

## References

- Jira: [leaderboards-phase3-jira.md](leaderboards-phase3-jira.md) — Story G2  
- ADR: [leaderboards-phase3-adr.md](leaderboards-phase3-adr.md)
