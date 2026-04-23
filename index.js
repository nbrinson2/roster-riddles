import 'dotenv/config';
import express from 'express';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

import { postContestJoin } from './server/contest-join.http.js';
import { getContestDetail, getContestList } from './server/contest-read.http.js';
import { postContestCloseDueWindows } from './server/contest-close-due-windows.http.js';
import { postContestRunScoring } from './server/contest-scoring.http.js';
import { postContestTransition } from './server/contest-transition.http.js';
import { postGameplayEvent } from './server/gameplay-events.js';
import { getLeaderboardPage } from './server/leaderboards.http.js';
import { postRebuildLeaderboardSnapshots } from './server/leaderboards-snapshot-rebuild.http.js';
import {
  contestJoinRateLimitHookMiddleware,
  contestReadRateLimitHookMiddleware,
  gameplayEventRateLimitHookMiddleware,
  leaderboardRateLimitHookMiddleware,
} from './server/rate-limit-hooks.middleware.js';
import {
  getAdminContestList,
  postAdminContestCreate,
  postAdminContestRunScoring,
  postAdminContestTransition,
} from './server/admin-contests.http.js';
import {
  getAdminUser,
  listAdminUsers,
  listRecentRegisteredUsers,
  patchAdminUserClaim,
} from './server/admin-users.http.js';
import { requireFirebaseAuth } from './server/require-auth.js';
import { requireAdmin } from './server/require-admin.js';
import { requestIdMiddleware } from './server/request-id.middleware.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(requestIdMiddleware);

const MLB_API = 'https://statsapi.mlb.com/api/v1';

/** Public — load balancers / uptime checks */
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok' });
});

// API routes (must be registered before static / SPA fallback)

/** Public — MLB proxy (game works when logged out) */
app.get('/api/v1/mlb/people/:id', async (req, res, next) => {
  try {
    const url = `${MLB_API}/people/${encodeURIComponent(req.params.id)}`;
    const r = await fetch(url);
    const body = await r.text();
    res.status(r.status).type('application/json').send(body);
  } catch (err) {
    next(err);
  }
});

/**
 * Protected — verifies Firebase ID token (Bearer). Example for Story 5; attach `requireFirebaseAuth`
 * to future contest/score routes the same way.
 *
 * Response includes `isAdmin` from custom claim `admin: true` (Story AD-2).
 * @see docs/admin-dashboard-security.md
 */
app.get('/api/v1/me', requireFirebaseAuth, (req, res) => {
  res.status(200).json({
    uid: req.user.uid,
    email: req.user.email,
    emailVerified: req.user.emailVerified,
    isAdmin: req.user.isAdmin,
  });
});

/**
 * Admin — weekly contests (Firebase `admin: true` claim). List all statuses; transition without operator secret.
 * @see docs/admin-dashboard-security.md
 */
app.get(
  '/api/v1/admin/contests',
  requireFirebaseAuth,
  requireAdmin,
  contestReadRateLimitHookMiddleware,
  getAdminContestList,
);
app.post(
  '/api/v1/admin/contests',
  requireFirebaseAuth,
  requireAdmin,
  contestReadRateLimitHookMiddleware,
  postAdminContestCreate,
);
app.post(
  '/api/v1/admin/contests/:contestId/transition',
  requireFirebaseAuth,
  requireAdmin,
  contestReadRateLimitHookMiddleware,
  postAdminContestTransition,
);
app.post(
  '/api/v1/admin/contests/:contestId/run-scoring',
  requireFirebaseAuth,
  requireAdmin,
  contestReadRateLimitHookMiddleware,
  postAdminContestRunScoring,
);

app.get(
  '/api/v1/admin/users/admins',
  requireFirebaseAuth,
  requireAdmin,
  contestReadRateLimitHookMiddleware,
  listAdminUsers,
);
app.get(
  '/api/v1/admin/users/recent-registrations',
  requireFirebaseAuth,
  requireAdmin,
  contestReadRateLimitHookMiddleware,
  listRecentRegisteredUsers,
);
app.get(
  '/api/v1/admin/users/:targetUid',
  requireFirebaseAuth,
  requireAdmin,
  contestReadRateLimitHookMiddleware,
  getAdminUser,
);
app.patch(
  '/api/v1/admin/users/:targetUid/admin-claim',
  requireFirebaseAuth,
  requireAdmin,
  contestReadRateLimitHookMiddleware,
  patchAdminUserClaim,
);

/** Append-only gameplay event (Admin SDK). Idempotent on `clientSessionId`. */
app.post(
  '/api/v1/me/gameplay-events',
  requireFirebaseAuth,
  gameplayEventRateLimitHookMiddleware,
  postGameplayEvent,
);

/** Join weekly contest — authenticated; idempotent entry under `contests/{id}/entries/{uid}` (Story C1). */
app.post(
  '/api/v1/contests/:contestId/join',
  requireFirebaseAuth,
  contestJoinRateLimitHookMiddleware,
  postContestJoin,
);

/**
 * Contest list + detail — authenticated; public-safe fields only (Story D2).
 * Register list route before `/:contestId` so `/contests` is not captured as an id.
 */
app.get(
  '/api/v1/contests',
  requireFirebaseAuth,
  contestReadRateLimitHookMiddleware,
  getContestList,
);
app.get(
  '/api/v1/contests/:contestId',
  requireFirebaseAuth,
  contestReadRateLimitHookMiddleware,
  getContestDetail,
);

/**
 * Public leaderboard page (Admin SDK collection-group query). Pagination + optional display names from Auth.
 * Story D1 — see docs/leaderboards-api-d1.md
 */
app.get(
  '/api/v1/leaderboards',
  leaderboardRateLimitHookMiddleware,
  getLeaderboardPage,
);

/**
 * Secured batch rebuild of `leaderboards/snapshots/boards/*` (Story E2).
 * Cloud Scheduler → HTTP POST with `Authorization: Bearer <LEADERBOARD_SNAPSHOT_CRON_SECRET>`.
 */
app.post(
  '/api/internal/v1/leaderboard-snapshots/rebuild',
  postRebuildLeaderboardSnapshots,
);

/**
 * Contest lifecycle — Story D1; Story F2 `paid`→`scoring`|`cancelled` with `force` + artifact deletes.
 * Bearer `CONTESTS_OPERATOR_SECRET` (or `x-contests-operator-secret`).
 * @see docs/weekly-contests-ops-d1.md, docs/weekly-contests-ops-f2.md
 */
app.post(
  '/api/internal/v1/contests/:contestId/transition',
  postContestTransition,
);

/**
 * Story E1 — Cloud Scheduler / cron: close join windows and enqueue scoring worker.
 * @see docs/weekly-contests-ops-e1.md
 */
app.post(
  '/api/internal/v1/contests/close-due-windows',
  postContestCloseDueWindows,
);

/**
 * Story E2 — scoring worker (body `{ contestId }`). Register before `/:contestId` routes.
 * @see docs/weekly-contests-ops-e2.md
 */
app.post('/api/internal/v1/contests/run-scoring', postContestRunScoring);

// Serve static files from the Angular app
const distPath = join(__dirname, 'dist/roster-riddles/browser');
app.use('/', express.static(distPath));

// SPA fallback - serve index.html for any route not found
app.use((req, res, next) => {
  if (req.method === 'GET' && !req.path.startsWith('/api')) {
    return res.sendFile(join(distPath, 'index.html'));
  }
  next();
});

// Error handling middleware (no secrets; include request id for correlation)
app.use((err, req, res, next) => {
  const requestId = req.requestId ?? 'unknown';
  console.error(
    JSON.stringify({
      component: 'express',
      severity: 'ERROR',
      requestId,
      message: err instanceof Error ? err.message : String(err),
      // stack is not a secret; omit body/headers to avoid leaking tokens
    }),
  );
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
  res.status(500).json({
    error: {
      code: 'internal_error',
      message: 'Something broke!',
      requestId,
    },
  });
});

app.listen(port, () => {
  const dbId = process.env.FIRESTORE_DATABASE_ID?.trim();
  console.log(
    JSON.stringify({
      component: 'server',
      message: 'listening',
      port: Number(port),
      firestoreDatabaseId: dbId || '(default)',
    }),
  );
}).on('error', (err) => {
  console.error('Server failed to start:', err);
});