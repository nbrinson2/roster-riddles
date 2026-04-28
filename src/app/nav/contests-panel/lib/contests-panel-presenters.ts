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
        ? 'Estimated payouts — nothing listed yet.'
        : 'No payout lines yet.'
      : simulatedDryRunCopy
        ? `Estimated payouts — ${n} place${n === 1 ? '' : 's'}.`
        : `Payout — ${n} place${n === 1 ? '' : 's'}.`;
  const cur = px.currencyLabel.trim();
  const curPart = cur ? ` (${cur}, rounded to cents)` : ' Rounded to whole cents.';
  return `${places}${curPart}`;
}

/** Tie-break copy for the collapsed paid-card results entry (summary or policy humanization). */
export function formatResultsEntryTieNote(
  v: ParsedFinalResultsView | undefined,
): string | null {
  if (!v || v.loading) {
    return null;
  }
  const summary = v.tieSummary?.trim();
  if (summary) {
    return summary;
  }
  const pol = humanizeTiePolicyRef(v.tiePolicyRef);
  return pol.trim() ? pol : null;
}

/**
 * Collapsed paid card: prize / payout one-liner, including dry-run transparency when simulated.
 */
export function formatResultsEntryPrizeLine(
  row: ContestListRow,
  payout: ContestPayoutView | undefined,
  simulatedDryRunCopy: boolean,
): string {
  const slate = `${row.leagueGamesN} games in slate`;
  if (!payout) {
    return simulatedDryRunCopy
      ? `Estimated payouts loading… · ${slate}`
      : `Payout loading… · ${slate}`;
  }
  if (payout.loading) {
    return simulatedDryRunCopy
      ? `Estimated payouts loading… · ${slate}`
      : `Loading payouts… · ${slate}`;
  }

  const baseMeta = formatPaidContestCardMeta(row, payout);

  if (!simulatedDryRunCopy) {
    return baseMeta;
  }

  const t = payoutDryRunTransparencyLine(payout, true);
  if (!t) {
    return `${baseMeta} · Practice amounts`;
  }
  if (!payout.winnerText && payout.lineCount === 0) {
    return `${slate} · ${t}`;
  }
  return `${baseMeta} · ${t}`;
}

export function contestSlateSummaryLine(row: ContestListRow): string {
  const n = row.leagueGamesN;
  return `Slate: first ${n} Bio Ball result${n === 1 ? '' : 's'} in the window (time order).`;
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
        ? 'Estimated payouts (practice): top ranks only — slate wins, then tie-breaks.'
        : 'Prizes go to top ranks per the rules — slate wins, then tie-breaks.',
    );
  }
  if (v.youMissingFromStandings) {
    lines.push(
      'Not listed? Scoring may lag, slate may be partial, or you’re excluded from the published table — see full rules.',
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
