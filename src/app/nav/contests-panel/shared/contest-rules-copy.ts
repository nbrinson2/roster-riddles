/**
 * Rules copy shown before join (Story C2). Align with ADR / operator policy; version when policy changes.
 * @see docs/weekly-contests/weekly-contests-phase4-adr.md
 */

/** Shown wherever contest “payouts” or prizes are described in the UI. */
export const CONTEST_DRY_RUN_PAYOUT_COPY =
  'Dry run — no real money. Any prize or payout figures are simulated for testing only; nothing is charged or paid out.';

/** Static HTML with the long-form player-facing rules (served from `/assets/...`). */
export const CONTEST_FULL_RULES_HREF = 'assets/contests/weekly-contests-rules.html';

/**
 * Short bullets for the contest card (above the long narrative).
 * @param rulesVersion — must match `contests/{contestId}.rulesVersion` / entry snapshot.
 */
export function getContestRulesShortBullets(
  rulesVersion: number | string,
): string[] {
  const vKey =
    typeof rulesVersion === 'number'
      ? rulesVersion
      : Number.parseInt(String(rulesVersion), 10);

  if (vKey === 1) {
    return [
      'Bio Ball only — other game modes never count toward this contest.',
      'A “game in slate” is one finished Bio Ball round (win, loss, or abandon after a guess) whose server time falls in the play window and on or after you joined. Your slate is the first N such games in time order (N = this contest’s slate size).',
      'Only wins on that slate increase your contest win count.',
      'Ties: full slates rank ahead of partial slates; within a tier, ordering follows the published Phase 4 tie-break (wins, losses, abandons, then stable uid).',
      'Refunds: Phase 4 has no real-money entry or payout; simulated amounts are not withdrawable. If a contest is cancelled or voided, follow operator notices — there may be no simulated payout.',
    ];
  }

  return [
    `Rules version ${String(rulesVersion)} is not bundled in this build — confirm policy with the operator before joining.`,
  ];
}

/**
 * Shown next to join: one entry per game type, slate size, optional cap, scheduling note.
 */
export function getContestEligibilityBullets(
  leagueGamesN: number,
  maxEntries?: number | null,
): string[] {
  const lines: string[] = [
    'You may be entered in at most one open contest at a time for Bio Ball (server-enforced at join).',
    `Your score uses up to ${leagueGamesN} qualifying Bio Ball games in order after you join, inside the play window shown on this card.`,
    'Contest times are absolute instants; labels use your device’s timezone. If an operator edits window times before you join, you will see the updated schedule here.',
    'After you join, scoring uses the window and slate size stored on the contest — changing your device clock does not change eligibility.',
  ];
  if (maxEntries != null && maxEntries > 0) {
    lines.push(
      `This contest may show an operator field cap (up to ${maxEntries} entrants). The app will reflect cap policy when enforcement is enabled server-side.`,
    );
  }
  return lines;
}

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
      'If the operator reschedules a contest before it opens, you will only see the updated window after it is saved — always check the times on this card before joining.',
      'Tie-breaking follows the published Phase 4 ordering (wins, then losses in slate, then abandoned, then stable uid order; partial slates rank below full slates).',
      'Operators may schedule using US Eastern time for labels; the times shown in this app use your device’s local timezone.',
    ].join('\n\n');
  }

  return `Rules version ${String(rulesVersion)} is not bundled in this build. Join only if you accept the operator’s current contest policy.`;
}
