import { isAdminFromDecodedToken } from './auth-claims.js';
import { ensureFirebaseAdminInitialized } from './firebase-admin-init.js';

/**
 * @typedef {Object} AuthedUser
 * @property {string} uid
 * @property {string | null} email
 * @property {boolean} emailVerified
 * @property {boolean} isAdmin — from ID token custom claim `admin: true` (Story AD-2); not authorization for server mutations.
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
      console.error(
        JSON.stringify({
          component: 'auth',
          severity: 'ERROR',
          requestId: req.requestId ?? null,
          outcome: 'admin_init_failed',
          message:
            initErr instanceof Error ? initErr.message : String(initErr),
        }),
      );
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
      isAdmin: isAdminFromDecodedToken(decoded),
    };
    req.user = user;
    next();
  } catch (err) {
    console.warn(
      JSON.stringify({
        component: 'auth',
        severity: 'WARNING',
        requestId: req.requestId ?? null,
        outcome: 'invalid_token',
        message: err instanceof Error ? err.message : String(err),
      }),
    );
    return sendUnauthorized(res, 'invalid_token', 'Invalid or expired token.');
  }
}

function sendUnauthorized(res, code, message) {
  return res.status(401).json({
    error: { code, message },
  });
}
