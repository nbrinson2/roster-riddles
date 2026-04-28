import type {
  ContestJoinResponse,
  ContestJoinSuccessView,
} from './contests-panel.types';

export const CONTEST_JOIN_USE_CHECKOUT_WHEN_FEE =
  'This contest has an entry fee — use Pay & enter to continue.';

/** Explains “slate games” for Bio Ball weekly contests (aligned with game strip accessibility copy). */
export const POST_JOIN_SLATE_GAMES_LINE =
  'Each finished Bio Ball round counts toward your slate — win, loss, or abandon after a guess — in order until your slate is full or the play window ends.';

/** Where to see slate progress vs full contest list. */
export const POST_JOIN_WHERE_PROGRESS_LINE =
  'Track slate progress on the contest strip under the search box on Bio Ball. Open the contest calendar in the nav for your full contest list and schedule.';

export function formatEnteredRulesAckLine(
  entryRulesVersion: number | string,
  contestRulesVersion: number | string,
): string {
  return `Rules accepted version ${String(entryRulesVersion)} on your entry (contest rules ${String(contestRulesVersion)}).`;
}

export function formatContestJoinSuccessView(
  res: ContestJoinResponse,
): ContestJoinSuccessView {
  const accepted = res.entry.rulesAcceptedVersion;
  const contestRules = res.contest.rulesVersion;
  const rulesLine = res.idempotentReplay
    ? `Rules accepted version ${String(accepted)} (matches contest rules ${String(contestRules)}).`
    : `Rules accepted version ${String(accepted)} on your entry (contest rules ${String(contestRules)}).`;
  return {
    headline: res.idempotentReplay ? 'already' : 'joined',
    rulesLine,
  };
}
