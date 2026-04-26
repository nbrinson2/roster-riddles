import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { Timestamp } from 'firebase-admin/firestore';
import { computeStandingsForEntryDocs } from './contest-standings-compute.js';

function ts(ms) {
  return Timestamp.fromMillis(ms);
}

/**
 * Minimal Firestore mock: each uid maps to ordered gameplay event payloads
 * (`{ result }` only — matches what `loadQualifyingSlate` reads).
 *
 * @param {Record<string, { result: string }[]>} eventsByUid
 */
function mockDb(eventsByUid) {
  return {
    collection: (top) => {
      if (top !== 'users') {
        throw new Error(`unexpected collection ${top}`);
      }
      return {
        doc: (uid) => ({
          collection: (sub) => {
            if (sub !== 'gameplayEvents') {
              throw new Error(`unexpected sub ${sub}`);
            }
            return {
              where() {
                return this;
              },
              orderBy() {
                return this;
              },
              limit() {
                return this;
              },
              async get() {
                const list = eventsByUid[uid] ?? [];
                return {
                  forEach(cb) {
                    list.forEach((data, i) => {
                      cb({
                        id: `ev_${uid}_${i}`,
                        data: () => data,
                      });
                    });
                  },
                };
              },
            };
          },
        }),
      };
    },
  };
}

function entryDoc(uid, joinedAtMs, displayNameSnapshot = null) {
  return {
    id: uid,
    data: () => ({
      joinedAt: ts(joinedAtMs),
      displayNameSnapshot,
    }),
  };
}

describe('computeStandingsForEntryDocs', () => {
  it('orders full slates by wins then losses (ADR)', async () => {
    const ws = ts(0);
    const we = ts(10_000_000);
    const leagueGamesN = 2;
    const db = mockDb({
      a: [{ result: 'won' }, { result: 'lost' }],
      b: [{ result: 'won' }, { result: 'won' }],
    });
    const standings = await computeStandingsForEntryDocs(
      /** @type {import('firebase-admin/firestore').Firestore} */ (db),
      { windowStart: ws, windowEnd: we, leagueGamesN },
      [entryDoc('a', 0, 'A'), entryDoc('b', 0, 'B')],
    );
    assert.equal(standings.length, 2);
    assert.equal(standings[0].uid, 'b');
    assert.equal(standings[0].rank, 1);
    assert.equal(standings[0].wins, 2);
    assert.equal(standings[1].uid, 'a');
    assert.equal(standings[1].rank, 2);
    assert.equal(standings[1].wins, 1);
  });

  it('ranks partial slate after full slate with same wins', async () => {
    const ws = ts(0);
    const we = ts(10_000_000);
    const leagueGamesN = 3;
    const db = mockDb({
      full: [{ result: 'won' }, { result: 'won' }, { result: 'lost' }],
      part: [{ result: 'won' }, { result: 'won' }],
    });
    const standings = await computeStandingsForEntryDocs(
      /** @type {import('firebase-admin/firestore').Firestore} */ (db),
      { windowStart: ws, windowEnd: we, leagueGamesN },
      [entryDoc('part', 0), entryDoc('full', 0)],
    );
    assert.equal(standings[0].uid, 'full');
    assert.equal(standings[0].tier, 'full');
    assert.equal(standings[1].uid, 'part');
    assert.equal(standings[1].tier, 'partial');
  });

  it('skips entries with invalid joinedAt', async () => {
    const ws = ts(0);
    const we = ts(10_000_000);
    const leagueGamesN = 1;
    const db = mockDb({
      ok: [{ result: 'won' }],
    });
    const skipped = [];
    const standings = await computeStandingsForEntryDocs(
      /** @type {import('firebase-admin/firestore').Firestore} */ (db),
      { windowStart: ws, windowEnd: we, leagueGamesN },
      [
        {
          id: 'bad',
          data: () => ({ joinedAt: 'not-a-timestamp' }),
        },
        entryDoc('ok', 0),
      ],
      {
        onSkipEntry: (d) => skipped.push(d),
      },
    );
    assert.equal(standings.length, 1);
    assert.equal(standings[0].uid, 'ok');
    assert.equal(skipped.length, 1);
    assert.equal(skipped[0].uid, 'bad');
  });

  it('returns empty standings when there are no entries', async () => {
    const ws = ts(0);
    const we = ts(10_000_000);
    const db = mockDb({});
    const standings = await computeStandingsForEntryDocs(
      /** @type {import('firebase-admin/firestore').Firestore} */ (db),
      { windowStart: ws, windowEnd: we, leagueGamesN: 3 },
      [],
    );
    assert.deepEqual(standings, []);
  });

  it('handles a single entrant', async () => {
    const ws = ts(0);
    const we = ts(10_000_000);
    const leagueGamesN = 2;
    const db = mockDb({
      solo: [{ result: 'won' }, { result: 'lost' }],
    });
    const standings = await computeStandingsForEntryDocs(
      /** @type {import('firebase-admin/firestore').Firestore} */ (db),
      { windowStart: ws, windowEnd: we, leagueGamesN },
      [entryDoc('solo', 0, 'Solo')],
    );
    assert.equal(standings.length, 1);
    assert.equal(standings[0].rank, 1);
    assert.equal(standings[0].uid, 'solo');
    assert.equal(standings[0].wins, 1);
    assert.equal(standings[0].gamesPlayed, 2);
    assert.equal(standings[0].tier, 'full');
  });

  it('breaks full-slate ties by uid ascending (ADR / E2 parity)', async () => {
    const ws = ts(0);
    const we = ts(10_000_000);
    const leagueGamesN = 3;
    const won3 = [{ result: 'won' }, { result: 'won' }, { result: 'won' }];
    const db = mockDb({
      mmm: won3,
      nnn: won3,
      aaa: won3,
    });
    const standings = await computeStandingsForEntryDocs(
      /** @type {import('firebase-admin/firestore').Firestore} */ (db),
      { windowStart: ws, windowEnd: we, leagueGamesN },
      [entryDoc('mmm', 0), entryDoc('nnn', 0), entryDoc('aaa', 0)],
    );
    assert.deepEqual(
      standings.map((s) => s.uid),
      ['aaa', 'mmm', 'nnn'],
    );
    assert.deepEqual(
      standings.map((s) => s.rank),
      [1, 2, 3],
    );
  });

  it('is deterministic for identical frozen inputs (live vs E2)', async () => {
    const ws = ts(100);
    const we = ts(9_000_000);
    const leagueGamesN = 2;
    const entries = [entryDoc('p1', 50), entryDoc('p2', 60)];
    const db = mockDb({
      p1: [{ result: 'won' }, { result: 'won' }],
      p2: [{ result: 'won' }, { result: 'lost' }],
    });
    const firestore = /** @type {import('firebase-admin/firestore').Firestore} */ (db);
    const timing = { windowStart: ws, windowEnd: we, leagueGamesN };
    const a = await computeStandingsForEntryDocs(firestore, timing, entries);
    const b = await computeStandingsForEntryDocs(firestore, timing, entries);
    assert.deepEqual(a, b);
  });
});
