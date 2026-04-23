/**
 * P1 — Results narrative & closure helpers (paid contests, `results/final`).
 */

import type { ContestStandingRow } from 'src/app/shared/models/contest-results-final.model';

export function initialLoadingResultsView(): ParsedFinalResultsView {
  return {
    loading: true,
    entrants: 0,
    winnerLine: null,
    yourRank: null,
    yourWins: null,
    yourGamesPlayed: null,
    yourLosses: null,
    yourAbandoned: null,
    yourTier: null,
    youMissingFromStandings: false,
    tieSummary: null,
    tiePolicyRef: null,
  };
}

export interface ParsedFinalResultsView {
  loading: boolean;
  entrants: number;
  /** First-place one-liner for narrative. */
  winnerLine: string | null;
  yourRank: number | null;
  yourWins: number | null;
  yourGamesPlayed: number | null;
  yourLosses: number | null;
  yourAbandoned: number | null;
  yourTier: string | null;
  /** True when signed-in user has no row (did not enter or not in published standings). */
  youMissingFromStandings: boolean;
  tieSummary: string | null;
  tiePolicyRef: string | null;
}

function sortStandings(rows: ContestStandingRow[]): ContestStandingRow[] {
  return [...rows].sort((a, b) => {
    if (a.rank !== b.rank) {
      return a.rank - b.rank;
    }
    return String(a.uid).localeCompare(String(b.uid));
  });
}

export function parseFinalResultsForViewer(
  raw: unknown,
  myUid: string | null,
): ParsedFinalResultsView {
  const empty = (missing = true): ParsedFinalResultsView => ({
    loading: false,
    entrants: 0,
    winnerLine: null,
    yourRank: null,
    yourWins: null,
    yourGamesPlayed: null,
    yourLosses: null,
    yourAbandoned: null,
    yourTier: null,
    youMissingFromStandings: missing,
    tieSummary: null,
    tiePolicyRef: null,
  });

  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return empty();
  }
  const o = raw as Record<string, unknown>;
  const standingsRaw = o['standings'];
  if (!Array.isArray(standingsRaw)) {
    return empty();
  }

  const standings: ContestStandingRow[] = [];
  for (const row of standingsRaw) {
    if (row == null || typeof row !== 'object' || Array.isArray(row)) {
      continue;
    }
    const r = row as Record<string, unknown>;
    const uid = typeof r['uid'] === 'string' ? r['uid'] : '';
    const rank =
      typeof r['rank'] === 'number' && Number.isFinite(r['rank'])
        ? r['rank']
        : NaN;
    const wins =
      typeof r['wins'] === 'number' && Number.isFinite(r['wins'])
        ? r['wins']
        : NaN;
    const gamesPlayed =
      typeof r['gamesPlayed'] === 'number' && Number.isFinite(r['gamesPlayed'])
        ? r['gamesPlayed']
        : NaN;
    const losses =
      typeof r['losses'] === 'number' && Number.isFinite(r['losses'])
        ? r['losses']
        : NaN;
    const abandoned =
      typeof r['abandoned'] === 'number' && Number.isFinite(r['abandoned'])
        ? r['abandoned']
        : NaN;
    if (!uid || !Number.isFinite(rank)) {
      continue;
    }
    standings.push({
      rank,
      uid,
      wins: Number.isFinite(wins) ? wins : 0,
      gamesPlayed: Number.isFinite(gamesPlayed) ? gamesPlayed : 0,
      losses: Number.isFinite(losses) ? losses : 0,
      abandoned: Number.isFinite(abandoned) ? abandoned : 0,
      displayName:
        typeof r['displayName'] === 'string' ? r['displayName'] : null,
      tieBreakKey:
        typeof r['tieBreakKey'] === 'string' ? r['tieBreakKey'] : uid,
      tier: r['tier'] === 'full' || r['tier'] === 'partial' ? r['tier'] : undefined,
    });
  }

  const ordered = sortStandings(standings);
  const first = ordered[0];
  let winnerLine: string | null = null;
  if (first) {
    const name =
      first.displayName?.trim() ||
      `Player ${first.uid.slice(0, 6)}…`;
    const tierNote = first.tier === 'partial' ? ' (partial slate)' : '';
    winnerLine = `Winner: ${name} — ${first.wins} wins in slate${tierNote}`;
  }

  let yourRow: ContestStandingRow | undefined;
  if (myUid) {
    yourRow = ordered.find((s) => s.uid === myUid);
  }

  const tieRes = o['tieResolution'];
  let tieSummary: string | null = null;
  let tiePolicyRef: string | null = null;
  if (tieRes && typeof tieRes === 'object' && !Array.isArray(tieRes)) {
    const tr = tieRes as Record<string, unknown>;
    if (typeof tr['summary'] === 'string' && tr['summary'].trim()) {
      tieSummary = tr['summary'].trim();
    }
    if (typeof tr['policyRef'] === 'string' && tr['policyRef'].trim()) {
      tiePolicyRef = tr['policyRef'].trim();
    }
  }
  const policyTop = o['tieBreakPolicy'];
  if (!tiePolicyRef && typeof policyTop === 'string' && policyTop.trim()) {
    tiePolicyRef = policyTop.trim();
  }

  return {
    loading: false,
    entrants: ordered.length,
    winnerLine,
    yourRank: yourRow ? yourRow.rank : null,
    yourWins: yourRow ? yourRow.wins : null,
    yourGamesPlayed: yourRow ? yourRow.gamesPlayed : null,
    yourLosses: yourRow ? yourRow.losses : null,
    yourAbandoned: yourRow ? yourRow.abandoned : null,
    yourTier: yourRow?.tier ?? null,
    youMissingFromStandings: myUid != null && !yourRow,
    tieSummary,
    tiePolicyRef,
  };
}

/** One line for card (e.g. “You placed 3rd of 40 · 7 wins”). */
export function formatYourPlaceCardLine(
  v: ParsedFinalResultsView,
  enteredContest: boolean,
): string | null {
  if (v.loading || v.entrants === 0) {
    return null;
  }
  if (!enteredContest) {
    return 'You didn’t enter this contest.';
  }
  if (v.youMissingFromStandings || v.yourRank == null) {
    return 'You’re not listed in the published standings for this contest.';
  }
  const w = v.yourWins ?? 0;
  const parts = [
    `You placed ${formatOrdinalRank(v.yourRank)} of ${v.entrants}`,
    `${w} win${w === 1 ? '' : 's'} in slate`,
  ];
  if (v.yourTier === 'partial') {
    parts.push('partial slate');
  }
  return parts.join(' · ');
}

/** e.g. 3 → `"3rd"` for UI copy. */
export function formatOrdinalRank(n: number): string {
  const j = n % 10;
  const k = n % 100;
  if (j === 1 && k !== 11) {
    return `${n}st`;
  }
  if (j === 2 && k !== 12) {
    return `${n}nd`;
  }
  if (j === 3 && k !== 13) {
    return `${n}rd`;
  }
  return `${n}th`;
}

export function humanizeTiePolicyRef(ref: string | null): string {
  if (!ref) {
    return '';
  }
  if (ref === 'mini_league_wins_desc_losses_asc_uid_asc') {
    return 'Rankings use contest wins first, then fewer losses, fewer abandons, then a stable account id tie-break (see full rules).';
  }
  return `Tie policy reference: ${ref}`;
}
