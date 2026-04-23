/**
 * Structured logs for GET contest list/detail (Story D2).
 */

/**
 * @param {Record<string, unknown>} payload
 */
export function logContestReadLine(payload) {
  console.log(
    JSON.stringify({
      component: 'contest_read',
      severity: 'INFO',
      ...payload,
    }),
  );
}
