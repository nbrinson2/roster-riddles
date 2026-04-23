import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import {
  CONTEST_PUBLIC_GAME_MODE_BIO_BALL,
  mapContestDocumentToPublic,
} from './contest-public.js';

describe('mapContestDocumentToPublic', () => {
  it('maps bio-ball contest and strips metadata', () => {
    const ts = Timestamp.fromMillis(Date.now());
    const row = mapContestDocumentToPublic('c1', {
      schemaVersion: 1,
      status: 'open',
      gameMode: CONTEST_PUBLIC_GAME_MODE_BIO_BALL,
      rulesVersion: 1,
      leagueGamesN: 10,
      windowStart: ts,
      windowEnd: ts,
      title: 'Test',
      metadata: { internal: 'secret' },
    });
    assert.ok(row);
    assert.equal(row.contestId, 'c1');
    assert.ok(!('metadata' in row));
    assert.ok(typeof row.windowStart === 'string');
  });

  it('returns null for non bio-ball', () => {
    const r = mapContestDocumentToPublic('x', {
      status: 'open',
      gameMode: 'other',
      rulesVersion: 1,
      leagueGamesN: 10,
      windowStart: Timestamp.now(),
      windowEnd: Timestamp.now(),
    });
    assert.equal(r, null);
  });
});
