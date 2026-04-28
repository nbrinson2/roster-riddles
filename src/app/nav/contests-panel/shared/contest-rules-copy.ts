/**
 * Rules copy shown before join (Story C2). Align with ADR / operator policy; version when policy changes.
 * @see docs/weekly-contests/weekly-contests-phase4-adr.md
 *
 * Simulated UI: {@link CONTEST_SIMULATED_HERO_NOTE} (`buildContestHeroUnifiedNote` in
 * `contest-engagement-copy.ts`) and `Simulated · …` entry lines in `contest-value-prop.ts`.
 * Live UI: {@link CONTEST_LIVE_HERO_NOTE}.
 */

// ── Hero (under “Weekly contests”) ────────────────────────────────────────────

/** Simulated / dry-run builds (`simulatedContestsUiEnabled: true`). */
export const CONTEST_SIMULATED_HERO_NOTE =
  'Simulated — not real money. Prizes and payouts shown are for testing only.';

/** Live-oriented builds (`simulatedContestsUiEnabled: false`). */
export const CONTEST_LIVE_HERO_NOTE =
  'Fees, prizes, and rules are on each contest card.';

/** Alias — simulated hero note */
export const CONTEST_DRY_RUN_PAYOUT_COPY = CONTEST_SIMULATED_HERO_NOTE;

/** Alias — live hero note */
export const CONTEST_LIVE_WEEKLY_HERO_COPY = CONTEST_LIVE_HERO_NOTE;

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
      'Bio Ball only — other modes never count.',
      'A slate game is one finished Bio Ball round (win, loss, or abandon after a guess) in the play window, on or after you joined. Your slate is the first N such games in time order (N = slate size).',
      'Only wins on that slate count toward contest wins.',
      'Ties: full slates beat partial; within a tier, Phase 4 tie-break (wins, losses, abandons, uid).',
      'Simulated contests: no real-money entry or payout; refunds follow operator notices if cancelled.',
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
    'Verified email required (Profile → resend link if needed).',
    'At most one open Bio Ball contest at a time (server-enforced).',
    `Score uses up to ${leagueGamesN} qualifying games in order after you join, inside the play window on this card.`,
    'Times use your device timezone; operator edits apply before you join.',
    'After join, eligibility uses the window and slate size stored on the contest doc.',
  ];
  if (maxEntries != null && maxEntries > 0) {
    lines.push(
      `Operator may cap entrants (up to ${maxEntries}); enforcement follows server policy.`,
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
      'Bio Ball only — other modes do not count.',
      'Mini-league slate: up to N completed games in the contest window, in server order after you join. Only wins on that slate count.',
      'Window is half-open [start, end).',
      'Reschedules before open appear on this card — check times before joining.',
      'Tie-breaking: Phase 4 ordering (wins, slate losses, abandons, uid; partial below full).',
      'Labels may reference US Eastern; this app shows your local timezone.',
    ].join('\n\n');
  }

  return `Rules version ${String(rulesVersion)} is not bundled in this build. Join only if you accept the operator’s current contest policy.`;
}
