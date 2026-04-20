import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  assignDenseRanks,
  buildDryRunPayoutLines,
  compareStandingRows,
  DRY_RUN_WINNER_AMOUNT_CENTS,
  tallySlate,
} from './contest-scoring-core.js';

describe('tallySlate', () => {
  it('counts first N results', () => {
    const events = [
      { result: 'won' },
      { result: 'lost' },
      { result: 'won' },
      { result: 'abandoned' },
    ];
    const t = tallySlate(events, 3);
    assert.equal(t.gamesPlayed, 3);
    assert.equal(t.wins, 2);
    assert.equal(t.losses, 1);
    assert.equal(t.abandoned, 0);
  });
});

describe('compareStandingRows (ADR tiers)', () => {
  const N = 10;

  it('full slate beats partial with same wins', () => {
    const full = {
      uid: 'a',
      wins: 5,
      gamesPlayed: 10,
      losses: 5,
      abandoned: 0,
    };
    const partial = {
      uid: 'b',
      wins: 5,
      gamesPlayed: 3,
      losses: 0,
      abandoned: 0,
    };
    assert.equal(compareStandingRows(full, partial, N) < 0, true);
  });

  it('among full slates: fewer losses wins', () => {
    const a = {
      uid: 'x',
      wins: 8,
      gamesPlayed: 10,
      losses: 2,
      abandoned: 0,
    };
    const b = {
      uid: 'y',
      wins: 8,
      gamesPlayed: 10,
      losses: 3,
      abandoned: 0,
    };
    assert.equal(compareStandingRows(a, b, N) < 0, true);
  });

  it('among partials: more games played wins tie on wins', () => {
    const a = {
      uid: 'x',
      wins: 3,
      gamesPlayed: 5,
      losses: 2,
      abandoned: 0,
    };
    const b = {
      uid: 'y',
      wins: 3,
      gamesPlayed: 4,
      losses: 1,
      abandoned: 0,
    };
    assert.equal(compareStandingRows(a, b, N) < 0, true);
  });
});

describe('buildDryRunPayoutLines (Story F1)', () => {
  it('stores numbers only: rank, uid, amountCents', () => {
    const lines = buildDryRunPayoutLines([
      { rank: 1, uid: 'a' },
      { rank: 2, uid: 'b' },
    ]);
    assert.deepEqual(lines, [
      { rank: 1, uid: 'a', amountCents: DRY_RUN_WINNER_AMOUNT_CENTS },
      { rank: 2, uid: 'b', amountCents: 0 },
    ]);
    for (const line of lines) {
      assert.equal(Object.keys(line).sort().join(','), 'amountCents,rank,uid');
    }
  });

  it('respects winnerAmountCents override', () => {
    const lines = buildDryRunPayoutLines([{ rank: 1, uid: 'x' }], {
      winnerAmountCents: 0,
    });
    assert.equal(lines[0].amountCents, 0);
  });
});

describe('assignDenseRanks', () => {
  it('assigns sequential ranks', () => {
    const rows = [
      {
        uid: 'b',
        wins: 1,
        gamesPlayed: 1,
        losses: 0,
        abandoned: 0,
        tieBreakKey: 'uid:b',
        tier: 'partial',
      },
      {
        uid: 'a',
        wins: 2,
        gamesPlayed: 1,
        losses: 0,
        abandoned: 0,
        tieBreakKey: 'uid:a',
        tier: 'partial',
      },
    ];
    assignDenseRanks(rows, 10);
    assert.equal(rows[0].uid, 'a');
    assert.equal(rows[0].rank, 1);
    assert.equal(rows[1].rank, 2);
  });
});
