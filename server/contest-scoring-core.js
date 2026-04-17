/**
 * Mini-league contest scoring (Story E2) — pure logic for tests and job.
 * @see docs/weekly-contests-phase4-adr.md — Mini-league scoring
 */

export const TIE_BREAK_POLICY =
  'mini_league_wins_desc_losses_asc_uid_asc';

export const EVENT_SOURCE = 'gameplayEvents_first_n_bio_ball_after_join';

/**
 * @typedef {{ result: 'won'|'lost'|'abandoned' }} SlateEventLike
 */

/**
 * @param {SlateEventLike[]} slateInOrder — first `leagueGamesN` qualifying events, `createdAt` asc.
 * @param {number} leagueGamesN
 */
export function tallySlate(slateInOrder, leagueGamesN) {
  const slice = slateInOrder.slice(0, leagueGamesN);
  let wins = 0;
  let losses = 0;
  let abandoned = 0;
  for (const e of slice) {
    if (e.result === 'won') {
      wins += 1;
    } else if (e.result === 'lost') {
      losses += 1;
    } else if (e.result === 'abandoned') {
      abandoned += 1;
    }
  }
  return {
    wins,
    losses,
    abandoned,
    gamesPlayed: slice.length,
  };
}

/**
 * @param {object} a
 * @param {object} b
 * @param {number} leagueGamesN
 * @returns {number}
 */
export function compareStandingRows(a, b, leagueGamesN) {
  const fullA = a.gamesPlayed === leagueGamesN;
  const fullB = b.gamesPlayed === leagueGamesN;

  if (fullA && !fullB) {
    return -1;
  }
  if (!fullA && fullB) {
    return 1;
  }

  if (fullA && fullB) {
    if (b.wins !== a.wins) {
      return b.wins - a.wins;
    }
    if (a.losses !== b.losses) {
      return a.losses - b.losses;
    }
    if (a.abandoned !== b.abandoned) {
      return a.abandoned - b.abandoned;
    }
    return String(a.uid).localeCompare(String(b.uid));
  }

  if (b.wins !== a.wins) {
    return b.wins - a.wins;
  }
  if (b.gamesPlayed !== a.gamesPlayed) {
    return b.gamesPlayed - a.gamesPlayed;
  }
  return String(a.uid).localeCompare(String(b.uid));
}

/**
 * Stable sort then assign dense ranks 1..n.
 * @param {object[]} rows — mutable; sorted in place
 * @param {number} leagueGamesN
 * @returns {object[]} rows with `rank` set
 */
export function assignDenseRanks(rows, leagueGamesN) {
  rows.sort((a, b) => compareStandingRows(a, b, leagueGamesN));
  rows.forEach((row, i) => {
    row.rank = i + 1;
  });
  return rows;
}
