import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  buildTieResolutionAudit,
  partitionStatIdentityGroups,
  statIdentityKey,
} from './contest-scoring-tie-audit.js';

describe('statIdentityKey', () => {
  it('full tier key uses wins, losses, abandoned', () => {
    assert.equal(
      statIdentityKey({
        tier: 'full',
        wins: 8,
        losses: 2,
        abandoned: 0,
        gamesPlayed: 10,
      }),
      'full:8:2:0',
    );
  });

  it('partial tier key uses wins and gamesPlayed', () => {
    assert.equal(
      statIdentityKey({
        tier: 'partial',
        wins: 3,
        losses: 1,
        abandoned: 1,
        gamesPlayed: 5,
      }),
      'partial:3:5',
    );
  });
});

describe('partitionStatIdentityGroups', () => {
  it('groups consecutive stat-identical rows (uid differs)', () => {
    const rows = [
      {
        rank: 1,
        uid: 'alice',
        tier: 'full',
        wins: 8,
        losses: 2,
        abandoned: 0,
        gamesPlayed: 10,
      },
      {
        rank: 2,
        uid: 'bob',
        tier: 'full',
        wins: 8,
        losses: 2,
        abandoned: 0,
        gamesPlayed: 10,
      },
      {
        rank: 3,
        uid: 'carol',
        tier: 'full',
        wins: 7,
        losses: 3,
        abandoned: 0,
        gamesPlayed: 10,
      },
    ];
    const groups = partitionStatIdentityGroups(rows);
    assert.equal(groups.length, 1);
    assert.equal(groups[0].length, 2);
    assert.deepEqual(
      groups[0].map((r) => r.uid),
      ['alice', 'bob'],
    );
  });

  it('returns empty when no stat ties', () => {
    const rows = [
      {
        rank: 1,
        uid: 'a',
        tier: 'full',
        wins: 9,
        losses: 1,
        abandoned: 0,
        gamesPlayed: 10,
      },
      {
        rank: 2,
        uid: 'b',
        tier: 'full',
        wins: 8,
        losses: 2,
        abandoned: 0,
        gamesPlayed: 10,
      },
    ];
    assert.equal(partitionStatIdentityGroups(rows).length, 0);
  });
});

describe('buildTieResolutionAudit', () => {
  it('includes statIdentityGroups when two full slates match on stats', () => {
    const audit = buildTieResolutionAudit({
      tieBreakPolicy: 'mini_league_wins_desc_losses_asc_uid_asc',
      leagueGamesN: 10,
      orderedStandingRows: [
        {
          rank: 1,
          uid: 'aaa',
          tier: 'full',
          wins: 8,
          losses: 2,
          abandoned: 0,
          gamesPlayed: 10,
        },
        {
          rank: 2,
          uid: 'zzz',
          tier: 'full',
          wins: 8,
          losses: 2,
          abandoned: 0,
          gamesPlayed: 10,
        },
      ],
    });
    assert.equal(audit.schemaVersion, 1);
    assert.equal(audit.coinFlipOrRandomTieBreak, false);
    assert.equal(audit.statIdentityGroups.length, 1);
    const g = audit.statIdentityGroups[0];
    assert.equal(g.tier, 'full');
    assert.deepEqual(g.uidsInOrder, ['aaa', 'zzz']);
    assert.deepEqual(g.equalOnStats, {
      wins: 8,
      losses: 2,
      abandoned: 0,
      leagueGamesN: 10,
    });
    assert.equal(g.resolvedBy.step, 'uid_utf8_lexicographic_asc');
  });
});
