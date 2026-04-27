import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  collectSucceededPrizeTransferLinesForVoid,
  runContestVoidAfterPrizeAuthorized,
} from './contest-void-after-prize.job.js';

describe('collectSucceededPrizeTransferLinesForVoid (P6-F1)', () => {
  it('collects succeeded lines with tr ids and dedupes transfer id', () => {
    const lines = [
      { rank: 1, uid: 'u1', amountCents: 100, status: 'succeeded', stripeTransferId: 'tr_a' },
      { rank: 1, uid: 'u1', amountCents: 100, status: 'succeeded', stripeTransferId: 'tr_a' },
      { rank: 2, uid: 'u2', amountCents: 0, status: 'skipped', stripeTransferId: null },
      { rank: 3, uid: 'u3', amountCents: 50, status: 'failed', stripeTransferId: 'tr_b' },
    ];
    const got = collectSucceededPrizeTransferLinesForVoid(lines);
    assert.equal(got.length, 1);
    assert.equal(got[0].stripeTransferId, 'tr_a');
    assert.equal(got[0].amountCents, 100);
  });
});

describe('runContestVoidAfterPrizeAuthorized (P6-F1)', () => {
  it('reversal succeeds: calls Stripe then writes ledger and cancels in one transaction', async () => {
    /** @type {{ tr: string; amount?: number }[]} */
    const reversalCalls = [];
    const stripe = {
      transfers: {
        /**
         * @param {string} tr
         * @param {{ amount?: number }} params
         */
        createReversal: async (tr, params) => {
          reversalCalls.push({ tr, amount: params.amount });
          return { id: `trr_${tr.slice(3)}`, amount: params.amount ?? 0 };
        },
      },
    };

    /** @type {Record<string, unknown>} */
    const store = {
      'contests/c1': { status: 'paid', gameMode: 'bio-ball' },
      'contests/c1/payouts/final': {
        schemaVersion: 1,
        notRealMoney: false,
        scoringJobId: 'job_s',
        payoutJobId: 'job_p',
        lines: [
          {
            rank: 1,
            uid: 'winner',
            amountCents: 5000,
            status: 'succeeded',
            stripeTransferId: 'tr_voidtest',
          },
        ],
      },
    };

    /** @type {unknown[][]} */
    const txOps = [];

    /**
     * @param {string} path
     */
    function doc(path) {
      return {
        _path: path,
        async get() {
          const v = store[path];
          if (!v) {
            return { exists: false, data: () => undefined };
          }
          return { exists: true, data: () => ({ ...v }) };
        },
      };
    }

    const db = {
      doc: (/** @type {string} */ path) => doc(path),
      runTransaction: async (
        /** @param {(tx: import('firebase-admin/firestore').Transaction) => Promise<void>} */ fn,
      ) => {
        const tx = {
          get: async (/** @type {{ _path: string }} */ r) => doc(r._path).get(),
          set: (
            /** @type {{ _path: string }} */ r,
            /** @type {Record<string, unknown>} */ data,
            /** @type {unknown} */ _opts,
          ) => {
            txOps.push(['set', r._path, data]);
          },
          update: (/** @type {{ _path: string }} */ r, /** @type {Record<string, unknown>} */ data) => {
            txOps.push(['update', r._path, data]);
          },
          delete: (/** @type {{ _path: string }} */ r) => {
            txOps.push(['delete', r._path]);
          },
        };
        await fn(/** @type {import('firebase-admin/firestore').Transaction} */ (tx));
      },
    };

    const result = await runContestVoidAfterPrizeAuthorized({
      db: /** @type {import('firebase-admin/firestore').Firestore} */ (db),
      stripe: /** @type {import('stripe').default} */ (stripe),
      contestId: 'c1',
      requestId: 'req-test',
      actorUid: 'admin1',
      reason: 'rollback mistaken payout',
      voidJobId: 'void_test_job',
    });

    assert.equal(result.ok, true);
    if (!result.ok) {
      return;
    }
    assert.equal(reversalCalls.length, 1);
    assert.equal(reversalCalls[0].tr, 'tr_voidtest');
    assert.equal(reversalCalls[0].amount, 5000);

    const ledgerSets = txOps.filter((o) => o[0] === 'set' && String(o[1]).startsWith('ledgerEntries/'));
    assert.equal(ledgerSets.length, 1);
    const ledgerPayload = /** @type {Record<string, unknown>} */ (ledgerSets[0][2]);
    assert.equal(ledgerPayload.lineType, 'prize_transfer_reversal');
    assert.equal(ledgerPayload.direction, 'credit');
    assert.equal(ledgerPayload.amountCents, 5000);
    assert.equal(ledgerPayload.source, 'admin_adjustment');

    const updates = txOps.filter((o) => o[0] === 'update');
    assert.ok(updates.some((u) => u[1] === 'contests/c1' && u[2].status === 'cancelled'));
    assert.ok(txOps.some((o) => o[0] === 'delete' && o[1] === 'contests/c1/payouts/final'));
  });
});
