/**
 * One-line contest summaries for strip/cards (prize, entry, lock/end time).
 * Monetary fields are optional on `contests/{id}`; copy stays honest about dry-run.
 */

export interface ContestValuePropInput {
  windowEnd: Date;
  /** Simulated prize pool in cents; omit when not set on the contest doc. */
  prizePoolCents?: number | null;
  /** Entry fee in cents; omit = show generic free-entry line for simulated contests. */
  entryFeeCents?: number | null;
  /** Operator cap on entrants; omit when not published. */
  maxEntries?: number | null;
}

/** Canonical collapsed-line payout label: always two decimal places (e.g. `PAYOUT: $100.00`). */
export function formatPayoutUsdLabel(amountCents: number): string {
  const s = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
  return `PAYOUT: ${s}`;
}

function formatEntrySegment(
  entryFeeCents: number | null | undefined,
): string {
  if (entryFeeCents == null) {
    return 'No entry fee (simulated)';
  }
  if (entryFeeCents <= 0) {
    return 'Free entry (simulated)';
  }
  const entryUsd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(entryFeeCents / 100);
  return `${entryUsd} entry (simulated)`;
}

/** "Locks Sun, Apr 20, 1:00 PM EDT" or "Ended Sun, Apr 20, 1:00 PM EDT" using the viewer's locale & timezone. */
export function formatContestWindowBoundaryLabel(
  windowEnd: Date,
  nowMs: number = Date.now(),
): string {
  const endMs = windowEnd.getTime();
  const isFuture = endMs > nowMs;
  const label = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(windowEnd);
  return isFuture ? `Locks ${label}` : `Ended ${label}`;
}

/**
 * Entry / lock / cap only — no prize line (pool belongs on the card meta row with `PAYOUT:`).
 */
export function buildContestScheduleLine(
  input: ContestValuePropInput,
  nowMs: number = Date.now(),
): string {
  const parts: string[] = [];

  parts.push(formatEntrySegment(input.entryFeeCents));

  parts.push(formatContestWindowBoundaryLabel(input.windowEnd, nowMs));

  if (
    input.maxEntries != null &&
    Number.isFinite(input.maxEntries) &&
    input.maxEntries > 0
  ) {
    parts.push(`Up to ${Math.floor(input.maxEntries)} entrants`);
  }

  return parts.join(' · ');
}

/**
 * Single line for game strip: schedule, with optional `PAYOUT:` suffix when a pool is set on the contest doc.
 */
export function buildContestValuePropLine(
  input: ContestValuePropInput,
  nowMs: number = Date.now(),
): string {
  const schedule = buildContestScheduleLine(input, nowMs);
  if (
    input.prizePoolCents != null &&
    Number.isFinite(input.prizePoolCents) &&
    input.prizePoolCents >= 0
  ) {
    return `${schedule} · ${formatPayoutUsdLabel(input.prizePoolCents)}`;
  }
  return schedule;
}
