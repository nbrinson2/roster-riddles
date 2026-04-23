/**
 * Structured logs for contest status transitions (Story D1).
 */

/**
 * @param {Record<string, unknown>} payload
 */
export function logContestTransitionLine(payload) {
  console.log(
    JSON.stringify({
      component: 'contest_transition',
      severity: 'INFO',
      ...payload,
    }),
  );
}
