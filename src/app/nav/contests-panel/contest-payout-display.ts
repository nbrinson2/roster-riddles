import type {
  ContestDryRunPayoutsDocument,
  ContestPayoutLine,
} from 'src/app/shared/models/contest-payouts-dry-run.model';

/** Display notional dollars from integer cents (FAKE_USD / USD). */
export function formatNotionalUsdFromCents(amountCents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amountCents / 100);
}

function lineRank(line: ContestPayoutLine): number {
  if (typeof line.rank === 'number' && Number.isFinite(line.rank)) {
    return line.rank;
  }
  if (typeof line.place === 'number' && Number.isFinite(line.place)) {
    return line.place;
  }
  return NaN;
}

/** Primary line: “Winner gets $X.XX” from rank 1 (numeric source: `amountCents`). */
export function getWinnerGetsPhrase(
  doc: ContestDryRunPayoutsDocument | null,
): string | null {
  if (!doc?.lines?.length) {
    return null;
  }
  const sorted = [...doc.lines].sort(
    (a, b) => lineRank(a) - lineRank(b),
  );
  const first = sorted[0];
  if (!first || lineRank(first) !== 1) {
    return null;
  }
  return `Winner gets ${formatNotionalUsdFromCents(first.amountCents)}`;
}

/** Secondary list: other places, same numeric formatting. */
export function getPlaceAmountLines(
  doc: ContestDryRunPayoutsDocument | null,
): string[] {
  if (!doc?.lines?.length) {
    return [];
  }
  return [...doc.lines]
    .filter((l) => lineRank(l) > 1)
    .sort((a, b) => lineRank(a) - lineRank(b))
    .map(
      (l) =>
        `Place ${lineRank(l)}: ${formatNotionalUsdFromCents(l.amountCents)}`,
    );
}
