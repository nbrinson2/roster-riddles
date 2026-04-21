/**
 * Firebase Auth custom claims used by the API (Story AD-2).
 * @see docs/admin-dashboard-security.md
 */

/**
 * Whether the verified ID token carries admin UI privilege (`admin: true` claim).
 * @param {import('firebase-admin/auth').DecodedIdToken | Record<string, unknown>} decoded
 * @returns {boolean}
 */
export function isAdminFromDecodedToken(decoded) {
  if (decoded == null || typeof decoded !== 'object') {
    return false;
  }
  return decoded['admin'] === true;
}
