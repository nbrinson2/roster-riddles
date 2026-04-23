/**
 * Collection-group leaderboard queries (Story D1) — shared with docs/leaderboards/leaderboards-indexes-pagination.md
 */
import { FieldPath } from 'firebase-admin/firestore';

/** @typedef {'global' | 'bio-ball' | 'career-path' | 'nickname-streak'} LeaderboardScope */

export const LEADERBOARD_SCOPES = /** @type {const} */ ([
  'global',
  'bio-ball',
  'career-path',
  'nickname-streak',
]);

export const LEADERBOARD_MAX_PAGE_SIZE = 50;
export const LEADERBOARD_DEFAULT_PAGE_SIZE = 25;

const TOKEN_VERSION = 1;

/**
 * @param {unknown} scope
 * @returns {scope is LeaderboardScope}
 */
export function isLeaderboardScope(scope) {
  return (
    typeof scope === 'string' &&
    LEADERBOARD_SCOPES.includes(/** @type {LeaderboardScope} */ (scope))
  );
}

/**
 * Firestore orderBy target for the wins field (string or FieldPath for hyphenated map keys).
 * @param {LeaderboardScope} scope
 * @returns {string | import('firebase-admin/firestore').FieldPath}
 */
export function winsOrderFieldForScope(scope) {
  if (scope === 'global') return 'totals.wins';
  return new FieldPath('totalsByMode', scope, 'wins');
}

/**
 * @param {LeaderboardScope} scope
 * @param {Record<string, unknown> | undefined} data
 */
export function winsScoreFromStatsDoc(scope, data) {
  if (!data || typeof data !== 'object') return 0;
  if (scope === 'global') {
    const t = /** @type {Record<string, unknown>} */ (data).totals;
    if (!t || typeof t !== 'object') return 0;
    const w = /** @type {{ wins?: unknown }} */ (t).wins;
    return typeof w === 'number' && Number.isFinite(w) ? w : 0;
  }
  const byMode = /** @type {Record<string, unknown>} */ (data).totalsByMode;
  if (!byMode || typeof byMode !== 'object') return 0;
  const mode = /** @type {Record<string, unknown>} */ (byMode)[scope];
  if (!mode || typeof mode !== 'object') return 0;
  const w = /** @type {{ wins?: unknown }} */ (mode).wins;
  return typeof w === 'number' && Number.isFinite(w) ? w : 0;
}

/** @param {string} docPath */
export function uidFromStatsSummaryPath(docPath) {
  const m = /^users\/([^/]+)\/stats\/summary$/.exec(docPath);
  return m ? m[1] : null;
}

/**
 * @param {string} docPath
 * @returns {boolean}
 */
export function isValidStatsSummaryPath(docPath) {
  return uidFromStatsSummaryPath(docPath) !== null;
}

/**
 * @typedef {{ v: number, scope: LeaderboardScope, afterPath: string | null, startRank: number }} PageTokenPayload
 */

/**
 * @param {LeaderboardScope} scope
 * @param {string | null} afterPath — last doc path from previous page, or null for first page
 * @param {number} startRank — rank assigned to the first row of the **next** page (when encoding outgoing token)
 */
export function encodeLeaderboardPageToken(scope, afterPath, startRank) {
  /** @type {PageTokenPayload} */
  const payload = {
    v: TOKEN_VERSION,
    scope,
    afterPath,
    startRank,
  };
  return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
}

/**
 * @param {string} raw
 * @param {LeaderboardScope} expectedScope
 * @returns {{ ok: true, payload: PageTokenPayload } | { ok: false, error: string }}
 */
export function decodeLeaderboardPageToken(raw, expectedScope) {
  let parsed;
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    parsed = JSON.parse(json);
  } catch {
    return { ok: false, error: 'invalid_page_token' };
  }
  if (
    !parsed ||
    typeof parsed !== 'object' ||
    parsed.v !== TOKEN_VERSION ||
    typeof parsed.scope !== 'string' ||
    parsed.scope !== expectedScope ||
    typeof parsed.startRank !== 'number' ||
    !Number.isFinite(parsed.startRank) ||
    parsed.startRank < 1
  ) {
    return { ok: false, error: 'invalid_page_token' };
  }
  const afterPath =
    parsed.afterPath === null || parsed.afterPath === undefined
      ? null
      : typeof parsed.afterPath === 'string'
        ? parsed.afterPath
        : null;
  if (afterPath !== null && !isValidStatsSummaryPath(afterPath)) {
    return { ok: false, error: 'invalid_page_token' };
  }
  /** @type {PageTokenPayload} */
  const payload = {
    v: TOKEN_VERSION,
    scope: expectedScope,
    afterPath,
    startRank: Math.trunc(parsed.startRank),
  };
  return { ok: true, payload };
}

/**
 * ADR tie-break on a single page: score desc, uid asc.
 * @param {{ uid: string, score: number }[]} rows
 */
export function sortLeaderboardPageRows(rows) {
  return [...rows].sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return a.uid.localeCompare(b.uid);
  });
}

/**
 * @param {number} raw
 * @param {number} fallback
 */
export function clampPageSize(raw, fallback = LEADERBOARD_DEFAULT_PAGE_SIZE) {
  const n = typeof raw === 'number' && Number.isFinite(raw) ? Math.trunc(raw) : fallback;
  if (Number.isNaN(n) || n < 1) return fallback;
  return Math.min(LEADERBOARD_MAX_PAGE_SIZE, Math.max(1, n));
}

/**
 * Parse `pageSize` query string.
 * @param {unknown} q
 */
export function parsePageSizeQuery(q) {
  if (q === undefined || q === null || q === '') {
    return LEADERBOARD_DEFAULT_PAGE_SIZE;
  }
  const s = Array.isArray(q) ? q[0] : q;
  const n = Number.parseInt(String(s), 10);
  return clampPageSize(Number.isFinite(n) ? n : NaN);
}
