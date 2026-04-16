/**
 * Integration check: Firestore emulator + Admin SDK + transactional event + stats.
 * Run: npm run test:stats-emulator
 */
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { computeGameplayEventId } from '../server/gameplay-events.js';
import {
  STATS_DOC_ID,
  transactionalAppendEventAndUpdateStats,
} from '../server/stats-aggregate.js';

const host = process.env.FIRESTORE_EMULATOR_HOST;
if (!host) {
  console.error('Set FIRESTORE_EMULATOR_HOST (use npm run test:stats-emulator).');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({ projectId: 'demo-stats-aggregate' });
}
const db = getFirestore(admin.app());

async function run() {
  const uid = `integrity-${Date.now()}`;
  const statsRef = db
    .collection('users')
    .doc(uid)
    .collection('stats')
    .doc(STATS_DOC_ID);

  const sessions = ['s-a', 's-b', 's-c'];
  const resultSeq = ['won', 'lost', 'won'];

  for (let i = 0; i < sessions.length; i++) {
    const clientSessionId = sessions[i];
    const eventId = computeGameplayEventId(uid, clientSessionId);
    const r = resultSeq[i];
    const { existing } = await transactionalAppendEventAndUpdateStats(
      db,
      uid,
      eventId,
      {
        schemaVersion: 1,
        gameMode: 'bio-ball',
        result: r,
        durationMs: 1000,
        mistakeCount: 1,
        clientSessionId,
        uid,
      },
      {
        result: r,
        gameMode: 'bio-ball',
        durationMs: 1000,
        mistakeCount: 1,
      },
    );
    if (existing) throw new Error('unexpected duplicate on first pass');
  }

  const data = (await statsRef.get()).data();
  if (!data) throw new Error('stats doc missing');
  if (data.totals.gamesPlayed !== 3) {
    throw new Error(
      `expected totals.gamesPlayed 3, got ${data.totals.gamesPlayed}`,
    );
  }
  if (data.totals.wins !== 2 || data.totals.losses !== 1) {
    throw new Error(
      `expected wins 2 losses 1, got ${data.totals.wins} / ${data.totals.losses}`,
    );
  }
  if (data.streaks.currentWinStreak !== 1) {
    throw new Error(
      `expected currentWinStreak 1 after W,L,W, got ${data.streaks.currentWinStreak}`,
    );
  }

  const dupSession = sessions[0];
  const dupEventId = computeGameplayEventId(uid, dupSession);
  const dup = await transactionalAppendEventAndUpdateStats(
    db,
    uid,
    dupEventId,
    {
      schemaVersion: 1,
      gameMode: 'bio-ball',
      result: 'won',
      durationMs: 9999,
      mistakeCount: 99,
      clientSessionId: dupSession,
      uid,
    },
    {
      result: 'won',
      gameMode: 'bio-ball',
      durationMs: 9999,
      mistakeCount: 99,
    },
  );
  if (!dup.existing) throw new Error('expected idempotent replay');

  const data2 = (await statsRef.get()).data();
  if (data2.totals.gamesPlayed !== 3) {
    throw new Error('idempotent replay must not increment totals');
  }

  console.log('Stats aggregate emulator integration passed.');
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
