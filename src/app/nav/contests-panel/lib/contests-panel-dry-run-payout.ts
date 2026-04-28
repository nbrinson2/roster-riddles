import type {
  ContestDryRunPayoutsDocument,
  ContestPayoutLine,
} from 'src/app/shared/models/contest-payouts-dry-run.model';

export function parseDryRunPayoutDocument(
  raw: unknown,
): ContestDryRunPayoutsDocument | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const o = raw as Record<string, unknown>;
  const linesRaw = o['lines'];
  if (!Array.isArray(linesRaw)) {
    return null;
  }
  const lines: ContestPayoutLine[] = [];
  for (const item of linesRaw) {
    if (item == null || typeof item !== 'object' || Array.isArray(item)) {
      continue;
    }
    const L = item as Record<string, unknown>;
    const uid = typeof L['uid'] === 'string' ? L['uid'] : '';
    const rank =
      typeof L['rank'] === 'number' && Number.isFinite(L['rank'])
        ? L['rank']
        : typeof L['place'] === 'number' && Number.isFinite(L['place'])
          ? L['place']
          : NaN;
    const amountCents =
      typeof L['amountCents'] === 'number' &&
      Number.isFinite(L['amountCents'])
        ? L['amountCents']
        : NaN;
    if (!uid || !Number.isFinite(rank) || !Number.isFinite(amountCents)) {
      continue;
    }
    lines.push({ uid, rank, amountCents });
  }

  return {
    schemaVersion:
      typeof o['schemaVersion'] === 'number' ? o['schemaVersion'] : 0,
    notRealMoney: o['notRealMoney'] === true,
    currency: typeof o['currency'] === 'string' ? o['currency'] : '',
    lines,
    finalizedAt: o['finalizedAt'],
    payoutJobId:
      typeof o['payoutJobId'] === 'string' ? o['payoutJobId'] : undefined,
  };
}

export function formatDryRunCurrencyCaption(
  doc: ContestDryRunPayoutsDocument,
): string {
  const c = doc.currency.trim();
  if (doc.notRealMoney) {
    return c ? `${c} (estimate, not real money)` : 'Estimated amounts (not real money)';
  }
  return c || 'USD';
}
