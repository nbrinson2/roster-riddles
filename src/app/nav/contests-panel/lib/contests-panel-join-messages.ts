import type {
  ContestJoinResponse,
  ContestJoinSuccessView,
} from './contests-panel.types';

export const CONTEST_JOIN_USE_CHECKOUT_WHEN_FEE =
  'Entry fee contest — use Pay & enter.';

/** Slate games — neutral mechanics (same in sim and live builds). */
export const POST_JOIN_SLATE_GAMES_LINE =
  'Each finished Bio Ball round uses one slate slot (win, loss, or abandon after a guess), in order until full or the window ends.';

/** Where to watch progress — neutral UI paths. */
export const POST_JOIN_WHERE_PROGRESS_LINE =
  'Progress: strip under search on Bio Ball. Full list: contest calendar in the nav.';

export function formatEnteredRulesAckLine(
  entryRulesVersion: number | string,
  contestRulesVersion: number | string,
): string {
  return `Rules v${String(entryRulesVersion)} on entry (contest v${String(contestRulesVersion)}).`;
}

export function formatContestJoinSuccessView(
  res: ContestJoinResponse,
): ContestJoinSuccessView {
  const accepted = res.entry.rulesAcceptedVersion;
  const contestRules = res.contest.rulesVersion;
  const rulesLine = res.idempotentReplay
    ? `Already in — rules v${String(accepted)} (contest v${String(contestRules)}).`
    : formatEnteredRulesAckLine(accepted, contestRules);
  return {
    headline: res.idempotentReplay ? 'already' : 'joined',
    rulesLine,
  };
}
