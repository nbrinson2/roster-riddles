/**
 * Phase 6 Story P6-H2 — Structured logs + optional counters for prize payout execute and Stripe payout webhooks.
 * @see docs/weekly-contests/weekly-contests-phase6-observability.md
 */

/** Filter Phase 6 prize payout / admin payout logs in a mixed sink (distinct from Phase 5 `contest_payments`). */
export const CONTEST_PAYOUTS_LOG_DOMAIN = 'contest_payouts';

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isRecord(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @param {Record<string, unknown>} payload
 * @returns {string}
 */
function deriveSeverityFromPayload(payload) {
  const explicit = payload.severity;
  if (typeof explicit === 'string') {
    return explicit === 'WARN' ? 'WARNING' : explicit;
  }
  const httpStatus =
    typeof payload.httpStatus === 'number' ? payload.httpStatus : undefined;
  if (httpStatus !== undefined) {
    return httpStatus >= 500 ? 'ERROR' : httpStatus >= 400 ? 'WARNING' : 'INFO';
  }
  return 'INFO';
}

/**
 * Prize payout execute job + internal HTTP gate (`runContestPayoutExecuteJob`, operator execute).
 *
 * @param {Record<string, unknown>} payload — include `outcome`, `requestId`; optional `contestId`, `httpStatus`,
 *   `latencyMs`, `aggregateStatus`, `payoutJobId`, `uid`, `message`, …
 */
export function logPayoutJobLine(payload) {
  const severity = deriveSeverityFromPayload(payload);
  const line = {
    ...payload,
    component: 'payout_job',
    domain: CONTEST_PAYOUTS_LOG_DOMAIN,
    severity,
    timestamp: new Date().toISOString(),
  };
  const sink = severity === 'ERROR' ? console.error : console.log;
  sink(JSON.stringify(line));

  if (process.env.CONTESTS_PAYOUT_METRIC_COUNTERS === '1') {
    maybeEmitPayoutJobFailureCounter(payload, severity);
  }
}

/**
 * @param {Record<string, unknown>} payload
 * @param {string} severity
 */
function maybeEmitPayoutJobFailureCounter(payload, severity) {
  const oc = String(payload.outcome ?? '');
  const hs =
    typeof payload.httpStatus === 'number' ? payload.httpStatus : undefined;
  const hardFailure =
    severity === 'ERROR' ||
    (hs !== undefined && hs >= 500) ||
    (hs !== undefined && hs === 422) ||
    oc === 'firestore_batch_failed_after_transfers' ||
    oc === 'firestore_read_failed' ||
    oc === 'transfer_failed' ||
    oc === 'payout_lines_build_failed' ||
    oc === 'payout_retry_persist_failed';
  if (!hardFailure) {
    return;
  }
  emitContestPayoutMetricCounterIfEnabled('contest_payout_job_failure_total', {
    outcome: oc,
    requestId: payload.requestId != null ? String(payload.requestId) : undefined,
    contestId: payload.contestId != null ? String(payload.contestId) : undefined,
  });
}

/**
 * Stripe **`transfer.*`** / **`payout.*`** handlers for contest prizes (P6-E2). Distinct from Phase 5 `stripe_webhook` lines.
 *
 * @param {Record<string, unknown>} payload
 */
export function logStripeWebhookPayoutLine(payload) {
  const severity = deriveSeverityFromPayload(payload);
  const line = {
    ...payload,
    component: 'stripe_webhook_payout',
    domain: CONTEST_PAYOUTS_LOG_DOMAIN,
    severity,
    timestamp: new Date().toISOString(),
  };
  const sink = severity === 'ERROR' ? console.error : console.log;
  sink(JSON.stringify(line));

  if (process.env.CONTESTS_PAYOUT_METRIC_COUNTERS === '1' && severity === 'ERROR') {
    emitContestPayoutMetricCounterIfEnabled('contest_payout_webhook_failure_total', {
      outcome: String(payload.outcome ?? 'unknown'),
      requestId:
        payload.requestId != null ? String(payload.requestId) : undefined,
      eventId: payload.eventId != null ? String(payload.eventId) : undefined,
      eventType:
        payload.eventType != null ? String(payload.eventType) : undefined,
      contestId:
        payload.contestId != null ? String(payload.contestId) : undefined,
    });
  }
}

/**
 * Admin hold / resume / retry (P6-G2) — same domain as `payout_job` for cross-filtering.
 *
 * @param {Record<string, unknown>} payload
 */
export function logPayoutAdminActionLine(payload) {
  const severity = deriveSeverityFromPayload(payload);
  const line = {
    ...payload,
    component: 'payout_admin_action',
    domain: CONTEST_PAYOUTS_LOG_DOMAIN,
    severity,
    timestamp: new Date().toISOString(),
  };
  const sink = severity === 'ERROR' ? console.error : console.log;
  sink(JSON.stringify(line));
}

/**
 * Optional second JSON line for sinks that route `component=contest_payout_metrics`.
 * Enable with **`CONTESTS_PAYOUT_METRIC_COUNTERS=1`** (see `stripe.md`).
 *
 * @param {string} metricName
 * @param {Record<string, string | number | undefined | null>} labels
 */
export function emitContestPayoutMetricCounterIfEnabled(metricName, labels) {
  if (process.env.CONTESTS_PAYOUT_METRIC_COUNTERS !== '1') {
    return;
  }
  const clean = isRecord(labels) ? labels : {};
  console.error(
    JSON.stringify({
      component: 'contest_payout_metrics',
      metricType: 'counter',
      metricName,
      timestamp: new Date().toISOString(),
      domain: CONTEST_PAYOUTS_LOG_DOMAIN,
      ...clean,
    }),
  );
}
