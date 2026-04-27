# Phase 5 contest payments — observability (Story P5-H1)

Structured logs for **checkout session creation** and **Stripe webhooks** (paid entry lifecycle). Same request correlation pattern as [gameplay observability](../platform/gameplay-observability.md): **`requestId`** on every HTTP-handled line (from `req.requestId` / `X-Request-ID`).

**Secrets:** Never log `Authorization`, Stripe signing secrets, API keys, card numbers, or full webhook bodies. Stripe **`eventId`** / **`eventType`** are safe correlation fields.

---

## Shared fields (both flows)

| Field | Description |
|--------|-------------|
| `domain` | Always `contest_payments` — filter Phase 5 payment logs in a mixed sink. |
| `timestamp` | ISO-8601 UTC. |
| `requestId` | HTTP request correlation id (webhook delivery = one POST). |
| `outcome` | Semantic result code (see handlers). |
| `severity` | `INFO`, `WARNING`, or `ERROR` (checkout may derive from `httpStatus`). |

---

## Checkout — `component: contest_checkout`

**Implementation:** [`server/contests/contest-checkout-log.js`](../../server/contests/contest-checkout-log.js), [`contest-checkout.http.js`](../../server/contests/contest-checkout.http.js).

| Field | Description |
|--------|-------------|
| `component` | Always `contest_checkout`. |
| `httpStatus` | HTTP status served to the client (`200`, `400`, `401`, …). |
| `latencyMs` | Wall time for the handler (ms). |
| `contestId` | Present when the contest id was parsed and loaded. |
| `uid` | Authenticated user (e.g. successful `200` session creation). |
| `message` | Sanitized error text only for server/Stripe/Firestore failures (truncated upstream if needed). |

---

## Webhooks — `component: stripe_webhook`

**Implementation:** [`server/payments/contest-payments-observability.js`](../../server/payments/contest-payments-observability.js), handlers under [`server/payments/`](../../server/payments/).

| Field | Description |
|--------|-------------|
| `component` | Always `stripe_webhook`. |
| `eventId` | Stripe event id (`evt_...`) when known. |
| `eventType` | Stripe `type` string. |
| `contestId` / `uid` | When contest metadata was resolved. |
| `ledgerWritten` | Boolean on success-path summaries when relevant. |
| `severity` | `ERROR` for misconfiguration / handler crash; `WARNING` for bad client input (e.g. bad signature); otherwise `INFO`. |

---

## Optional metric counters (webhook failures)

Set **`CONTESTS_PAYMENTS_METRIC_COUNTERS=1`** to emit an extra JSON line per eligible failure:

| Field | Description |
|--------|-------------|
| `component` | `contest_payments_metrics` |
| `metricType` | `counter` |
| `metricName` | `contest_webhook_failure_total` |
| `outcome` | Same semantic code as the primary log (e.g. `contest_payment_handler_failed`). |

Route or query these lines separately from normal app logs to drive alerts (e.g. high `contest_payment_handler_failed` rate).

---

## See also

- [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) — event types and Firestore writes  
- [weekly-contests-phase5-staging-qa.md](weekly-contests-phase5-staging-qa.md) — manual staging checklist; links **`npm run test:server:phase5-payments`** (Story P5-H3)  
- [stripe.md](../payments/stripe.md) — environment variables  
- [weekly-contests-phase6-observability.md](weekly-contests-phase6-observability.md) — Phase 6 prize payout job + `transfer.*` / `payout.*` webhook logs (P6-H2)  
