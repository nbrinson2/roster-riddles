import type { ContestPayoutFinalAggregateStatus } from 'src/app/shared/models/contest-payout-final.model';
import type {
  ContestListRow,
  ContestPayoutView,
  ContestStripePrizeFinalState,
} from './contests-panel.types';

export interface StripePrizeRailCopy {
  headline: string;
  detail: string;
}

/** Contest may use Stripe for entry and/or Connect prize rails — hide timing UX when neither applies. */
export function contestLikelyUsesStripeForPrizes(row: ContestListRow): boolean {
  const fee =
    row.entryFeeCents != null &&
    Number.isFinite(row.entryFeeCents) &&
    row.entryFeeCents > 0;
  const pool =
    row.prizePoolCents != null &&
    Number.isFinite(row.prizePoolCents) &&
    row.prizePoolCents > 0;
  return fee || pool;
}

/** Fields read from `payouts/final` when the document exists. */
export function parseStripePrizeFinalDocFields(raw: unknown): Pick<
  ContestStripePrizeFinalState,
  'notRealMoney' | 'aggregateStatus' | 'anyLinePendingOrProcessing' | 'hasLines'
> {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return {
      notRealMoney: false,
      aggregateStatus: undefined,
      anyLinePendingOrProcessing: false,
      hasLines: false,
    };
  }
  const o = raw as Record<string, unknown>;
  const linesRaw = o['lines'];
  const lines = Array.isArray(linesRaw) ? linesRaw : [];
  let anyLinePendingOrProcessing = false;
  for (const line of lines) {
    if (line == null || typeof line !== 'object' || Array.isArray(line)) {
      continue;
    }
    const st = String((line as Record<string, unknown>)['status'] ?? '')
      .trim()
      .toLowerCase();
    if (st === 'pending' || st === 'processing') {
      anyLinePendingOrProcessing = true;
      break;
    }
  }
  const aggRaw = o['aggregateStatus'];
  const aggregateStatus =
    typeof aggRaw === 'string' && aggRaw.trim()
      ? (aggRaw.trim() as ContestPayoutFinalAggregateStatus)
      : undefined;
  return {
    notRealMoney: o['notRealMoney'] === true,
    aggregateStatus,
    anyLinePendingOrProcessing,
    hasLines: lines.length > 0,
  };
}

/**
 * When payments are live (not simulated UI), show Stripe prize timing: processing vs paid-out.
 */
export function stripePrizeRailCopy(
  row: ContestListRow,
  payout: ContestPayoutView | undefined,
  contestsPaymentsEnabled: boolean,
  simulatedContestsUiEnabled: boolean,
): StripePrizeRailCopy | null {
  if (
    !contestsPaymentsEnabled ||
    simulatedContestsUiEnabled ||
    row.status !== 'paid' ||
    !contestLikelyUsesStripeForPrizes(row)
  ) {
    return null;
  }

  const sf = payout?.stripePrizeFinal;
  if (!sf || sf.loading) {
    return {
      headline: 'Prize processing',
      detail:
        'After standings are final, prizes move through Stripe (Connect). Most transfers finish within minutes; some banks take 1–3 business days.',
    };
  }

  if (sf.notRealMoney) {
    return null;
  }

  if (sf.docExists === false) {
    return {
      headline: 'Prize processing',
      detail:
        'Prize transfers begin once payouts run. Stripe Connect transfers usually complete within minutes; some banks take 1–3 business days.',
    };
  }

  const agg = sf.aggregateStatus;
  const pending = sf.anyLinePendingOrProcessing === true;

  if (agg === 'partial_failure' || agg === 'failed') {
    return {
      headline: 'Prize payout issue',
      detail:
        'Some Stripe transfers may still be pending or failed. Winners should check their connected account; contact support if something looks wrong.',
    };
  }

  if (agg === 'succeeded' && !pending) {
    return {
      headline: 'Prizes paid',
      detail:
        'Stripe transfers for this contest are complete. Funds reach winners’ bank accounts on their bank’s usual timing.',
    };
  }

  return {
    headline: 'Prize processing',
    detail:
      'Stripe is sending prizes to winners’ connected accounts. Most transfers finish within minutes; some banks take 1–3 business days.',
  };
}
