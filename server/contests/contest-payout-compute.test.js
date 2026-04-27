import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  DRY_RUN_WINNER_AMOUNT_CENTS,
  buildDryRunPayoutLines,
} from './contest-scoring-core.js';
import {
  buildPayoutLinesFromFinal,
  extractStandingsForPayoutFromResultsFinal,
  resolveWinnerAmountCentsFromContest,
} from './contest-payout-compute.js';

const sampleFinal = {
  schemaVersion: 1,
  leagueGamesN: 10,
  standings: [
    {
      rank: 1,
      uid: 'alice',
      wins: 10,
      gamesPlayed: 10,
      losses: 0,
      abandoned: 0,
      tieBreakKey: 'k1',
    },
    {
      rank: 2,
      uid: 'bob',
      wins: 9,
      gamesPlayed: 10,
      losses: 1,
      abandoned: 0,
      tieBreakKey: 'k2',
    },
  ],
};

describe('extractStandingsForPayoutFromResultsFinal (P6-D1)', () => {
  it('extracts rank and uid sorted by rank', () => {
    const rows = extractStandingsForPayoutFromResultsFinal({
      standings: [
        { rank: 2, uid: 'b' },
        { rank: 1, uid: 'a' },
      ],
    });
    assert.deepEqual(rows, [
      { rank: 1, uid: 'a' },
      { rank: 2, uid: 'b' },
    ]);
  });

  it('accepts place when rank missing', () => {
    const rows = extractStandingsForPayoutFromResultsFinal({
      standings: [{ place: 1, uid: 'x' }],
    });
    assert.deepEqual(rows, [{ rank: 1, uid: 'x' }]);
  });

  it('throws when standings missing', () => {
    assert.throws(
      () => extractStandingsForPayoutFromResultsFinal({}),
      /payout_results_final_no_standings/,
    );
  });
});

describe('buildPayoutLinesFromFinal (P6-D1)', () => {
  it('matches buildDryRunPayoutLines when no dryRun and default winner cents', () => {
    const expected = buildDryRunPayoutLines(
      extractStandingsForPayoutFromResultsFinal(sampleFinal),
    );
    const got = buildPayoutLinesFromFinal(sampleFinal, undefined, {});
    assert.deepEqual(got, expected);
  });

  it('single winner row', () => {
    const lines = buildPayoutLinesFromFinal(
      { standings: [{ rank: 1, uid: 'solo' }] },
      undefined,
      {},
    );
    assert.deepEqual(lines, [
      { rank: 1, uid: 'solo', amountCents: DRY_RUN_WINNER_AMOUNT_CENTS },
    ]);
  });

  it('uses contest.winnerAmountCents when set', () => {
    const lines = buildPayoutLinesFromFinal(
      { standings: [{ rank: 1, uid: 'w' }, { rank: 2, uid: 'l' }] },
      undefined,
      { winnerAmountCents: 12345 },
    );
    assert.deepEqual(lines, [
      { rank: 1, uid: 'w', amountCents: 12345 },
      { rank: 2, uid: 'l', amountCents: 0 },
    ]);
  });

  it('zero winner pool', () => {
    const lines = buildPayoutLinesFromFinal(
      { standings: [{ rank: 1, uid: 'w' }] },
      undefined,
      { winnerAmountCents: 0 },
    );
    assert.equal(lines[0].amountCents, 0);
  });

  it('throws when dryRun lines mismatch', () => {
    assert.throws(
      () =>
        buildPayoutLinesFromFinal(
          sampleFinal,
          {
            lines: [
              { rank: 1, uid: 'alice', amountCents: 999 },
              { rank: 2, uid: 'bob', amountCents: 0 },
            ],
          },
          {},
        ),
      /payout_dry_run_line_mismatch/,
    );
  });

  it('accepts matching dryRun cross-check', () => {
    const expected = buildPayoutLinesFromFinal(sampleFinal, undefined, {
      winnerAmountCents: 5000,
    });
    const again = buildPayoutLinesFromFinal(sampleFinal, { lines: expected }, {
      winnerAmountCents: 5000,
    });
    assert.deepEqual(again, expected);
  });

  it('throws when sum exceeds prizePoolCents', () => {
    assert.throws(
      () =>
        buildPayoutLinesFromFinal(sampleFinal, undefined, {
          winnerAmountCents: 50_000,
          prizePoolCents: 1000,
        }),
      /payout_exceeds_prize_pool_cap/,
    );
  });

  it('allows sum equal to prizePoolCents', () => {
    const winner = 8000;
    const lines = buildPayoutLinesFromFinal(
      {
        standings: [
          { rank: 1, uid: 'a' },
          { rank: 2, uid: 'b' },
        ],
      },
      undefined,
      { winnerAmountCents: winner, prizePoolCents: winner },
    );
    assert.equal(
      lines.reduce((s, L) => s + L.amountCents, 0),
      winner,
    );
  });

  it('accepts dryRun lines in non-rank order after normalization', () => {
    const lines = buildPayoutLinesFromFinal(
      { standings: [{ rank: 1, uid: 'x' }, { rank: 2, uid: 'y' }] },
      {
        lines: [
          { rank: 2, uid: 'y', amountCents: 0 },
          { rank: 1, uid: 'x', amountCents: DRY_RUN_WINNER_AMOUNT_CENTS },
        ],
      },
      {},
    );
    assert.equal(lines[0].amountCents, DRY_RUN_WINNER_AMOUNT_CENTS);
  });

  it('throws on leagueGamesN mismatch', () => {
    assert.throws(
      () =>
        buildPayoutLinesFromFinal(
          { ...sampleFinal, leagueGamesN: 10 },
          undefined,
          { leagueGamesN: 9 },
        ),
      /payout_league_games_mismatch/,
    );
  });
});

describe('resolveWinnerAmountCentsFromContest (P6-D1)', () => {
  it('returns undefined for missing or negative', () => {
    assert.equal(resolveWinnerAmountCentsFromContest(undefined), undefined);
    assert.equal(resolveWinnerAmountCentsFromContest({ winnerAmountCents: -1 }), undefined);
    assert.equal(resolveWinnerAmountCentsFromContest({ winnerAmountCents: 'x' }), undefined);
  });

  it('floors finite numbers', () => {
    assert.equal(
      resolveWinnerAmountCentsFromContest({ winnerAmountCents: 99.7 }),
      99,
    );
  });
});
