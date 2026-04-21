/**
 * Rules copy shown before join (Story C2). Align with ADR / operator policy; version when policy changes.
 * @see docs/weekly-contests-phase4-adr.md
 */

/** Shown wherever contest “payouts” or prizes are described in the UI. */
export const CONTEST_DRY_RUN_PAYOUT_COPY =
  'Dry run — no real money. Any prize or payout figures are simulated for testing only; nothing is charged or paid out.';

/**
 * @param rulesVersion — must match `contests/{contestId}.rulesVersion` / entry snapshot.
 */
export function getContestRulesNarrative(
  rulesVersion: number | string,
): string {
  const vKey =
    typeof rulesVersion === 'number'
      ? rulesVersion
      : Number.parseInt(String(rulesVersion), 10);

  if (vKey === 1) {
    return [
      'This contest is Bio Ball only. Gameplay from other modes does not count toward your contest score.',
      'You are scored on a mini-league slate: at most N completed Bio Ball games in the contest window, taken in server order after you join (games before you join do not count). Only wins in that slate increase your contest win count.',
      'The contest window is a half-open interval: scoring includes events from the start time up to (but not including) the end time.',
      'Tie-breaking follows the published Phase 4 ordering (wins, then losses in slate, then abandoned, then stable uid order; partial slates rank below full slates).',
      'Operators may schedule using US Eastern time for labels; the times shown in this app use your device’s local timezone.',
    ].join('\n\n');
  }

  return `Rules version ${String(rulesVersion)} is not bundled in this build. Join only if you accept the operator’s current contest policy.`;
}
