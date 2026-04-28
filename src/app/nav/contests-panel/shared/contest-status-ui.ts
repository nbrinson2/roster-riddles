/**
 * P0 UX: countdowns, lock-soon, and plain-language status pipeline for weekly contests.
 */

/** Warn when play window ends within this many ms. */
export const LOCK_SOON_MS = 24 * 60 * 60 * 1000;

const PIPELINE_LABELS = [
  'Upcoming',
  'Open',
  'Scoring',
  'Finalized',
] as const;

export function pipelineLabels(): readonly string[] {
  return PIPELINE_LABELS;
}

/** 0–3 = index in {@link pipelineLabels}; cancelled → -1. */
export function pipelineCurrentIndex(
  status: string,
): number {
  switch (status) {
    case 'scheduled':
      return 0;
    case 'open':
      return 1;
    case 'scoring':
      return 2;
    case 'paid':
      return 3;
    default:
      return -1;
  }
}

export function pipelineCaption(
  status: string,
  windowStartMs: number,
  windowEndMs: number,
  nowMs: number,
  simulatedDryRunCopy = true,
): string {
  switch (status) {
    case 'scheduled':
      return 'Not open for entry yet. Times on this card are when the contest is planned to run.';
    case 'open': {
      if (nowMs < windowStartMs) {
        return 'Contest is open for entry; the play window has not started yet.';
      }
      if (nowMs < windowEndMs) {
        return 'Play window is active — your Bio Ball games in this period count toward the slate.';
      }
      return 'Play window has ended. The contest may move to scoring when the server processes results.';
    }
    case 'scoring':
      return simulatedDryRunCopy
        ? 'Standings and dry-run payouts are being calculated.'
        : 'Standings and payouts are being calculated.';
    case 'paid':
      return simulatedDryRunCopy
        ? 'This contest is complete. Dry-run payout lines are final (not real money).'
        : 'This contest is complete. Final standings and payout lines are published below.';
    case 'cancelled':
      return 'This contest was cancelled.';
    default:
      return '';
  }
}

/** Relative time until `targetMs`, for display (e.g. "2d 4h" or "45m"). */
export function formatTimeUntil(targetMs: number, nowMs: number): string {
  let ms = Math.max(0, targetMs - nowMs);
  const sec = Math.floor(ms / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);
  if (day > 0) {
    return `${day}d ${hr % 24}h`;
  }
  if (hr > 0) {
    return `${hr}h ${min % 60}m`;
  }
  if (min > 0) {
    return `${min}m`;
  }
  return '<1m';
}

/**
 * Primary countdown line under the window (before / during play window).
 * Returns null when no countdown is useful.
 */
export function primaryCountdownLine(
  status: string,
  windowStartMs: number,
  windowEndMs: number,
  nowMs: number,
): string | null {
  if (status === 'cancelled' || status === 'paid' || status === 'scoring') {
    return null;
  }
  if (status === 'scheduled') {
    if (nowMs < windowStartMs) {
      return `Opens in ${formatTimeUntil(windowStartMs, nowMs)}`;
    }
    return null;
  }
  if (status === 'open') {
    if (nowMs < windowStartMs) {
      return `Play opens in ${formatTimeUntil(windowStartMs, nowMs)}`;
    }
    if (nowMs < windowEndMs) {
      return `Play window closes in ${formatTimeUntil(windowEndMs, nowMs)}`;
    }
    return 'Play window ended — waiting for scoring';
  }
  return null;
}

export function isPlayWindowLockSoon(
  status: string,
  windowStartMs: number,
  windowEndMs: number,
  nowMs: number,
  thresholdMs: number = LOCK_SOON_MS,
): boolean {
  if (status !== 'open') {
    return false;
  }
  if (nowMs < windowStartMs || nowMs >= windowEndMs) {
    return false;
  }
  const left = windowEndMs - nowMs;
  return left > 0 && left <= thresholdMs;
}
