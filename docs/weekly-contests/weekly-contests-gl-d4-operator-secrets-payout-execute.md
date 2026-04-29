# Story GL-D4 — Operator secrets for payout execute / automation

**Story:** **GL-D4** in [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md) (Epic **GL-D** — Production server runtime).

**Purpose:** Provision **`PAYOUT_OPERATOR_SECRET`** and/or **`CONTESTS_OPERATOR_SECRET`** on **production** Cloud Run so internal routes can authorize **prize payout execute** and **payout automation** without exposing credentials in the repo or the Angular app.

## Which secret wins (`getPayoutExecuteSecret`)

Resolved in [`server/lib/contest-internal-auth.js`](../../server/lib/contest-internal-auth.js):

1. **`PAYOUT_OPERATOR_SECRET`** — preferred dedicated secret for payout execute + automation.
2. Else **`CONTESTS_OPERATOR_SECRET`** — shared with other internal hooks (transitions, cron, etc.).

Values may be **inline** env strings or **paths** to one-line UTF-8 files (same pattern as **`STRIPE_SECRET_KEY`**).

## Routes (auth summary)

| Method | Path | Auth headers |
|--------|------|----------------|
| **POST** | `/api/internal/v1/contests/:contestId/payouts/execute` | **`Authorization: Bearer <secret>`** or **`x-payout-operator-secret`** / **`x-contests-operator-secret`** (see [`contest-payout-execute.http.js`](../../server/contests/contest-payout-execute.http.js)) |
| **POST** | `/api/internal/v1/contests/payout-automation/run` | Same **`extractPayoutExecuteCredential`**; body requires **`{"trigger":"scheduler"}`** plus **`PAYOUTS_AUTOMATION_ENABLED=true`** for scheduler runs ([`weekly-contests-phase6-ops.md`](weekly-contests-phase6-ops.md)) |

## HTTP outcomes

| Server state | Request | Typical HTTP |
|--------------|---------|--------------|
| Neither **`PAYOUT_OPERATOR_SECRET`** nor **`CONTESTS_OPERATOR_SECRET`** set | Any | **503** `server_misconfigured` — payout execute / automation **disabled** |
| Secret configured | Missing or wrong Bearer / header | **401** `unauthorized` |
| Secret configured | Valid Bearer + valid body / contest | **200** (or **4xx/5xx** for business rules — not auth) |

So “without credentials” on the **request** yields **401** only after the server has a configured secret; if no secret is configured, responses are **503** until env is set.

## Verification (acceptance)

1. Secrets exist only in **Secret Manager** / Cloud Run env — **never** committed.
2. **`GET /health`** → **`contestsPayoutExecuteSecretConfigured":true`** once at least one of **`PAYOUT_OPERATOR_SECRET`** / **`CONTESTS_OPERATOR_SECRET`** resolves.
3. **`POST`** `/api/internal/v1/contests/<id>/payouts/execute` with **`Content-Type: application/json`** and body **`{}`**: **401** without Bearer, **200** or non-auth error with **`Authorization: Bearer <same secret>`** (staging clone before prod).

## Storage

- **GCP:** Secret Manager → mount as Cloud Run env **value** or file volume — **never** commit plaintext secrets.
- **`GET /health`** exposes **`contestsPayoutExecuteSecretConfigured":true`** when **`getPayoutExecuteSecret()`** resolves non-empty (boolean only — Story GL-D4).

## Runbooks

- [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md) — per-contest execute curl examples  
- [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md) — automation Scheduler job  
- [weekly-contests-runbook-g2.md](weekly-contests-runbook-g2.md) — **`CONTESTS_OPERATOR_SECRET`** overview  

## References

- [`server/lib/contest-internal-auth.js`](../../server/lib/contest-internal-auth.js)
- [`server/contests/contest-payout-execute.http.js`](../../server/contests/contest-payout-execute.http.js)
- [`server/contests/contest-payout-automation.http.js`](../../server/contests/contest-payout-automation.http.js)
- [`index.js`](../../index.js)
