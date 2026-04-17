/**
 * Firebase Auth lookups for leaderboard rows (Admin SDK).
 */

/**
 * @param {string[]} uids
 * @param {import('firebase-admin/auth').Auth} auth
 * @returns {Promise<Map<string, { displayName: string | null, emailVerified: boolean }>>}
 */
export async function fetchAuthFieldsForUids(uids, auth) {
  if (uids.length === 0) return new Map();
  /** @type {Map<string, { displayName: string | null, emailVerified: boolean }>} */
  const out = new Map();
  const chunkSize = 100;
  for (let i = 0; i < uids.length; i += chunkSize) {
    const chunk = uids.slice(i, i + chunkSize);
    try {
      const res = await auth.getUsers(chunk.map((uid) => ({ uid })));
      for (const u of res.users) {
        const dn = u.displayName;
        out.set(u.uid, {
          displayName:
            typeof dn === 'string' && dn.trim() ? dn.trim() : null,
          emailVerified: Boolean(u.emailVerified),
        });
      }
      for (const uid of chunk) {
        if (!out.has(uid)) {
          out.set(uid, { displayName: null, emailVerified: false });
        }
      }
    } catch {
      for (const uid of chunk) {
        if (!out.has(uid)) {
          out.set(uid, { displayName: null, emailVerified: false });
        }
      }
    }
  }
  return out;
}

/**
 * @param {string[]} uids
 * @param {import('firebase-admin/auth').Auth} auth
 * @returns {Promise<Map<string, string | null>>}
 */
export async function displayNamesForUids(uids, auth) {
  const full = await fetchAuthFieldsForUids(uids, auth);
  /** @type {Map<string, string | null>} */
  const out = new Map();
  for (const [uid, v] of full) {
    out.set(uid, v.displayName);
  }
  return out;
}
