/**
 * Story C2 — Concurrent gameplay event + stats writes (Firestore emulator).
 *
 * Verifies: no negative totals; no lost updates (expected wins/games match events);
 * optional max Firestore error rate.
 *
 * Run: npm run test:stats-concurrency
 * Env:
 *   LOAD_PARALLEL — concurrent events per user (default 32)
 *   LOAD_USERS — distinct uids (default 2)
 *   LOAD_MAX_FAILURE_RATE — allowed share of rejected txns (default 0; 0 = all must succeed)
 */
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { computeGameplayEventId } from '../server/gameplay/gameplay-events.js';
import {
  deleteFirebaseAdminApp,
  exitEmulatorExecChild,
} from './emulator-child-exit.mjs';
import {
  STATS_DOC_ID,
  transactionalAppendEventAndUpdateStats,
} from '../server/lib/stats-aggregate.js';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) {
  console.error(
    'Set FIRESTORE_EMULATOR_HOST (use npm run test:stats-concurrency).',
  );
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'demo-stats-concurrency' });
}
const db = getFirestore(admin.app());

const PARALLEL = Math.max(
  1,
  Math.min(500, Number(process.env.LOAD_PARALLEL ?? 32) || 32),
);
const USERS = Math.max(1, Math.min(50, Number(process.env.LOAD_USERS ?? 2) || 2));
const MAX_FAILURE_RATE = Math.min(
  1,
  Math.max(0, Number(process.env.LOAD_MAX_FAILURE_RATE ?? 0)),
);

function basePayload(uid, clientSessionId, result) {
  return {
    schemaVersion: 1,
    gameMode: 'bio-ball',
    result,
    durationMs: 1000,
    mistakeCount: 1,
    clientSessionId,
    uid,
  };
}

function statsInput(result) {
  return {
    result,
    gameMode: 'bio-ball',
    durationMs: 1000,
    mistakeCount: 1,
  };
}

/**
 * @param {string} uid
 * @param {number} n
 * @param {import('firebase-admin/firestore').Firestore} db
 */
async function parallelWinsForUser(uid, n, db) {
  const run = `c2-${Date.now().toString(36)}`;
  const tasks = [];
  for (let i = 0; i < n; i++) {
    const clientSessionId = `${run}-${i.toString(36)}`;
    const eventId = computeGameplayEventId(uid, clientSessionId);
    tasks.push(
      transactionalAppendEventAndUpdateStats(
        db,
        uid,
        eventId,
        basePayload(uid, clientSessionId, 'won'),
        statsInput('won'),
      ).then(() => ({ ok: true, eventId }))
        .catch((err) => ({ ok: false, eventId, err })),
    );
  }
  return Promise.all(tasks);
}

/**
 * @param {string} uid
 * @param {import('firebase-admin/firestore').Firestore} db
 */
async function readTotals(uid, db) {
  const snap = await db
    .collection('users')
    .doc(uid)
    .collection('stats')
    .doc(STATS_DOC_ID)
    .get();
  const d = snap.data();
  if (!d?.totals) return null;
  return d.totals;
}

function assertNonNegativeTotals(totals, label) {
  const { gamesPlayed = 0, wins = 0, losses = 0, abandoned = 0 } = totals;
  for (const [k, v] of Object.entries({
    gamesPlayed,
    wins,
    losses,
    abandoned,
  })) {
    if (typeof v !== 'number' || v < 0 || !Number.isFinite(v)) {
      throw new Error(`${label}: invalid ${k}=${v}`);
    }
  }
  if (gamesPlayed !== wins + losses + abandoned) {
    throw new Error(
      `${label}: gamesPlayed ${gamesPlayed} !== wins+losses+abandoned (${wins}+${losses}+${abandoned})`,
    );
  }
}

async function run() {
  const started = Date.now();
  const baseUid = `load-${Date.now().toString(36)}`;

  /** @type {Array<{ phase: string, users: number, parallel: number, failures: number, attempts: number, durationMs: number, errorSamples: string[] }>} */
  const phases = [];

  // Phase 1: single user — maximum contention on one stats/summary doc
  const uidA = `${baseUid}-a`;
  const r1 = await parallelWinsForUser(uidA, PARALLEL, db);
  const fail1 = r1.filter((x) => !x.ok);
  phases.push({
    phase: 'single_user_parallel_wins',
    users: 1,
    parallel: PARALLEL,
    failures: fail1.length,
    attempts: r1.length,
    durationMs: Date.now() - started,
    errorSamples: fail1.slice(0, 3).map((f) =>
      f && 'err' in f && f.err instanceof Error
        ? f.err.message
        : String(f),
    ),
  });

  const tA = await readTotals(uidA, db);
  if (!tA) throw new Error('stats doc missing after phase 1');
  assertNonNegativeTotals(tA, 'phase1');
  const expectedWins = PARALLEL - fail1.length;
  if (tA.wins !== expectedWins || tA.gamesPlayed !== expectedWins) {
    throw new Error(
      `phase1: expected wins/gamesPlayed ${expectedWins}, got wins=${tA.wins} gamesPlayed=${tA.gamesPlayed}`,
    );
  }

  // Phase 2: multiple users in parallel (distinct stats docs; lower cross-txn conflict)
  const phase2Start = Date.now();
  const uids = Array.from({ length: USERS }, (_, i) => `${baseUid}-b${i}`);
  /** Each user gets ceil(PARALLEL/USERS) wins, total events ~= PARALLEL */
  const perUser = Math.max(1, Math.ceil(PARALLEL / USERS));
  const r2nested = await Promise.all(
    uids.map((uid) => parallelWinsForUser(uid, perUser, db)),
  );
  const r2 = r2nested.flat();
  const fail2 = r2.filter((x) => !x.ok);
  phases.push({
    phase: 'multi_user_parallel_wins',
    users: USERS,
    parallel: perUser * USERS,
    failures: fail2.length,
    attempts: r2.length,
    durationMs: Date.now() - phase2Start,
    errorSamples: fail2.slice(0, 3).map((f) =>
      f && 'err' in f && f.err instanceof Error
        ? f.err.message
        : String(f),
    ),
  });

  for (let i = 0; i < uids.length; i++) {
    const uid = uids[i];
    const userResults = r2nested[i];
    const f = userResults.filter((x) => !x.ok).length;
    const exp = perUser - f;
    const totals = await readTotals(uid, db);
    if (!totals) throw new Error(`stats missing for ${uid}`);
    assertNonNegativeTotals(totals, uid);
    if (totals.wins !== exp || totals.gamesPlayed !== exp) {
      throw new Error(
        `${uid}: expected wins/gamesPlayed ${exp}, got ${totals.wins}/${totals.gamesPlayed}`,
      );
    }
  }

  const totalAttempts = phases.reduce((a, p) => a + p.attempts, 0);
  const totalFailures = phases.reduce((a, p) => a + p.failures, 0);
  const failureRate =
    totalAttempts > 0 ? totalFailures / totalAttempts : 0;

  if (failureRate > MAX_FAILURE_RATE) {
    throw new Error(
      `failure rate ${failureRate.toFixed(4)} > max ${MAX_FAILURE_RATE} (failures ${totalFailures}/${totalAttempts})`,
    );
  }

  const artifact = {
    story: 'C2',
    schema: 'stats-concurrency-load-test/1',
    firestoreEmulatorHost: host,
    durationMsTotal: Date.now() - started,
    loadParallel: PARALLEL,
    loadUsers: USERS,
    maxFailureRate: MAX_FAILURE_RATE,
    failureRate,
    totalAttempts,
    totalFailures,
    phases,
    notes: [
      'Contention is per uid on users/{uid}/stats/summary (not a single global write shard).',
      'Precomputed global leaderboard reads (B2) are separate; write path stays per-user.',
    ],
  };

  console.log(JSON.stringify(artifact, null, 2));
}

run()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await deleteFirebaseAdminApp(admin);
    exitEmulatorExecChild(
      typeof process.exitCode === 'number' ? process.exitCode : 0,
    );
  });
