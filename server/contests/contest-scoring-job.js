/**
 * Contest scoring job — loads entries + gameplay events, writes B3 artifacts, moves scoring→paid.
 * Story E2.
 */
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { randomBytes } from 'node:crypto';
import { ensureFirebaseAdminInitialized } from '../lib/firebase-admin-init.js';
import { buildPayoutLinesFromFinal } from './contest-payout-compute.js';
import { EVENT_SOURCE, TIE_BREAK_POLICY } from './contest-scoring-core.js';
import { computeStandingsForEntryDocs } from './contest-standings-compute.js';
import { buildTieResolutionAudit } from './contest-scoring-tie-audit.js';
import { evaluateTransitionGuards, isContestStatus } from './contest-transitions.js';
import { logContestScoringLine } from './contest-scoring-log.js';

const BIO_BALL = 'bio-ball';

/**
 * @param {unknown} c
 * @returns {c is Record<string, unknown>}
 */
function isRecord(c) {
  return c != null && typeof c === 'object' && !Array.isArray(c);
}

function generateScoringJobId() {
  return `score_${Date.now()}_${randomBytes(6).toString('hex')}`;
}

/**
 * @param {object} param0
 * @param {import('firebase-admin/firestore').Firestore} param0.db
 * @param {string} param0.contestId
 * @param {string} [param0.scoringJobId]
 * @param {string} param0.requestId
 * @returns {Promise<{ ok: true, scoringJobId: string, transitioned: boolean, standingsCount: number } | { ok: false, code: string, message: string, httpStatus: number }>}
 */
export async function runContestScoringJob({ db, contestId, scoringJobId, requestId }) {
  const jobId = scoringJobId?.trim() || generateScoringJobId();

  const contestRef = db.doc(`contests/${contestId}`);
  const contestSnap = await contestRef.get();
  if (!contestSnap.exists) {
    logContestScoringLine({
      requestId,
      contestId,
      phase: 'score',
      outcome: 'contest_not_found',
      scoringJobId: jobId,
    });
    return {
      ok: false,
      code: 'contest_not_found',
      message:
        'No contests/{contestId} document in this Firestore database. Confirm contestId, GCP project (service account), and FIRESTORE_DATABASE_ID match where the contest was created.',
      httpStatus: 404,
    };
  }

  const contest = contestSnap.data();
  if (!isRecord(contest)) {
    return {
      ok: false,
      code: 'internal_error',
      message: 'Invalid contest document.',
      httpStatus: 500,
    };
  }

  const status = contest.status;
  if (!isContestStatus(status)) {
    return {
      ok: false,
      code: 'internal_error',
      message: 'Invalid contest status.',
      httpStatus: 500,
    };
  }

  if (status === 'paid') {
    logContestScoringLine({
      requestId,
      contestId,
      phase: 'score',
      outcome: 'idempotent_already_paid',
      scoringJobId: jobId,
    });
    return {
      ok: true,
      scoringJobId: jobId,
      transitioned: false,
      standingsCount: 0,
    };
  }

  if (status !== 'scoring') {
    return {
      ok: false,
      code: 'contest_not_scoring',
      message: `Contest must be in scoring state (current: ${status}).`,
      httpStatus: 400,
    };
  }

  if (contest.gameMode !== BIO_BALL) {
    return {
      ok: false,
      code: 'wrong_game_mode',
      message: 'Only bio-ball contests are supported.',
      httpStatus: 400,
    };
  }

  const leagueGamesN = contest.leagueGamesN;
  if (typeof leagueGamesN !== 'number' || !Number.isFinite(leagueGamesN) || leagueGamesN < 1) {
    return {
      ok: false,
      code: 'internal_error',
      message: 'Invalid leagueGamesN.',
      httpStatus: 500,
    };
  }

  const ws = contest.windowStart;
  const we = contest.windowEnd;
  if (!(ws instanceof Timestamp) || !(we instanceof Timestamp)) {
    return {
      ok: false,
      code: 'internal_error',
      message: 'Invalid contest window timestamps.',
      httpStatus: 500,
    };
  }

  const entriesSnap = await db.collection(`contests/${contestId}/entries`).get();

  ensureFirebaseAdminInitialized();
  const standings = await computeStandingsForEntryDocs(
    db,
    { windowStart: ws, windowEnd: we, leagueGamesN },
    entriesSnap.docs,
    {
      auth: getAuth(admin.app()),
      onSkipEntry: ({ uid, reason }) => {
        logContestScoringLine({
          requestId,
          contestId,
          phase: 'score',
          outcome: reason,
          uid,
        });
      },
    },
  );

  const tieResolution = buildTieResolutionAudit({
    tieBreakPolicy: TIE_BREAK_POLICY,
    leagueGamesN,
    orderedStandingRows: standings.map((s) => ({
      uid: s.uid,
      rank: s.rank,
      tier: s.tier,
      wins: s.wins,
      losses: s.losses,
      abandoned: s.abandoned,
      gamesPlayed: s.gamesPlayed,
    })),
  });

  const finalDoc = {
    schemaVersion: 1,
    computedAt: FieldValue.serverTimestamp(),
    windowStart: ws,
    windowEnd: we,
    gameMode: BIO_BALL,
    leagueGamesN,
    standings,
    tieBreakPolicy: TIE_BREAK_POLICY,
    scoringJobId: jobId,
    eventSource: EVENT_SOURCE,
    tieResolution,
  };

  const dryRunLines = buildPayoutLinesFromFinal(finalDoc, undefined, contest);

  const dryRunDoc = {
    schemaVersion: 1,
    notRealMoney: true,
    currency: 'FAKE_USD',
    lines: dryRunLines,
    finalizedAt: FieldValue.serverTimestamp(),
    payoutJobId: jobId,
  };

  const resultsRef = db.doc(`contests/${contestId}/results/final`);
  const payoutsRef = db.doc(`contests/${contestId}/payouts/dryRun`);

  let txResult = /** @type {'committed'|'noop_paid'} */ ('committed');
  try {
    txResult = await db.runTransaction(async (t) => {
      const fresh = await t.get(contestRef);
      if (!fresh.exists) {
        throw new Error('contest_missing');
      }
      const data = fresh.data();
      if (!isRecord(data) || !isContestStatus(data.status)) {
        throw new Error('contest_invalid');
      }
      if (data.status === 'paid') {
        return 'noop_paid';
      }
      if (data.status !== 'scoring') {
        throw new Error('contest_not_scoring');
      }

      const g = evaluateTransitionGuards({
        from: 'scoring',
        to: 'paid',
        contestData: data,
        nowMs: Date.now(),
      });
      if (!g.ok) {
        throw new Error(g.message);
      }

      t.set(resultsRef, finalDoc);
      t.set(payoutsRef, dryRunDoc);
      t.update(contestRef, {
        status: 'paid',
        updatedAt: FieldValue.serverTimestamp(),
      });
      return 'committed';
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === 'contest_not_scoring') {
      return {
        ok: false,
        code: 'contest_not_scoring',
        message: 'Contest is no longer in scoring state.',
        httpStatus: 409,
      };
    }
    logContestScoringLine({
      requestId,
      contestId,
      phase: 'score',
      outcome: 'transaction_failed',
      scoringJobId: jobId,
      message: msg.slice(0, 400),
    });
    return {
      ok: false,
      code: 'internal_error',
      message: 'Scoring transaction failed.',
      httpStatus: 500,
    };
  }

  if (txResult === 'noop_paid') {
    logContestScoringLine({
      requestId,
      contestId,
      phase: 'score',
      outcome: 'idempotent_concurrent_paid',
      scoringJobId: jobId,
    });
    return {
      ok: true,
      scoringJobId: jobId,
      transitioned: false,
      standingsCount: standings.length,
    };
  }

  logContestScoringLine({
    requestId,
    contestId,
    phase: 'score',
    outcome: 'paid',
    scoringJobId: jobId,
    standingsCount: standings.length,
  });

  return {
    ok: true,
    scoringJobId: jobId,
    transitioned: true,
    standingsCount: standings.length,
  };
}
