/**
 * Structured logs for contest scoring pipeline (Story E1 / E2).
 * @see docs/weekly-contests/weekly-contests-ops-e1.md
 */

/**
 * @param {Record<string, unknown>} payload
 */
export function logContestScoringLine(payload) {
  console.log(
    JSON.stringify({
      component: 'contest_scoring',
      severity: 'INFO',
      ...payload,
    }),
  );
}
