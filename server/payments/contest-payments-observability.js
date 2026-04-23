/**
 * Phase 5 Story P5-H1 — Structured logging + optional metric hooks for contest payments.
 * @see docs/weekly-contests/weekly-contests-phase5-observability.md
 */

/** Cross-filter with checkout logs (`contest_checkout` uses the same domain). */
export const CONTEST_PAYMENTS_LOG_DOMAIN = 'contest_payments';

/**
 * One JSON object per line for Stripe webhook handlers (success / failure / refund).
 * Never log raw payment payloads, card data, or secrets.
 *
 * @param {Record<string, unknown>} payload — include `outcome`; optional `requestId`, `eventId`,
 *   `eventType`, `contestId`, `uid`, `severity`, `httpStatus`, `message`, etc.
 */
export function logStripeWebhookLine(payload) {
  const explicit = payload.severity;
  const httpStatus =
    typeof payload.httpStatus === 'number' ? payload.httpStatus : undefined;
  let severity = 'INFO';
  if (typeof explicit === 'string') {
    severity = explicit === 'WARN' ? 'WARNING' : explicit;
  } else if (httpStatus !== undefined) {
    severity =
      httpStatus >= 500 ? 'ERROR' : httpStatus >= 400 ? 'WARNING' : 'INFO';
  }
  const line = {
    ...payload,
    component: 'stripe_webhook',
    severity,
    timestamp: new Date().toISOString(),
    domain: CONTEST_PAYMENTS_LOG_DOMAIN,
  };
  const sink = severity === 'ERROR' ? console.error : console.log;
  sink(JSON.stringify(line));
}

/**
 * Optional **second** JSON line for log sinks that route `component=contest_payments_metrics`
 * to Cloud Monitoring / Datadog counters (or ignore in dev).
 *
 * Enable with `CONTESTS_PAYMENTS_METRIC_COUNTERS=1`. Intended for webhook **failures**:
 * handler exceptions, Firestore idempotency marker failures, Stripe API retrieve failures, etc.
 *
 * @param {Record<string, string | number | undefined | null>} labels — e.g. `outcome`, `requestId`, `eventType`
 */
export function emitContestWebhookFailureMetric(labels) {
  if (process.env.CONTESTS_PAYMENTS_METRIC_COUNTERS !== '1') {
    return;
  }
  console.error(
    JSON.stringify({
      component: 'contest_payments_metrics',
      metricType: 'counter',
      metricName: 'contest_webhook_failure_total',
      timestamp: new Date().toISOString(),
      domain: CONTEST_PAYMENTS_LOG_DOMAIN,
      ...labels,
    }),
  );
}
