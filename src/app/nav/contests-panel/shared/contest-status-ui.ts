/**
 * Countdowns, lock-soon, status pipeline for weekly contests.
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
      return 'Not open for entry — times above are planned.';
    case 'open': {
      if (nowMs < windowStartMs) {
        return 'Open for entry — play hasn’t started.';
      }
      if (nowMs < windowEndMs) {
        return 'Play active — rounds in this window count on your slate.';
      }
      return 'Play ended — contest moves to scoring when ready.';
    }
    case 'scoring':
      return simulatedDryRunCopy
        ? 'Scoring — standings and estimated payouts (not real money).'
        : 'Scoring — standings and payouts.';
    case 'paid':
      return simulatedDryRunCopy
        ? 'Complete — estimated payouts below (not real money).'
        : 'Complete — final standings and payouts below.';
    case 'cancelled':
      return 'Cancelled.';
    default:
      return '';
  }
}

/** Relative time until `targetMs` (e.g. "2d 4h", "45m"). */
export function formatTimeUntil(targetMs: number, nowMs: number): string {
  const ms = Math.max(0, targetMs - nowMs);
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
      return `Play starts in ${formatTimeUntil(windowStartMs, nowMs)}`;
    }
    if (nowMs < windowEndMs) {
      return `Play locks in ${formatTimeUntil(windowEndMs, nowMs)}`;
    }
    return 'Play ended — awaiting scoring';
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
