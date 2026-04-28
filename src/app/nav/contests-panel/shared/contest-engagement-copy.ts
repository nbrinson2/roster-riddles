/**
 * P2 — Engagement & delight: short, honest copy + hooks for celebratory UI.
 */

import type { ContestStatus } from 'src/app/shared/models/contest.model';
import type { ParsedFinalResultsView } from './contest-results-closure';
import { formatOrdinalRank } from './contest-results-closure';

/** Shown under the Weekly contests title. */
export const CONTEST_HERO_TAGLINE =
  'Mini-league Bio Ball — same slate size, fair footing.';

/** Contests panel — empty list (signed-in, no rows after load). */
export const CONTEST_PANEL_EMPTY_TITLE = 'No weekly contests to show yet';

export const CONTEST_PANEL_EMPTY_BODY =
  'There are no open, upcoming, or recent completed Bio Ball contests in this list. If one was just published, refresh — otherwise check back after the next schedule.';

export const CONTEST_PANEL_EMPTY_STRIP_TIP =
  'Tip: choose Bio Ball, then look under the search box — the strip shows slate progress for the contest tied to play, even when this calendar is empty.';

/**
 * Shown under the hero tagline — makes the drawer calendar the obvious “my contests” home so it
 * does not compete with the Bio Ball game strip (which is play-context only).
 */
export const CONTEST_CALENDAR_CANONICAL_LINE =
  'Contest calendar — browse, join, and follow every weekly contest here. This list is the source of truth.';

/**
 * Bio Ball game header strip — pairs with {@link CONTEST_CALENDAR_CANONICAL_LINE}: same data,
 * different scope (slate shortcut vs full roster).
 */
export const BIO_GAME_CONTEST_STRIP_CONTEXT_LINE =
  'This line only summarizes the contest tied to the board below; open the calendar tab for your full contest list and actions.';

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
        ? 'You finished 1st — this week’s simulated winner.'
        : 'You finished 1st — top spot on this slate.',
      sub: sim
        ? 'Payouts here are dry-run only; your slate still took the top spot.'
        : null,
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
