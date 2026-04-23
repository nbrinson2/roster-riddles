import type { ContestEntryPaymentStatus } from 'src/app/shared/models/contest-entry.model';
import type { ContestEntryRowState, ContestListRow } from './contests-panel.types';

/** Normalize Firestore `paymentStatus` for entry docs. */
export function parseEntryPaymentStatus(
  raw: unknown,
): ContestEntryPaymentStatus | null {
  if (typeof raw !== 'string' || !raw.trim()) {
    return null;
  }
  const s = raw.trim();
  if (
    s === 'free' ||
    s === 'pending' ||
    s === 'paid' ||
    s === 'failed' ||
    s === 'refunded'
  ) {
    return s;
  }
  return null;
}

export function contestRowRequiresPayment(
  row: ContestListRow,
  contestsPaymentsEnabled: boolean,
): boolean {
  return (
    contestsPaymentsEnabled &&
    typeof row.entryFeeCents === 'number' &&
    Number.isFinite(row.entryFeeCents) &&
    row.entryFeeCents > 0
  );
}

/**
 * “You’re in” for UX — free contests: entry doc exists; paid contests: `paymentStatus === paid`.
 */
export function entryRowCountsAsConfirmedEntrant(
  row: ContestListRow,
  entry: ContestEntryRowState | undefined,
  contestsPaymentsEnabled: boolean,
): boolean {
  if (!entry?.loaded || !entry.entered) {
    return false;
  }
  if (!contestRowRequiresPayment(row, contestsPaymentsEnabled)) {
    return true;
  }
  return entry.paymentStatus === 'paid';
}

export function formatContestEntryFeeUsd(row: ContestListRow): string | null {
  if (
    row.entryFeeCents == null ||
    !Number.isFinite(row.entryFeeCents) ||
    row.entryFeeCents <= 0
  ) {
    return null;
  }
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: 'USD',
  }).format(row.entryFeeCents / 100);
}
