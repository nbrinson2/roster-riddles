/**
 * Structured logs for POST /api/v1/contests/:contestId/checkout-session (Story P5-D1 + P5-H1).
 * @see docs/weekly-contests/weekly-contests-phase5-observability.md
 */

import { CONTEST_PAYMENTS_LOG_DOMAIN } from '../payments/contest-payments-observability.js';

/**
 * @param {Record<string, unknown>} payload
 */
export function logContestCheckoutLine(payload) {
  const httpStatus = /** @type {number} */ (payload.httpStatus);
  const severity =
    httpStatus >= 500
      ? 'ERROR'
      : httpStatus >= 400
        ? 'WARNING'
        : 'INFO';
  const line = {
    component: 'contest_checkout',
    severity,
    timestamp: new Date().toISOString(),
    domain: CONTEST_PAYMENTS_LOG_DOMAIN,
    ...payload,
  };
  const sink = severity === 'ERROR' ? console.error : console.log;
  sink(JSON.stringify(line));
}
