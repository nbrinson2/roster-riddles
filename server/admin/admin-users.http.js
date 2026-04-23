/**
 * Admin — read user record and set Firebase Auth custom claim `admin` (browser; `requireAdmin`).
 * @see docs/admin/admin-dashboard-security.md
 */
import { z } from 'zod';
import { ensureFirebaseAdminInitialized } from '../lib/firebase-admin-init.js';

const uidParamSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const patchAdminClaimBodySchema = z
  .object({ grant: z.boolean() })
  .strict();

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {() => Promise<void>} handler
 */
async function withContestReadRateLimit(req, res, handler) {
  const rl = await req.consumeContestReadRateLimit?.();
  if (rl && rl.allowed === false) {
    const retry = rl.retryAfterSec ?? null;
    if (retry != null) {
      res.setHeader('Retry-After', String(retry));
    }
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many requests.',
        ...(retry != null ? { retryAfterSec: retry } : {}),
      },
    });
  }
  return handler();
}

/**
 * Paginate Firebase Auth `listUsers` and return users with `admin: true` custom claim.
 * @type {import('express').RequestHandler}
 */
export async function listAdminUsers(req, res) {
  return withContestReadRateLimit(req, res, async () => {
    let auth;
    try {
      auth = ensureFirebaseAdminInitialized().auth();
    } catch (e) {
      return res.status(503).json({
        error: {
          code: 'server_misconfigured',
          message:
            e instanceof Error ? e.message : 'Authentication is not configured.',
        },
      });
    }

    try {
      /** @type {{ uid: string; email: string | null; disabled: boolean }[]} */
      const admins = [];
      let nextPageToken;
      do {
        const result = await auth.listUsers(1000, nextPageToken);
        for (const userRecord of result.users) {
          if (userRecord.customClaims?.admin === true) {
            admins.push({
              uid: userRecord.uid,
              email: userRecord.email ?? null,
              disabled: userRecord.disabled,
            });
          }
        }
        nextPageToken = result.pageToken;
      } while (nextPageToken);

      admins.sort((a, b) => {
        const ae = (a.email ?? '').toLowerCase();
        const be = (b.email ?? '').toLowerCase();
        if (ae !== be) {
          return ae.localeCompare(be);
        }
        return a.uid.localeCompare(b.uid);
      });

      return res.status(200).json({
        schemaVersion: 1,
        admins,
      });
    } catch (e) {
      return res.status(500).json({
        error: {
          code: 'list_users_failed',
          message:
            e instanceof Error ? e.message.slice(0, 200) : 'Could not list users.',
        },
      });
    }
  });
}

const RECENT_REGISTRATIONS_LIMIT = 5;

/**
 * Paginate Firebase Auth `listUsers`, sort by account creation time (newest first),
 * return the {@link RECENT_REGISTRATIONS_LIMIT} most recently registered users.
 * @type {import('express').RequestHandler}
 */
export async function listRecentRegisteredUsers(req, res) {
  return withContestReadRateLimit(req, res, async () => {
    let auth;
    try {
      auth = ensureFirebaseAdminInitialized().auth();
    } catch (e) {
      return res.status(503).json({
        error: {
          code: 'server_misconfigured',
          message:
            e instanceof Error ? e.message : 'Authentication is not configured.',
        },
      });
    }

    try {
      /** @type {{ uid: string; email: string | null; disabled: boolean; createdAtMs: number }[]} */
      const rows = [];
      let nextPageToken;
      do {
        const result = await auth.listUsers(1000, nextPageToken);
        for (const userRecord of result.users) {
          const raw = userRecord.metadata?.creationTime;
          const createdAtMs =
            typeof raw === 'string' && Number.isFinite(Date.parse(raw))
              ? Date.parse(raw)
              : 0;
          rows.push({
            uid: userRecord.uid,
            email: userRecord.email ?? null,
            disabled: userRecord.disabled,
            createdAtMs,
          });
        }
        nextPageToken = result.pageToken;
      } while (nextPageToken);

      rows.sort((a, b) => b.createdAtMs - a.createdAtMs);
      const top = rows.slice(0, RECENT_REGISTRATIONS_LIMIT).map((r) => ({
        uid: r.uid,
        email: r.email,
        disabled: r.disabled,
        createdAt: new Date(r.createdAtMs).toISOString(),
      }));

      return res.status(200).json({
        schemaVersion: 1,
        users: top,
      });
    } catch (e) {
      return res.status(500).json({
        error: {
          code: 'list_users_failed',
          message:
            e instanceof Error ? e.message.slice(0, 200) : 'Could not list users.',
        },
      });
    }
  });
}

/**
 * `GET /api/v1/admin/users/:targetUid` — email + admin claim (Admin SDK).
 * @type {import('express').RequestHandler}
 */
export async function getAdminUser(req, res) {
  return withContestReadRateLimit(req, res, async () => {
    const parsed = uidParamSchema.safeParse(req.params.targetUid);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'invalid_uid',
          message: 'Invalid user id.',
        },
      });
    }
    const targetUid = parsed.data;

    let auth;
    try {
      auth = ensureFirebaseAdminInitialized().auth();
    } catch (e) {
      return res.status(503).json({
        error: {
          code: 'server_misconfigured',
          message:
            e instanceof Error ? e.message : 'Authentication is not configured.',
        },
      });
    }

    try {
      const user = await auth.getUser(targetUid);
      const adminClaim = user.customClaims?.admin === true;
      return res.status(200).json({
        uid: user.uid,
        email: user.email ?? null,
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        admin: adminClaim,
      });
    } catch (e) {
      const code =
        e && typeof e === 'object' && 'code' in e
          ? String(/** @type {{ code?: string }} */ (e).code)
          : '';
      if (code === 'auth/user-not-found') {
        return res.status(404).json({
          error: {
            code: 'user_not_found',
            message: 'No user with that id.',
          },
        });
      }
      return res.status(500).json({
        error: {
          code: 'auth_lookup_failed',
          message:
            e instanceof Error ? e.message.slice(0, 200) : 'Could not load user.',
        },
      });
    }
  });
}

/**
 * `PATCH /api/v1/admin/users/:targetUid/admin-claim` — set `admin` custom claim.
 * Cannot change your own claim via API (use CLI script to avoid accidental lockout).
 * @type {import('express').RequestHandler}
 */
export async function patchAdminUserClaim(req, res) {
  return withContestReadRateLimit(req, res, async () => {
    const parsed = uidParamSchema.safeParse(req.params.targetUid);
    if (!parsed.success) {
      return res.status(400).json({
        error: {
          code: 'invalid_uid',
          message: 'Invalid user id.',
        },
      });
    }
    const targetUid = parsed.data;

    const actorUid = req.user?.uid;
    if (!actorUid) {
      return res.status(401).json({
        error: { code: 'unauthorized', message: 'Authentication required.' },
      });
    }

    if (targetUid === actorUid) {
      return res.status(400).json({
        error: {
          code: 'cannot_change_own_admin_via_api',
          message:
            'You cannot change your own admin claim from the dashboard. Use the repo script or Firebase console if you need to change your account.',
        },
      });
    }

    const bodyParsed = patchAdminClaimBodySchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({
        error: {
          code: 'invalid_body',
          message: 'Body must be JSON: { "grant": true | false }.',
        },
      });
    }
    const { grant } = bodyParsed.data;

    let auth;
    try {
      auth = ensureFirebaseAdminInitialized().auth();
    } catch (e) {
      return res.status(503).json({
        error: {
          code: 'server_misconfigured',
          message:
            e instanceof Error ? e.message : 'Authentication is not configured.',
        },
      });
    }

    try {
      const userRecord = await auth.getUser(targetUid);
      const prev =
        userRecord.customClaims &&
        typeof userRecord.customClaims === 'object' &&
        !Array.isArray(userRecord.customClaims)
          ? { ...userRecord.customClaims }
          : {};
      const next = { ...prev, admin: grant === true ? true : false };
      await auth.setCustomUserClaims(targetUid, next);
      const after = await auth.getUser(targetUid);

      console.log(
        JSON.stringify({
          component: 'admin_users',
          action: 'patch_admin_claim',
          outcome: 'ok',
          actorUid,
          targetUid,
          grant,
          requestId: req.requestId ?? null,
        }),
      );

      return res.status(200).json({
        uid: after.uid,
        email: after.email ?? null,
        admin: after.customClaims?.admin === true,
      });
    } catch (e) {
      const code =
        e && typeof e === 'object' && 'code' in e
          ? String(/** @type {{ code?: string }} */ (e).code)
          : '';
      if (code === 'auth/user-not-found') {
        return res.status(404).json({
          error: {
            code: 'user_not_found',
            message: 'No user with that id.',
          },
        });
      }
      console.error(
        JSON.stringify({
          component: 'admin_users',
          action: 'patch_admin_claim',
          outcome: 'error',
          actorUid,
          targetUid,
          requestId: req.requestId ?? null,
          message: e instanceof Error ? e.message.slice(0, 300) : String(e),
        }),
      );
      return res.status(500).json({
        error: {
          code: 'set_claim_failed',
          message:
            e instanceof Error ? e.message.slice(0, 200) : 'Could not update claim.',
        },
      });
    }
  });
}
