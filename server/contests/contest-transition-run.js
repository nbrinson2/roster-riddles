/**
 * Shared Firestore transaction for weekly contest status changes (Story D1 / F2).
 * Used by operator-secret route and Firebase-admin UI route.
 */
import { FieldValue } from 'firebase-admin/firestore';
import {
  evaluateTransitionGuards,
  isContestStatus,
} from './contest-transitions.js';

/**
 * @param {unknown} c
 * @returns {c is Record<string, unknown>}
 */
function isRecord(c) {
  return c != null && typeof c === 'object' && !Array.isArray(c);
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {object} opts
 * @param {string} opts.contestId
 * @param {'open'|'scheduled'|'scoring'|'paid'|'cancelled'} opts.targetTo
 * @param {boolean} [opts.force]
 * @param {number} opts.nowMs
 */
export async function runContestStatusTransition(db, opts) {
  const { contestId, targetTo, force = false, nowMs } = opts;
  const ref = db.doc(`contests/${contestId}`);

  return db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) {
      return { type: 'missing' };
    }
    const data = snap.data();
    if (!isRecord(data)) {
      return { type: 'bad_doc' };
    }

    const curRaw = data.status;
    if (!isContestStatus(curRaw)) {
      return { type: 'bad_status' };
    }
    const cur = curRaw;

    if (cur === targetTo) {
      return { type: 'idempotent', status: cur };
    }

    const g = evaluateTransitionGuards({
      from: cur,
      to: targetTo,
      contestData: data,
      nowMs,
      force,
    });
    if (!g.ok) {
      return {
        type: 'guard',
        code: g.code,
        message: g.message,
        from: cur,
      };
    }

    const clearDryRunArtifacts =
      cur === 'paid' &&
      (targetTo === 'cancelled' || targetTo === 'scoring') &&
      force === true;

    if (clearDryRunArtifacts) {
      const resultsRef = db.doc(`contests/${contestId}/results/final`);
      const payoutsRef = db.doc(`contests/${contestId}/payouts/dryRun`);
      t.delete(resultsRef);
      t.delete(payoutsRef);
    }

    t.update(ref, {
      status: targetTo,
      updatedAt: FieldValue.serverTimestamp(),
    });

    return {
      type: 'updated',
      from: cur,
      to: targetTo,
      dryRunArtifactsCleared: clearDryRunArtifacts,
    };
  });
}
