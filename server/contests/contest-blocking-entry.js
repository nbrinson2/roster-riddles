/**
 * Shared guard: user may only be in one **open** contest per `gameMode` (Story C1).
 * @see server/contests/contest-join.http.js
 */

/**
 * @param {unknown} raw
 * @returns {string}
 */
function normGameMode(raw) {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

/**
 * @param {FirebaseFirestore.DocumentData | undefined} c
 * @returns {c is Record<string, unknown>}
 */
function isRecord(c) {
  return c != null && typeof c === 'object' && !Array.isArray(c);
}

/**
 * If the user has an entry under another **open** contest with the same `gameMode`, return that
 * contest id (they cannot join a second open contest for that game type).
 *
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 * @param {string} excludeContestId — contest they are trying to join
 * @param {string} gameMode — target contest game mode (e.g. `bio-ball`)
 * @returns {Promise<string | null>}
 */
export async function findBlockingOpenContestSameGameMode(
  db,
  uid,
  excludeContestId,
  gameMode,
) {
  const target = normGameMode(gameMode);
  const openSnap = await db
    .collection('contests')
    .where('status', '==', 'open')
    .orderBy('windowStart', 'desc')
    .limit(100)
    .get();

  for (const cDoc of openSnap.docs) {
    const cid = cDoc.id;
    if (cid === excludeContestId) {
      continue;
    }
    const c = cDoc.data();
    if (!isRecord(c)) {
      continue;
    }
    if (normGameMode(c.gameMode) !== target) {
      continue;
    }
    let entrySnap;
    try {
      entrySnap = await db.doc(`contests/${cid}/entries/${uid}`).get();
    } catch {
      continue;
    }
    if (entrySnap.exists) {
      return cid;
    }
  }
  return null;
}
