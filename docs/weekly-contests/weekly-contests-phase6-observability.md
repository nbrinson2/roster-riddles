# Phase 6 prize payouts — observability (Story P6-H2)

Structured JSON logs for **prize payout execute** (`POST …/payouts/execute` + shared job), **Stripe `transfer.*` / `payout.*` webhook handlers** for contests, and **admin hold / resume / retry** actions. Same correlation style as [Phase 5 payments observability](weekly-contests-phase5-observability.md): **`requestId`** on HTTP-handled paths; Stripe **`eventId`** / **`eventType`** on webhooks.

**Secrets:** Do not log signing secrets, API keys, full webhook bodies, or bank identifiers beyond what Stripe already exposes in safe metadata.

---

## Shared fields

| Field | Description |
|--------|-------------|
| `domain` | Always **`contest_payouts`** — filter Phase 6 payout logs separately from Phase 5 `contest_payments`. |
| `timestamp` | ISO-8601 UTC. |
| `severity` | `INFO`, `WARNING`, or `ERROR` (derived from explicit `severity`, `httpStatus`, or handler convention). |
| `outcome` | Semantic result code (see each component below). |

---

## Payout execute — `component: payout_job`

**Implementation:** [`server/payments/contest-payouts-observability.js`](../../server/payments/contest-payouts-observability.js) (`logPayoutJobLine`), [`server/contests/contest-payout-execute.job.js`](../../server/contests/contest-payout-execute.job.js), [`server/contests/contest-payout-execute.http.js`](../../server/contests/contest-payout-execute.http.js).

| Field | Description |
|--------|-------------|
| `requestId` | Request correlation (internal execute route or propagated id). |
| `contestId` | When resolved. |
| `httpStatus` | Intended HTTP status for the operator response when applicable. |
| `latencyMs` | Wall time for the job or gate when recorded. |
| `aggregateStatus` | Roll-up from `payouts/final` lines when committed or when reporting prior state. |
| `payoutJobId` | Idempotency / audit id for the execute run. |
| `uid` / `rank` | Per-line logs during transfer attempts. |
| `message` | Sanitized error text for failures only. |

---

## Stripe prize lifecycle webhooks — `component: stripe_webhook_payout`

**Implementation:** [`server/payments/stripe-webhook-payouts.js`](../../server/payments/stripe-webhook-payouts.js), top-level catch in [`server/payments/stripe-webhook.http.js`](../../server/payments/stripe-webhook.http.js) for `transfer.*` / `payout.*` when contest payments are enabled.

| Field | Description |
|--------|-------------|
| `requestId` | Webhook POST correlation. |
| `eventId` | Stripe `evt_…`. |
| `eventType` | Stripe `type` string. |
| `contestId` / `uid` | When prize transfer metadata resolves a contest row. |
| `transferId` / `payoutId` | Stripe object ids when logged. |

These lines use **`domain: contest_payouts`** and **`component: stripe_webhook_payout`**, distinct from Phase 5 **`component: stripe_webhook`** ([weekly-contests-phase5-observability.md](weekly-contests-phase5-observability.md)).

---

## Admin payout actions — `component: payout_admin_action`

**Implementation:** [`server/contests/contest-payout-admin-actions.job.js`](../../server/contests/contest-payout-admin-actions.job.js) (`logPayoutAdminActionLine`).

| Field | Description |
|--------|-------------|
| `requestId` | When supplied by the caller. |
| `contestId` | Target contest. |
| `action` / similar | Semantic fields as emitted by the job (hold, resume, retry). |

---

## Optional metric counters

Set **`CONTESTS_PAYOUT_METRIC_COUNTERS=1`** (see [stripe.md](../payments/stripe.md)) to emit an extra JSON line for selected **job** and **webhook** failures:

| Field | Description |
|--------|-------------|
| `component` | **`contest_payout_metrics`** |
| `metricType` | `counter` |
| `metricName` | `contest_payout_job_failure_total` or `contest_payout_webhook_failure_total` |
| `domain` | `contest_payouts` |
| `outcome` | Same code as the primary log line. |

**Job counter** increments on server-side hard failures (for example `httpStatus >= 500`, `422` validation/build failures, `transfer_failed` line outcomes, and similar). **Webhook counter** increments on **`severity: ERROR`** payout webhook lines.

---

## Log-based alert examples (GCP Logging / Monitoring style)

These are **documentation templates** — adapt field names and label extraction to your log router (Cloud Logging queries, Log-based metrics, or Datadog monitors).

### 1. P95 latency for payout execute (successful commits)

Filter successful job completions, then alert if p95 **`latencyMs`** exceeds a threshold (example: 60s) over a 15m window.

```text
jsonPayload.domain="contest_payouts"
jsonPayload.component="payout_job"
jsonPayload.outcome="payout_execute_committed"
```

Create a **log-based metric** (or equivalent) on `latencyMs` with `percentile=95` and a threshold alert.

### 2. Error rate on payout job

**Option A — severity:** fraction of lines with `severity="ERROR"` among `component="payout_job"` in a sliding window.

```text
jsonPayload.domain="contest_payouts"
jsonPayload.component="payout_job"
```

**Option B — outcomes:** alert on spikes of specific outcomes, for example `transfer_failed`, `firestore_batch_failed_after_transfers`, `firestore_read_failed`, using `jsonPayload.outcome`.

### 3. Stripe payout webhook handler failures

```text
jsonPayload.domain="contest_payouts"
jsonPayload.component="stripe_webhook_payout"
jsonPayload.severity="ERROR"
```

Or route **`metricName="contest_payout_webhook_failure_total"`** when metric counters are enabled.

### 4. Stuck `prizePayoutStatus: in_progress`

The field **`in_progress`** is defined in the ADR as “at least one outbound transfer attempt in flight”; **v1 code** may rarely emit it as a long-lived document state. For “stuck payout” operations alerts, prefer a **composite** signal:

1. **Logs:** sustained **`payout_job`** errors or **`stripe_webhook_payout`** errors for the same `contestId` / `eventId` correlation.
2. **Firestore (recommended for stuck detection):** a scheduled query or admin report: contests with **`prizePayoutStatus == "in_progress"`** (or **`scheduled"`** with automation on) and **`updatedAt`** older than *N* hours, or **`paid`** with missing **`payouts/final`** after scoring. Wire this to your incident channel separately from stdout logs.

Document the chosen *N* with product/ops when automation goes live.

---

## See also

- [weekly-contests-phase5-observability.md](weekly-contests-phase5-observability.md) — entry fee checkout + Phase 5 webhooks  
- [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) — P6-E2 prize webhook section  
- [stripe.md](../payments/stripe.md) — environment variables  
- [weekly-contests-phase6-payouts-jira.md](weekly-contests-phase6-payouts-jira.md) — Story **P6-H2**
