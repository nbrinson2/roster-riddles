/**
 * Story E3 — structured tie-resolution audit for `results/final.tieResolution`.
 * @see docs/weekly-contests-phase4-adr.md — Mini-league scoring
 */

/** Nested schema for tieResolution (independent of results/final schemaVersion). */
export const TIE_RESOLUTION_AUDIT_SCHEMA_VERSION = 1;

/**
 * Human + machine-readable comparison order (ADR). No randomness; uid is final key.
 */
export function tieResolutionComparisonSteps() {
  return {
    tierA_fullSlate: [
      {
        order: 1,
        field: 'slate_tier',
        rule: 'full_before_partial',
        detail: 'Tier A: gamesPlayed === leagueGamesN before any partial slate.',
      },
      { order: 2, field: 'wins', direction: 'desc' },
      { order: 3, field: 'losses', direction: 'asc' },
      { order: 4, field: 'abandoned', direction: 'asc' },
      {
        order: 5,
        field: 'uid',
        direction: 'asc',
        encoding: 'utf8_string_lexicographic',
        note: 'Final deterministic tie-break; no coin flip.',
      },
    ],
    tierB_partialSlate: [
      {
        order: 1,
        field: 'slate_tier',
        rule: 'full_before_partial',
        detail: 'All partial rows sort after full-slate rows.',
      },
      { order: 2, field: 'wins', direction: 'desc' },
      { order: 3, field: 'gamesPlayed', direction: 'desc' },
      {
        order: 4,
        field: 'uid',
        direction: 'asc',
        encoding: 'utf8_string_lexicographic',
        note: 'Final deterministic tie-break; no coin flip.',
      },
    ],
  };
}

/**
 * Stable key for “stats match before uid” — must stay aligned with {@link compareStandingRows}.
 * @param {{ tier: string, wins: number, losses: number, abandoned: number, gamesPlayed: number }} row
 * @returns {string}
 */
export function statIdentityKey(row) {
  if (row.tier === 'full') {
    return `full:${row.wins}:${row.losses}:${row.abandoned}`;
  }
  return `partial:${row.wins}:${row.gamesPlayed}`;
}

/**
 * Consecutive slices in **sorted** standings that share the same stat identity (only uid differs).
 * @param {Array<{ uid: string, rank: number, tier: string, wins: number, losses: number, abandoned: number, gamesPlayed: number }>} sortedRows
 * @returns {Array<typeof sortedRows>}
 */
export function partitionStatIdentityGroups(sortedRows) {
  /** @type {Array<typeof sortedRows>} */
  const groups = [];
  let i = 0;
  while (i < sortedRows.length) {
    const k = statIdentityKey(sortedRows[i]);
    let j = i + 1;
    while (j < sortedRows.length && statIdentityKey(sortedRows[j]) === k) {
      j += 1;
    }
    const slice = sortedRows.slice(i, j);
    if (slice.length >= 2) {
      groups.push(slice);
    }
    i = j;
  }
  return groups;
}

/**
 * @param {object} opts
 * @param {string} opts.tieBreakPolicy
 * @param {number} opts.leagueGamesN
 * @param {Array<{ uid: string, rank: number, tier: string, wins: number, losses: number, abandoned: number, gamesPlayed: number }>} opts.orderedStandingRows — same order as `standings[]`
 */
export function buildTieResolutionAudit({ tieBreakPolicy, leagueGamesN, orderedStandingRows }) {
  const groups = partitionStatIdentityGroups(orderedStandingRows);

  /** @type {object[]} */
  const statIdentityAudits = groups.map((g) => {
    const first = g[0];
    const tier = first.tier;
    const base = {
      tier,
      ranks: g.map((r) => r.rank),
      uidsInOrder: g.map((r) => r.uid),
      resolvedBy: {
        step: 'uid_utf8_lexicographic_asc',
        randomness: 'none',
      },
    };
    if (tier === 'full') {
      return {
        ...base,
        equalOnStats: {
          wins: first.wins,
          losses: first.losses,
          abandoned: first.abandoned,
          leagueGamesN,
        },
      };
    }
    return {
      ...base,
      equalOnStats: {
        wins: first.wins,
        gamesPlayed: first.gamesPlayed,
      },
    };
  });

  return {
    schemaVersion: TIE_RESOLUTION_AUDIT_SCHEMA_VERSION,
    policyRef: tieBreakPolicy,
    leagueGamesN,
    coinFlipOrRandomTieBreak: false,
    summary:
      'Ordering follows ADR mini-league tiers; within identical stat tuples, rank order is by Firebase Auth uid UTF-8 string ascending (deterministic, no randomness).',
    comparisonSteps: tieResolutionComparisonSteps(),
    statIdentityGroups: statIdentityAudits,
  };
}
