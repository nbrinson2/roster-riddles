import { ensureFirebaseAdminInitialized } from './firebase-admin-init.js';

/**
 * @typedef {Object} AuthedUser
 * @property {string} uid
 * @property {string | null} email
 * @property {boolean} emailVerified
 */

/**
 * Verifies `Authorization: Bearer <Firebase ID token>` and sets `req.user`.
 * On failure responds with 401 and a consistent JSON body (does not call `next`).
 */
export async function requireFirebaseAuth(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return sendUnauthorized(res, 'missing_token', 'Authorization Bearer token is required.');
  }

  const idToken = header.slice(7).trim();
  if (!idToken) {
    return sendUnauthorized(res, 'missing_token', 'Authorization Bearer token is required.');
  }

  try {
    let admin;
    try {
      admin = ensureFirebaseAdminInitialized();
    } catch (initErr) {
      console.error('[auth] Firebase Admin init failed:', initErr);
      return res.status(503).json({
        error: {
          code: 'server_misconfigured',
          message: 'Authentication is not configured on this server.',
        },
      });
    }

    const decoded = await admin.auth().verifyIdToken(idToken);
    /** @type {AuthedUser} */
    const user = {
      uid: decoded.uid,
      email: decoded.email ?? null,
      emailVerified: Boolean(decoded.email_verified),
    };
    req.user = user;
    next();
  } catch (err) {
    console.warn('[auth] verifyIdToken failed:', err?.message ?? err);
    return sendUnauthorized(res, 'invalid_token', 'Invalid or expired token.');
  }
}

function sendUnauthorized(res, code, message) {
  return res.status(401).json({
    error: { code, message },
  });
}
