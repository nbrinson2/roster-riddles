/**
 * Phase 6 Story P6-D1 — pure payout line builder from frozen `results/final` (+ optional `payouts/dryRun` cross-check).
 * Delegates amount logic to {@link buildDryRunPayoutLines} for parity with scoring dry-run (Story F1).
 * @see docs/weekly-contests/weekly-contests-phase6-payouts-jira.md (P6-D1)
 */
import {
  buildDryRunPayoutLines,
  DRY_RUN_WINNER_AMOUNT_CENTS,
} from './contest-scoring-core.js';

/**
 * @param {unknown} x
 * @returns {x is Record<string, unknown>}
 */
function isRecord(x) {
  return x != null && typeof x === 'object' && !Array.isArray(x);
}

/**
 * Integer cents for first-place payout from contest doc, when set.
 * @param {unknown} contest — `contests/{contestId}` data
 * @returns {number | undefined}
 */
export function resolveWinnerAmountCentsFromContest(contest) {
  if (!isRecord(contest)) {
    return undefined;
  }
  const w = contest.winnerAmountCents;
  if (typeof w !== 'number' || !Number.isFinite(w)) {
    return undefined;
  }
  const n = Math.floor(w);
  if (n < 0) {
    return undefined;
  }
  return n;
}

/**
 * @param {unknown} row — one `results/final.standings[]` element
 * @returns {{ rank: number; uid: string } | null}
 */
function standingRowToPayoutInput(row) {
  if (!isRecord(row)) {
    return null;
  }
  const uid = typeof row.uid === 'string' ? row.uid.trim() : '';
  if (uid === '') {
    return null;
  }
  let rank = row.rank;
  if (typeof rank !== 'number' || !Number.isFinite(rank)) {
    const place = row.place;
    if (typeof place === 'number' && Number.isFinite(place)) {
      rank = place;
    } else {
      return null;
    }
  }
  rank = Math.floor(rank);
  if (rank < 1) {
    return null;
  }
  return { rank, uid };
}

/**
 * @param {unknown} resultsFinal — `results/final` document fields (must include `standings`)
 * @returns {{ rank: number; uid: string }[]}
 */
export function extractStandingsForPayoutFromResultsFinal(resultsFinal) {
  if (!isRecord(resultsFinal)) {
    throw new Error('payout_results_final_invalid');
  }
  const st = resultsFinal.standings;
  if (!Array.isArray(st) || st.length === 0) {
    throw new Error('payout_results_final_no_standings');
  }
  /** @type {{ rank: number; uid: string }[]} */
  const out = [];
  for (const row of st) {
    const conv = standingRowToPayoutInput(row);
    if (!conv) {
      throw new Error('payout_results_final_bad_row');
    }
    out.push(conv);
  }
  out.sort((a, b) => a.rank - b.rank || a.uid.localeCompare(b.uid));
  return out;
}

/**
 * @param {{ rank: number; uid: string; amountCents: number }[]} computed
 * @param {unknown} dryRun — optional `payouts/dryRun` document data
 */
function assertDryRunCrossCheck(computed, dryRun) {
  if (dryRun == null) {
    return;
  }
  if (!isRecord(dryRun)) {
    throw new Error('payout_dry_run_invalid');
  }
  const lines = dryRun.lines;
  if (!Array.isArray(lines)) {
    return;
  }
  if (lines.length === 0) {
    if (computed.length > 0) {
      throw new Error('payout_dry_run_line_count_mismatch');
    }
    return;
  }
  /** @type {{ rank: number; uid: string; amountCents: number }[]} */
  const normalized = [];
  for (const line of lines) {
    if (!isRecord(line)) {
      throw new Error('payout_dry_run_bad_line');
    }
    const uid = typeof line.uid === 'string' ? line.uid.trim() : '';
    let rank = line.rank;
    if (typeof rank !== 'number' || !Number.isFinite(rank)) {
      const place = line.place;
      if (typeof place === 'number' && Number.isFinite(place)) {
        rank = place;
      } else {
        throw new Error('payout_dry_run_bad_line');
      }
    }
    rank = Math.floor(rank);
    const ac = line.amountCents;
    if (typeof ac !== 'number' || !Number.isFinite(ac) || Math.floor(ac) !== ac) {
      throw new Error('payout_dry_run_bad_line');
    }
    if (uid === '' || rank < 1) {
      throw new Error('payout_dry_run_bad_line');
    }
    normalized.push({ rank, uid, amountCents: ac });
  }
  normalized.sort((a, b) => a.rank - b.rank || a.uid.localeCompare(b.uid));
  if (normalized.length !== computed.length) {
    throw new Error('payout_dry_run_line_count_mismatch');
  }
  for (let i = 0; i < computed.length; i++) {
    const a = computed[i];
    const b = normalized[i];
    if (a.rank !== b.rank || a.uid !== b.uid || a.amountCents !== b.amountCents) {
      throw new Error('payout_dry_run_line_mismatch');
    }
  }
}

/**
 * @param {{ rank: number; uid: string; amountCents: number }[]} lines
 * @param {unknown} contest
 */
function assertWithinPrizePoolCap(lines, contest) {
  if (!isRecord(contest)) {
    return;
  }
  const cap = contest.prizePoolCents;
  if (typeof cap !== 'number' || !Number.isFinite(cap) || cap < 0) {
    return;
  }
  const sum = lines.reduce((s, L) => s + L.amountCents, 0);
  if (sum > Math.floor(cap)) {
    throw new Error('payout_exceeds_prize_pool_cap');
  }
}

/**
 * @param {unknown} resultsFinal
 * @param {unknown} contest
 */
function assertLeagueGamesConsistent(resultsFinal, contest) {
  if (!isRecord(resultsFinal) || !isRecord(contest)) {
    return;
  }
  const a = resultsFinal.leagueGamesN;
  const b = contest.leagueGamesN;
  if (typeof a !== 'number' || !Number.isFinite(a)) {
    return;
  }
  if (typeof b !== 'number' || !Number.isFinite(b)) {
    return;
  }
  if (Math.floor(a) !== Math.floor(b)) {
    throw new Error('payout_league_games_mismatch');
  }
}

/**
 * Ordered `{ rank, uid, amountCents }[]` for prize execution (integer cents; rank 1 gets prize).
 *
 * @param {unknown} resultsFinal — `results/final` payload (must include `standings`)
 * @param {unknown} [dryRun] — optional `payouts/dryRun` doc; when `lines` present, must match computed lines exactly (sorted by rank, uid)
 * @param {unknown} [contest] — `contests/{contestId}` payload (`winnerAmountCents`, optional `prizePoolCents`, `leagueGamesN`)
 * @returns {{ rank: number; uid: string; amountCents: number }[]}
 */
export function buildPayoutLinesFromFinal(resultsFinal, dryRun, contest) {
  assertLeagueGamesConsistent(resultsFinal, contest);
  const standings = extractStandingsForPayoutFromResultsFinal(resultsFinal);
  const winnerCents =
    resolveWinnerAmountCentsFromContest(contest) ?? DRY_RUN_WINNER_AMOUNT_CENTS;
  const computed = buildDryRunPayoutLines(standings, {
    winnerAmountCents: winnerCents,
  });
  assertDryRunCrossCheck(computed, dryRun);
  assertWithinPrizePoolCap(computed, contest);
  return computed;
}
