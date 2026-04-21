import type { ContestJoinResponse } from './contests-panel.types';

export const CONTEST_JOIN_USE_CHECKOUT_WHEN_FEE =
  'This contest has an entry fee — use Pay & enter to continue.';

export function formatContestJoinSuccessMessage(
  res: ContestJoinResponse,
): string {
  const accepted = res.entry.rulesAcceptedVersion;
  const contestRules = res.contest.rulesVersion;
  return res.idempotentReplay
    ? `You are already entered. Rules accepted version ${String(accepted)} (matches contest rules ${String(contestRules)}).`
    : `You are in. Rules accepted version ${String(accepted)} (stored on your entry; contest rules ${String(contestRules)}).`;
}
