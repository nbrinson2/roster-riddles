import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { deleteContestLiveStandingsSubtree } from './contest-live-standings-artifacts.js';

describe('deleteContestLiveStandingsSubtree', () => {
  it('returns 0 when subcollection is empty', async () => {
    const db = {
      collection: () => ({
        limit: () => ({
          get: async () => ({
            empty: true,
            docs: [],
            size: 0,
          }),
        }),
      }),
    };
    const n = await deleteContestLiveStandingsSubtree(
      /** @type {import('firebase-admin/firestore').Firestore} */ (db),
      'c1',
    );
    assert.equal(n, 0);
  });

  it('deletes one batch of docs', async () => {
    const refs = [{ ref: { id: 'a' } }, { ref: { id: 'b' } }];
    const batch = {
      deletes: /** @type {unknown[]} */ ([]),
      delete(r) {
        this.deletes.push(r);
      },
      commit: async () => {},
    };
    let getCalls = 0;
    const db = {
      batch: () => batch,
      collection: () => ({
        limit: () => ({
          get: async () => {
            getCalls += 1;
            if (getCalls === 1) {
              return {
                empty: false,
                docs: refs,
                size: 2,
              };
            }
            return { empty: true, docs: [], size: 0 };
          },
        }),
      }),
    };
    const n = await deleteContestLiveStandingsSubtree(
      /** @type {import('firebase-admin/firestore').Firestore} */ (db),
      'c1',
    );
    assert.equal(n, 2);
    assert.equal(batch.deletes.length, 2);
  });
});
