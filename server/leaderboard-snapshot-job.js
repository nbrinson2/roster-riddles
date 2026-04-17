/**
 * Rebuild precomputed leaderboard docs at leaderboards/snapshots/boards/{boardId} (Story B2 + E2).
 */
import { FieldPath, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import admin from 'firebase-admin';
import { fetchAuthFieldsForUids } from './auth-display-names.js';
import { filterSortedForVerifiedLeaderboard } from './leaderboard-email-verified.js';
import { getAdminFirestore } from './admin-firestore.js';
import { ensureFirebaseAdminInitialized } from './firebase-admin-init.js';
import {
  LEADERBOARD_SCOPES,
  sortLeaderboardPageRows,
  uidFromStatsSummaryPath,
  winsOrderFieldForScope,
  winsScoreFromStatsDoc,
} from './leaderboard-query.js';
import { STATS_SCHEMA_VERSION } from './stats-aggregate.js';

/** Max rows per snapshot document (B2); keep ≤ ~500 per ADR. */
export const LEADERBOARD_SNAPSHOT_TOP_K = 500;

export const LEADERBOARD_SNAPSHOT_TIE_BREAK = 'score_desc_uid_asc';

export const SNAPSHOT_SCHEMA_VERSION = 1;

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {import('firebase-admin/auth').Auth} auth
 * @param {string} scope — one of LEADERBOARD_SCOPES
 */
export async function rebuildLeaderboardSnapshotForScope(db, auth, scope) {
  const winsField = winsOrderFieldForScope(scope);
  const q = db
    .collectionGroup('stats')
    .orderBy(winsField, 'desc')
    .orderBy(FieldPath.documentId(), 'asc')
    .limit(LEADERBOARD_SNAPSHOT_TOP_K);

  const snap = await q.get();
  /** @type {{ uid: string, score: number, docPath: string }[]} */
  const rawRows = [];
  for (const d of snap.docs) {
    const path = d.ref.path;
    const uid = uidFromStatsSummaryPath(path);
    if (!uid) continue;
    const data = d.data();
    const score = winsScoreFromStatsDoc(scope, data);
    rawRows.push({ uid, score, docPath: path });
  }

  const sorted = sortLeaderboardPageRows(
    rawRows.map((r) => ({ uid: r.uid, score: r.score })),
  );

  const uids = sorted.map((r) => r.uid);
  const authFields = await fetchAuthFieldsForUids(uids, auth);
  const listed = filterSortedForVerifiedLeaderboard(sorted, authFields);

  const entries = listed.map((r, i) => {
    const f = authFields.get(r.uid);
    return {
      rank: i + 1,
      uid: r.uid,
      score: r.score,
      tieBreakKey: r.uid,
      displayName: f?.displayName ?? null,
    };
  });

  const docRef = db.doc(`leaderboards/snapshots/boards/${scope}`);
  const payload = {
    schemaVersion: SNAPSHOT_SCHEMA_VERSION,
    boardId: scope,
    tieBreakPolicy: LEADERBOARD_SNAPSHOT_TIE_BREAK,
    topK: entries.length,
    entries,
    generatedAt: FieldValue.serverTimestamp(),
    aggregateSchemaVersion: STATS_SCHEMA_VERSION,
    sourceRowCount: rawRows.length,
  };

  await docRef.set(payload);

  return {
    scope,
    entryCount: entries.length,
    scannedStatsDocs: rawRows.length,
  };
}

/**
 * Rebuilds all four v1 boards. Requires Firebase Admin initialized.
 * @returns {Promise<{ boards: Awaited<ReturnType<typeof rebuildLeaderboardSnapshotForScope>>[], durationMs: number }>}
 */
export async function rebuildAllLeaderboardSnapshots() {
  ensureFirebaseAdminInitialized();
  const db = getAdminFirestore();
  const auth = getAuth(admin.app());
  const start = Date.now();
  /** @type {Awaited<ReturnType<typeof rebuildLeaderboardSnapshotForScope>>[]} */
  const boards = [];
  for (const scope of LEADERBOARD_SCOPES) {
    const r = await rebuildLeaderboardSnapshotForScope(db, auth, scope);
    boards.push(r);
  }
  return { boards, durationMs: Date.now() - start };
}
