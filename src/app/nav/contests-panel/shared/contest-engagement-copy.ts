/**
 * P2 — Engagement & delight: short, honest copy + hooks for celebratory UI.
 */

import type { ContestStatus } from 'src/app/shared/models/contest.model';
import type { ParsedFinalResultsView } from './contest-results-closure';
import { formatOrdinalRank } from './contest-results-closure';

/** Shown under the Weekly contests title. */
export const CONTEST_HERO_TAGLINE =
  'Mini-league Bio Ball — same slate size, fair footing.';

export type PaidDelightTier = 'winner' | 'podium' | 'played';

export interface PaidDelightView {
  tier: PaidDelightTier;
  headline: string;
  sub: string | null;
}

/** When the user is entered and the contest is open — nudge to finish the slate. */
export function openEnteredEngagementLine(
  status: ContestStatus,
  entered: boolean,
  windowEndMs: number,
  nowMs: number,
): string | null {
  if (status !== 'open' || !entered) {
    return null;
  }
  const left = windowEndMs - nowMs;
  if (left <= 0) {
    return null;
  }
  const hours = left / 3600000;
  if (hours < 36) {
    return 'Window still open — finish your slate games before play locks.';
  }
  return 'You’re in — stack contest wins on your Bio Ball slate before the window closes.';
}

/** Warm copy for upcoming contests. */
export function scheduledWarmupLine(
  status: ContestStatus,
  windowStartMs: number,
  nowMs: number,
): string | null {
  if (status !== 'scheduled') {
    return null;
  }
  if (windowStartMs <= nowMs) {
    return null;
  }
  const until = windowStartMs - nowMs;
  if (until < 86400000) {
    return 'Starting soon — skim the rules so you’re ready to join.';
  }
  return 'On deck — join once the play window opens.';
}

/**
 * Celebratory (but dry-run honest) strip for paid contests when the viewer has a standing row.
 */
export function paidResultDelight(
  fr: ParsedFinalResultsView | undefined,
  entered: boolean,
): PaidDelightView | null {
  if (!fr || fr.loading || !entered) {
    return null;
  }
  if (fr.youMissingFromStandings || fr.yourRank == null || fr.entrants < 1) {
    return null;
  }
  const r = fr.yourRank;
  if (r === 1) {
    return {
      tier: 'winner',
      headline: 'You finished 1st — this week’s simulated winner.',
      sub: 'Payouts here are dry-run only; your slate still took the top spot.',
    };
  }
  if (r <= 3) {
    return {
      tier: 'podium',
      headline:
        r === 2
          ? `Runner-up (${formatOrdinalRank(r)} of ${fr.entrants}) — strong slate.`
          : `Top three (${formatOrdinalRank(r)} of ${fr.entrants}) — podium finish.`,
      sub: 'Mini-league wins and tie-breaks decided the order.',
    };
  }
  return {
    tier: 'played',
    headline: `Nice effort — ${formatOrdinalRank(r)} of ${fr.entrants}. Thanks for playing.`,
    sub: null,
  };
}
