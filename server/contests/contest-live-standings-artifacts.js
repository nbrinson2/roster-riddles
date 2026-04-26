/**
 * Phase 4 — optional materialized live standings under `contests/{contestId}/liveStandings/*`.
 * Clients must not read this path (see `firestore.rules`); use `GET /api/v1/contests/:contestId/leaderboard`.
 * When a contest leaves **`open`**, delete these docs so nothing can diverge from or race **`results/final`**.
 */
const LIVE_STANDINGS_BATCH = 50;

/**
 * Best-effort delete of all documents in `contests/{contestId}/liveStandings` (non-recursive into
 * deeper subcollections — extend if a worker ever nests further).
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} contestId
 * @returns {Promise<number>} Approximate number of docs deleted (may under-count if concurrent writes).
 */
export async function deleteContestLiveStandingsSubtree(db, contestId) {
  const col = db.collection(`contests/${contestId}/liveStandings`);
  let deleted = 0;
  for (let i = 0; i < 200; i += 1) {
    const snap = await col.limit(LIVE_STANDINGS_BATCH).get();
    if (snap.empty) {
      break;
    }
    const batch = db.batch();
    for (const d of snap.docs) {
      batch.delete(d.ref);
    }
    await batch.commit();
    deleted += snap.size;
    if (snap.size < LIVE_STANDINGS_BATCH) {
      break;
    }
  }
  return deleted;
}
