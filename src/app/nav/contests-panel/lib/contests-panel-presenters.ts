import { formatPayoutUsdLabel } from 'src/app/shared/contest/contest-value-prop';
import type { ContestStatus } from 'src/app/shared/models/contest.model';
import {
  humanizeTiePolicyRef,
  type ParsedFinalResultsView,
} from '../shared/contest-results-closure';
import type { ContestListRow, ContestPayoutView } from './contests-panel.types';

export function formatContestWindowLocal(start: Date, end: Date): string {
  const opts: Intl.DateTimeFormatOptions = {
    dateStyle: 'medium',
    timeStyle: 'short',
  };
  return `${start.toLocaleString(undefined, opts)} — ${end.toLocaleString(undefined, opts)}`;
}

export function contestStatusChipLabel(status: ContestStatus): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'scheduled':
      return 'Upcoming';
    case 'scoring':
      return 'Scoring';
    case 'paid':
      return 'Complete';
    case 'cancelled':
      return 'Cancelled';
    default:
      return status;
  }
}

/** Payout row: `PAYOUT:` (when set on doc) · slate size only — no rules or other copy. */
export function formatNonPaidContestCardMeta(row: ContestListRow): string {
  const slate = `${row.leagueGamesN} games in slate`;
  if (
    row.prizePoolCents != null &&
    Number.isFinite(row.prizePoolCents) &&
    row.prizePoolCents >= 0
  ) {
    return `${formatPayoutUsdLabel(row.prizePoolCents)} · ${slate}`;
  }
  return slate;
}

/** Paid: primary payout line + slate only. */
export function formatPaidContestCardMeta(
  row: ContestListRow,
  payout: ContestPayoutView,
): string {
  const slate = `${row.leagueGamesN} games in slate`;
  if (payout.loading || !payout.winnerText) {
    return slate;
  }
  return `${payout.winnerText} · ${slate}`;
}

export function payoutDryRunTransparencyLine(
  px: ContestPayoutView,
  simulatedDryRunCopy = true,
): string | null {
  if (px.loading) {
    return null;
  }
  if (!px.winnerText && px.lineCount === 0) {
    return null;
  }
  const n = px.lineCount;
  const places =
    n === 0
      ? simulatedDryRunCopy
        ? 'No payout lines were published for this dry-run yet.'
        : 'No payout lines were published yet.'
      : simulatedDryRunCopy
        ? `This dry-run lists ${n} paid place${n === 1 ? '' : 's'}.`
        : `This payout lists ${n} place${n === 1 ? '' : 's'}.`;
  const cur = px.currencyLabel.trim();
  const curPart = cur
    ? ` Amounts use ${cur}; figures are rounded to whole cents.`
    : ' Amounts are rounded to whole cents.';
  return `${places}${curPart}`;
}

export function contestSlateSummaryLine(row: ContestListRow): string {
  const n = row.leagueGamesN;
  return `This contest’s slate is ${n} league game${n === 1 ? '' : 's'} (your first ${n} Bio Ball results in the play window, in time order).`;
}

export function contestClosureWhyHeading(
  v: ParsedFinalResultsView | undefined,
): string {
  if (!v || v.loading) {
    return 'Results & tie-breaks';
  }
  if (v.youMissingFromStandings) {
    return 'Why you’re not listed';
  }
  if (v.yourRank === 1) {
    return 'How placements were decided';
  }
  return 'Why didn’t I win?';
}

export function contestClosureWhyLines(
  v: ParsedFinalResultsView | undefined,
  simulatedPayoutCopy = true,
): string[] {
  if (!v || v.loading) {
    return [];
  }
  const lines: string[] = [];
  if (v.yourRank != null && v.yourRank > 1) {
    lines.push(
      simulatedPayoutCopy
        ? 'Simulated payouts go to the top ranks only. Your finish reflects contest wins on this slate, then tie-breakers when wins tie.'
        : 'Prizes go to the top ranks according to the published rules. Your finish reflects contest wins on this slate, then tie-breakers when wins tie.',
    );
  }
  if (v.youMissingFromStandings) {
    lines.push(
      'If you entered, you may be missing because results are still processing, the slate was partial, or the published list excludes your row — see full rules.',
    );
  }
  if (v.tieSummary) {
    lines.push(v.tieSummary);
  }
  const pol = humanizeTiePolicyRef(v.tiePolicyRef);
  if (pol) {
    lines.push(pol);
  }
  return lines;
}

export function contestClosureWhyBlockVisible(args: {
  status: ContestStatus;
  entered: boolean;
  v: ParsedFinalResultsView | undefined;
}): boolean {
  if (args.status !== 'paid') {
    return false;
  }
  if (!args.entered) {
    return false;
  }
  const v = args.v;
  if (!v || v.loading) {
    return false;
  }
  if (v.youMissingFromStandings) {
    return true;
  }
  if (v.yourRank != null && v.yourRank > 1) {
    return true;
  }
  return v.tieSummary != null || v.tiePolicyRef != null;
}

export function engagementCardIconName(status: ContestStatus): string {
  switch (status) {
    case 'open':
      return 'sports_esports';
    case 'scheduled':
      return 'event';
    default:
      return 'rocket_launch';
  }
}
