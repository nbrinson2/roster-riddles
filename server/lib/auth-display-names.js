/**
 * Firebase Auth lookups for leaderboard rows (Admin SDK).
 */

/**
 * Part before `@`; mirrors `src/app/auth/user-display-name.util.ts` (`emailLocalPart`).
 *
 * @param {string | null | undefined} email
 * @returns {string | null}
 */
export function emailLocalPartFromEmail(email) {
  if (email == null || typeof email !== 'string') {
    return null;
  }
  const t = email.trim();
  if (!t) {
    return null;
  }
  const at = t.indexOf('@');
  if (at <= 0) {
    return t;
  }
  const local = t.slice(0, at).trim();
  return local || null;
}

/**
 * Contest standings / `results/final` row label: join snapshot when set, else Auth email local part.
 *
 * @param {string | null} displayNameSnapshot
 * @param {string | null | undefined} authEmail
 * @returns {string | null}
 */
export function contestStandingDisplayLabel(displayNameSnapshot, authEmail) {
  const snap =
    displayNameSnapshot === null || typeof displayNameSnapshot !== 'string'
      ? ''
      : displayNameSnapshot.trim();
  if (snap) {
    return snap;
  }
  return emailLocalPartFromEmail(authEmail);
}

/**
 * @param {string[]} uids
 * @param {import('firebase-admin/auth').Auth} auth
 * @returns {Promise<Map<string, { displayName: string | null, emailVerified: boolean, email: string | null }>>}
 */
export async function fetchAuthFieldsForUids(uids, auth) {
  if (uids.length === 0) return new Map();
  /** @type {Map<string, { displayName: string | null, emailVerified: boolean, email: string | null }>} */
  const out = new Map();
  const chunkSize = 100;
  for (let i = 0; i < uids.length; i += chunkSize) {
    const chunk = uids.slice(i, i + chunkSize);
    try {
      const res = await auth.getUsers(chunk.map((uid) => ({ uid })));
      for (const u of res.users) {
        const dn = u.displayName;
        const em = u.email;
        out.set(u.uid, {
          displayName:
            typeof dn === 'string' && dn.trim() ? dn.trim() : null,
          emailVerified: Boolean(u.emailVerified),
          email: typeof em === 'string' && em.trim() ? em.trim() : null,
        });
      }
      for (const uid of chunk) {
        if (!out.has(uid)) {
          out.set(uid, { displayName: null, emailVerified: false, email: null });
        }
      }
    } catch {
      for (const uid of chunk) {
        if (!out.has(uid)) {
          out.set(uid, { displayName: null, emailVerified: false, email: null });
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
