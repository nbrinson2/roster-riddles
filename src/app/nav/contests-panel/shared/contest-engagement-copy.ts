/**
 * Engagement lines: calendar vs strip, empty states, delight. Neutral unless noted.
 */

import type { ContestStatus } from 'src/app/shared/models/contest.model';
import type { ParsedFinalResultsView } from './contest-results-closure';
import { formatOrdinalRank } from './contest-results-closure';

/** Under the Weekly contests title. */
export const CONTEST_HERO_TAGLINE = 'Bio Ball mini-leagues — fixed slate size.';

export const CONTEST_PANEL_EMPTY_TITLE = 'No contests yet';

export const CONTEST_PANEL_EMPTY_BODY =
  'No open, upcoming, or recent Bio Ball contests. Refresh if one was just published.';

export const CONTEST_PANEL_EMPTY_STRIP_TIP =
  'On Bio Ball, the strip under search shows slate progress for the active contest even when this list is empty.';

/** Intent folded into {@link buildContestHeroUnifiedNote} (hero dashed panel). Kept for tests/docs. */
export const CONTEST_CALENDAR_CANONICAL_LINE =
  'Calendar — browse, join, and track contests here (source of truth).';

/** Game strip: board-level summary only. */
export const BIO_GAME_CONTEST_STRIP_CONTEXT_LINE =
  'Board-level summary only — open the calendar tab for your full list and actions.';

export type PaidDelightTier = 'winner' | 'podium' | 'played';

export interface PaidDelightView {
  tier: PaidDelightTier;
  headline: string;
  sub: string | null;
}

/** Entered + open — nudge to finish slate. */
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
    return 'Window closing soon — finish your slate.';
  }
  return 'You’re in — stack wins before the window closes.';
}

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
    return 'Starting soon — skim rules before join opens.';
  }
  return 'On deck — join when the window opens.';
}

/**
 * Paid contest results strip. Simulated vs live controlled by `simulatedDelight`.
 */
export function paidResultDelight(
  fr: ParsedFinalResultsView | undefined,
  entered: boolean,
  opts?: { simulatedDelight?: boolean },
): PaidDelightView | null {
  if (!fr || fr.loading || !entered) {
    return null;
  }
  if (fr.youMissingFromStandings || fr.yourRank == null || fr.entrants < 1) {
    return null;
  }
  const sim = opts?.simulatedDelight !== false;
  const r = fr.yourRank;
  if (r === 1) {
    return {
      tier: 'winner',
      headline: sim
        ? '1st place — simulated contest'
        : '1st place — top slate',
      sub: sim ? 'Payout lines here are simulated (not real money).' : null,
    };
  }
  if (r <= 3) {
    return {
      tier: 'podium',
      headline:
        r === 2
          ? `Runner-up (${formatOrdinalRank(r)} of ${fr.entrants})`
          : `Top three (${formatOrdinalRank(r)} of ${fr.entrants})`,
      sub: 'Order from slate wins and tie-breaks.',
    };
  }
  return {
    tier: 'played',
    headline: `${formatOrdinalRank(r)} of ${fr.entrants} — thanks for playing.`,
    sub: null,
  };
}

/**
 * Single hero note for the dashed yellow panel — copy differs for simulated vs live builds.
 */
export function buildContestHeroUnifiedNote(args: {
  simulatedContestsUiEnabled: boolean;
  contestsPaymentsEnabled: boolean;
}): string {
  const calendar =
    'This calendar is your full contest roster — browse and join here.';

  if (args.simulatedContestsUiEnabled) {
    const body =
      'Simulated contests — practice only; no real-money movement unless clearly marked. Each card shows fees, prizes, and rules.';
    if (!args.contestsPaymentsEnabled) {
      return `${calendar} ${body}`;
    }
    return `${calendar} ${body} Paid entry uses Stripe Checkout; payout totals shown may be previews in simulated contests.`;
  }

  const bodyLive =
    'Fees, prizes, and rules are listed per contest — open a card for full detail.';
  if (!args.contestsPaymentsEnabled) {
    return `${calendar} ${bodyLive}`;
  }
  return `${calendar} ${bodyLive} Paid contests collect entry fees through secure checkout (Stripe).`;
}
