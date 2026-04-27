# Weekly contests Phase 6 — payouts operations (Story P6-D3)

**Status:** Implemented  
**Depends on:** [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md) (P6-D2 execute hook), [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md)

**Purpose:** One runbook for **forcing** a payout run, **disabling** automated Scheduler triggers, **Cloud Scheduler** setup (no Terraform in-repo — use GCP Console or `gcloud`), and **retry / idempotency** expectations.

---

## Quick reference

| Goal | What to do |
|------|------------|
| **Run payout once (manual)** | Operator `curl` to internal execute (below) **without** `trigger`, or Admin API with Firebase admin user. |
| **Turn off Scheduler-only automation** | Unset or set anything other than `true` for **`PAYOUTS_AUTOMATION_ENABLED`** on the API service. Operator `curl` and Admin **`payout-execute`** still work. |
| **Scheduler returns 403 `payouts_automation_disabled`** | Set **`PAYOUTS_AUTOMATION_ENABLED=true`** when you intend Scheduler to call with **`trigger: scheduler`**. |
| **Double-submit / retry safety** | Same contest + Stripe idempotency keys → safe replays; **`payouts/final`** with **`aggregateStatus: succeeded`** → **200** idempotent no-op. See [weekly-contests-schema-contest-payouts-final.md](weekly-contests-schema-contest-payouts-final.md). |
| **5xx after some transfers** | Logs may show `firestore_batch_failed_after_transfers` — **reconcile** Stripe vs Firestore before retrying. Scheduler retry can repeat; Stripe idempotency reduces duplicate transfers for the same line. |
| **409 `insufficient_platform_balance`** | Enable **`CONTEST_PAYOUT_BALANCE_GUARD_ENABLED=true`** (P6-E1); platform **USD `available`** from **`balance.retrieve()`** is below planned transfer total. Fund the platform balance or fix eligibility, then retry. Logs aggregate cents only. |
| **Firestore / Stripe sizing** | [Load and cost (P6-I2)](weekly-contests-ops-p6-payout-execute.md#load-and-cost-story-p6-i2) — reads **4+2N**, batch writes **2+S**, sequential **`transfers.create`**. |

---

## 1. Feature flag — `PAYOUTS_AUTOMATION_ENABLED`

| Env | Meaning |
|-----|---------|
| Unset / empty / not exactly `true` | **Default:** internal hook rejects **`"trigger":"scheduler"`** with **403** `payouts_automation_disabled`. Manual operator and Admin paths are unaffected. |
| `PAYOUTS_AUTOMATION_ENABLED=true` | Cloud Scheduler (or any caller with the operator secret) may POST with **`"trigger":"scheduler"`** and the same body rules as manual execute. |

**First production cut:** leave automation **off** until payouts are validated; use manual operator or Admin only.

---

## 2. Manual force-run

### 2a. Internal HTTP (operator secret)

Same contract as [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md). Omit **`trigger`** or set **`"trigger":"operator"`** (default).

```bash
curl -sS -X POST \
  -H "Authorization: Bearer $PAYOUT_OPERATOR_SECRET" \
  -H "Content-Type: application/json" \
  -d '{}' \
  "https://<api-host>/api/internal/v1/contests/<contestId>/payouts/execute"
```

Optional body: `{ "payoutJobId": "opaque_trace_id" }`.

### 2b. Admin UI / service account (no operator secret)

**`POST /api/v1/admin/contests/:contestId/payout-execute`** — Firebase ID token with **`admin: true`** (same security model as [postAdminContestRunScoring](../../server/admin/admin-contests.http.js)). Optional JSON body: `{ "payoutJobId": "…" }`.

Use this from a trusted admin dashboard or ops tooling that already holds an admin session.

---

## 3. Cloud Scheduler (per contest)

Prize execute is **per `contestId`** (unlike leaderboard rebuild). Typical pattern: **one job per contest** you intend to pay on a schedule, or a thin wrapper service that iterates contests and POSTs here.

**Auth:** `Authorization: Bearer <PAYOUT_OPERATOR_SECRET or CONTESTS_OPERATOR_SECRET>` (same as internal execute).

**Body:** Must include **`"trigger":"scheduler"`** so automation is explicitly gated by **`PAYOUTS_AUTOMATION_ENABLED`**.

```json
{ "trigger": "scheduler" }
```

### Example: `gcloud` (replace placeholders)

```bash
export PROJECT_ID=your-gcp-project
export REGION=us-central1
export SERVICE_URL="https://YOUR-SERVICE-XXXX-uc.a.run.app"
export CONTEST_ID=bb-your-contest-id
export JOB_NAME="contest-payout-${CONTEST_ID}"
export CRON="0 12 * * *"   # e.g. daily noon UTC — tune per product

gcloud scheduler jobs create http "$JOB_NAME" \
  --project="$PROJECT_ID" \
  --location="$REGION" \
  --schedule="$CRON" \
  --uri="${SERVICE_URL}/api/internal/v1/contests/${CONTEST_ID}/payouts/execute" \
  --http-method=POST \
  --headers="Content-Type=application/json,Authorization=Bearer YOUR_SECRET_FROM_SECRET_MANAGER" \
  --message-body='{"trigger":"scheduler"}' \
  --attempt-deadline=540s
```

**Notes:**

- Store the **Bearer** secret in [Secret Manager](https://cloud.google.com/secret-manager) and reference it from Scheduler / Cloud Run — do **not** commit secrets.
- Enable **retry** with backoff on **5xx** in Cloud Scheduler or Monitoring alerts. **403** `payouts_automation_disabled` is **not** a good candidate for blind retry (fix env or body first).
- **429 / 409** from business rules: tune schedule or fix contest state before retrying.

**Infrastructure as code:** This repo does not ship `.tf` modules; mirror the above in your Terraform `google_cloud_scheduler_job` resource (HTTP target, headers, body).

---

## 4. Logging

Filter **`jsonPayload.domain="contest_payouts"`** and **`jsonPayload.component="payout_job"`** in Cloud Logging (see [weekly-contests-phase6-observability.md](weekly-contests-phase6-observability.md)). Admin-triggered runs also emit **`route":"admin_payout_execute"`** on contest read lines where applicable.

---

## 5. Related docs

- [leaderboards-runbook.md](../leaderboards/leaderboards-runbook.md) — style reference for kill switches and Scheduler health.  
- [weekly-contests-phase6-payouts-jira.md](weekly-contests-phase6-payouts-jira.md) — Story **P6-D3**.  
- [weekly-contests-phase6-staging-qa.md](weekly-contests-phase6-staging-qa.md) — Story **P6-I1** (staging Connect + transfer checklist).  
- [admin-dashboard-security.md](../admin/admin-dashboard-security.md) — admin claim requirements.
