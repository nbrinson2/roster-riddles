/**
 * One-line contest summaries for strip/cards (prize, entry, lock/end time).
 * Simulated vs neutral entry lines use {@link ContestCopyOptions.simulatedLabels}.
 */

/** Pass `{ simulatedLabels: false }` when `environment.simulatedContestsUiEnabled` is false. */
export interface ContestCopyOptions {
  simulatedLabels?: boolean;
}

export interface ContestValuePropInput {
  windowEnd: Date;
  prizePoolCents?: number | null;
  entryFeeCents?: number | null;
  maxEntries?: number | null;
}

/** Canonical collapsed-line payout label (e.g. `PAYOUT: $100.00`). */
export function formatPayoutUsdLabel(amountCents: number): string {
  const s = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
  return `PAYOUT: ${s}`;
}

/** Entry fee segment — simulated branch prefixes so “sim” vs live stays obvious. */
export function formatContestEntryFeeSegment(
  entryFeeCents: number | null | undefined,
  opts?: ContestCopyOptions,
): string {
  const sim = opts?.simulatedLabels !== false;
  if (entryFeeCents == null) {
    return sim ? 'Simulated · no listed fee' : 'No listed fee';
  }
  if (entryFeeCents <= 0) {
    return sim ? 'Simulated · free entry' : 'Free entry';
  }
  const entryUsd = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(entryFeeCents / 100);
  return sim ? `Simulated · ${entryUsd} entry` : `${entryUsd} entry`;
}

/** "Locks …" / "Ended …" using viewer locale & timezone. */
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

export function buildContestScheduleLine(
  input: ContestValuePropInput,
  nowMs: number = Date.now(),
  opts?: ContestCopyOptions,
): string {
  const parts: string[] = [];

  parts.push(formatContestEntryFeeSegment(input.entryFeeCents, opts));

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

/** Strip line: schedule + optional `PAYOUT:` when pool is set on the contest doc. */
export function buildContestValuePropLine(
  input: ContestValuePropInput,
  nowMs: number = Date.now(),
  opts?: ContestCopyOptions,
): string {
  const schedule = buildContestScheduleLine(input, nowMs, opts);
  if (
    input.prizePoolCents != null &&
    Number.isFinite(input.prizePoolCents) &&
    input.prizePoolCents >= 0
  ) {
    return `${schedule} · ${formatPayoutUsdLabel(input.prizePoolCents)}`;
  }
  return schedule;
}
