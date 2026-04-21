/**
 * GET /api/v1/leaderboards — Story D1
 */
import admin from 'firebase-admin';
import { FieldPath } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { fetchAuthFieldsForUids } from '../lib/auth-display-names.js';
import { isLeaderboardEmailVerifiedEnforced } from './leaderboard-email-verified.js';
import { getAdminFirestore } from '../lib/admin-firestore.js';
import { firestoreTimestampToIso } from '../lib/firestore-timestamp-iso.js';
import { logLeaderboardLine } from './leaderboard-log.js';
import {
  decodeLeaderboardPageToken,
  encodeLeaderboardPageToken,
  isLeaderboardScope,
  parsePageSizeQuery,
  sortLeaderboardPageRows,
  uidFromStatsSummaryPath,
  winsOrderFieldForScope,
  winsScoreFromStatsDoc,
} from './leaderboard-query.js';

/**
 * @type {import('express').RequestHandler}
 */
export async function getLeaderboardPage(req, res) {
  const startMs = Date.now();
  const requestId = req.requestId ?? 'unknown';

  if (process.env.LEADERBOARDS_DISABLED === 'true') {
    logLeaderboardLine({
      requestId,
      httpStatus: 503,
      outcome: 'service_disabled',
      latencyMs: Date.now() - startMs,
      rowCount: 0,
      scope: null,
    });
    return res.status(503).json({
      error: {
        code: 'service_unavailable',
        message: 'Leaderboards are temporarily unavailable.',
      },
    });
  }

  const rl = await req.consumeLeaderboardRateLimit?.();
  if (rl && rl.allowed === false) {
    const retry = rl.retryAfterSec ?? null;
    if (retry != null) {
      res.setHeader('Retry-After', String(retry));
    }
    logLeaderboardLine({
      requestId,
      httpStatus: 429,
      outcome: 'rate_limited',
      latencyMs: Date.now() - startMs,
      rowCount: 0,
      scope: null,
    });
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many requests.',
        ...(retry != null ? { retryAfterSec: retry } : {}),
      },
    });
  }

  const scopeRaw = req.query.scope;
  const scope =
    typeof scopeRaw === 'string'
      ? scopeRaw
      : Array.isArray(scopeRaw)
        ? String(scopeRaw[0])
        : '';

  if (req.query.week !== undefined && req.query.week !== '') {
    logLeaderboardLine({
      requestId,
      httpStatus: 400,
      outcome: 'weekly_not_supported',
      latencyMs: Date.now() - startMs,
      rowCount: 0,
      scope: scope || null,
    });
    return res.status(400).json({
      error: {
        code: 'weekly_not_supported',
        message: 'Weekly leaderboards are not available in v1.',
      },
    });
  }

  if (!isLeaderboardScope(scope)) {
    logLeaderboardLine({
      requestId,
      httpStatus: 400,
      outcome: 'bad_scope',
      latencyMs: Date.now() - startMs,
      rowCount: 0,
      scope: scope || null,
    });
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message:
          'Invalid or missing scope. Use global, bio-ball, career-path, or nickname-streak.',
      },
    });
  }

  const pageSize = parsePageSizeQuery(req.query.pageSize);
  const pageTokenRaw = req.query.pageToken ?? req.query.cursor;
  const pageTokenStr =
    typeof pageTokenRaw === 'string'
      ? pageTokenRaw
      : Array.isArray(pageTokenRaw)
        ? String(pageTokenRaw[0])
        : '';

  let startRank = 1;
  /** @type {string | null} */
  let afterPath = null;

  if (pageTokenStr) {
    const decoded = decodeLeaderboardPageToken(pageTokenStr, scope);
    if (!decoded.ok) {
      logLeaderboardLine({
        requestId,
        httpStatus: 400,
        outcome: 'bad_page_token',
        latencyMs: Date.now() - startMs,
        rowCount: 0,
        scope,
      });
      return res.status(400).json({
        error: {
          code: 'invalid_page_token',
          message: 'The pageToken is invalid or does not match this scope.',
        },
      });
    }
    if (
      decoded.payload.afterPath === null ||
      decoded.payload.afterPath === ''
    ) {
      logLeaderboardLine({
        requestId,
        httpStatus: 400,
        outcome: 'bad_page_token',
        latencyMs: Date.now() - startMs,
        rowCount: 0,
        scope,
      });
      return res.status(400).json({
        error: {
          code: 'invalid_page_token',
          message: 'The pageToken is incomplete.',
        },
      });
    }
    afterPath = decoded.payload.afterPath;
    startRank = decoded.payload.startRank;
  }

  let db;
  let auth;
  try {
    db = getAdminFirestore();
    auth = getAuth(admin.app());
  } catch (initErr) {
    const msg =
      initErr instanceof Error ? initErr.message.slice(0, 300) : String(initErr);
    logLeaderboardLine({
      requestId,
      httpStatus: 503,
      outcome: 'firestore_init_failed',
      latencyMs: Date.now() - startMs,
      rowCount: 0,
      scope,
      errorMessage: msg,
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server cannot access Firestore or Auth.',
      },
    });
  }

  const winsField = winsOrderFieldForScope(scope);
  /**
   * Do **not** use `where(FieldPath.documentId(), '==', 'summary')` on a collection
   * group — Firestore requires a full resource path for that filter, not a single
   * segment. v1 only writes `users/{uid}/stats/summary` under `stats`; no extra `where`.
   * @see https://firebase.google.com/docs/firestore/query-data/queries#collection-groups
   */
  let q = db
    .collectionGroup('stats')
    .orderBy(winsField, 'desc')
    .orderBy(FieldPath.documentId(), 'asc')
    .limit(pageSize + 1);

  if (afterPath) {
    const cursorSnap = await db.doc(afterPath).get();
    if (!cursorSnap.exists) {
      logLeaderboardLine({
        requestId,
        httpStatus: 400,
        outcome: 'stale_page_token',
        latencyMs: Date.now() - startMs,
        rowCount: 0,
        scope,
      });
      return res.status(400).json({
        error: {
          code: 'stale_page_token',
          message:
            'Cursor is no longer valid; restart from the first page.',
        },
      });
    }
    q = q.startAfter(cursorSnap);
  }

  let snap;
  try {
    snap = await q.get();
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 400) : String(err);
    logLeaderboardLine({
      requestId,
      httpStatus: 500,
      outcome: 'query_failed',
      latencyMs: Date.now() - startMs,
      rowCount: 0,
      scope,
      errorMessage: msg,
    });
    return res.status(500).json({
      error: { code: 'query_failed', message: 'Could not load leaderboard.' },
    });
  }

  const docs = snap.docs;
  const hasMore = docs.length > pageSize;
  const pageDocs = hasMore ? docs.slice(0, pageSize) : docs;

  /** @type {{ uid: string, score: number, docPath: string }[]} */
  const rawRows = [];
  for (const d of pageDocs) {
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
  const requireVerified = isLeaderboardEmailVerifiedEnforced();

  /** @type {{ rank: number, uid: string, score: number, scope: string, tieBreakKey: string, displayName: string | null }[]} */
  const entries = [];
  for (let si = 0; si < sorted.length; si++) {
    const r = sorted[si];
    if (requireVerified && !authFields.get(r.uid)?.emailVerified) {
      continue;
    }
    const f = authFields.get(r.uid);
    entries.push({
      rank: startRank + si,
      uid: r.uid,
      score: r.score,
      scope,
      tieBreakKey: r.uid,
      displayName: f?.displayName ?? null,
    });
  }

  /** @type {string | undefined} */
  let nextPageToken;
  if (hasMore && pageDocs.length > 0) {
    const last = pageDocs[pageDocs.length - 1];
    const nextStartRank = startRank + pageDocs.length;
    nextPageToken = encodeLeaderboardPageToken(
      scope,
      last.ref.path,
      nextStartRank,
    );
  }

  /** @type {string | null} */
  let snapshotGeneratedAt = null;
  try {
    const meta = await db.doc(`leaderboards/snapshots/boards/${scope}`).get();
    if (meta.exists) {
      const ga = meta.data()?.generatedAt;
      snapshotGeneratedAt = firestoreTimestampToIso(ga);
    }
  } catch {
    // optional metadata for "data as of" (Story E2)
  }

  logLeaderboardLine({
    requestId,
    httpStatus: 200,
    outcome: 'ok',
    latencyMs: Date.now() - startMs,
    rowCount: entries.length,
    scope,
    hasMore,
  });

  return res.status(200).json({
    schemaVersion: 1,
    scope,
    pageSize,
    entries,
    snapshotGeneratedAt,
    listingPolicy: {
      emailVerifiedRequired: requireVerified,
    },
    ...(nextPageToken ? { nextPageToken } : {}),
  });
}
