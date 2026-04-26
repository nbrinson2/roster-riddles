/**
 * In-memory TTL cache for GET /api/v1/contests/:contestId/leaderboard (Phase 2).
 * Keyed by contest id + timing + entry fingerprint so new joins or window edits invalidate.
 */
import { createHash } from 'node:crypto';
import { Timestamp } from 'firebase-admin/firestore';

/**
 * @param {unknown} v
 * @returns {v is Record<string, unknown>}
 */
function isRecord(v) {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/**
 * @param {import('firebase-admin/firestore').QueryDocumentSnapshot[]} entryDocs
 * @param {boolean} entrantsCapped
 * @param {number} contestUpdatedMillis — `contests.updatedAt` when present, else `0`
 */
export function buildLiveLeaderboardCacheKey(
  contestId,
  windowStart,
  windowEnd,
  leagueGamesN,
  entryDocs,
  entrantsCapped,
  contestUpdatedMillis,
) {
  const parts = entryDocs.map((d) => {
    const raw = d.data();
    const j = isRecord(raw) ? raw.joinedAt : null;
    const jm = j instanceof Timestamp ? j.toMillis() : -1;
    return `${d.id}:${jm}`;
  });
  parts.sort();
  const payload = [
    'v1',
    contestId,
    windowStart.toMillis(),
    windowEnd.toMillis(),
    String(leagueGamesN),
    String(contestUpdatedMillis),
    entrantsCapped ? 'cap1' : 'cap0',
    String(entryDocs.length),
    ...parts,
  ].join('\n');
  return createHash('sha256').update(payload, 'utf8').digest('hex');
}

function parsePositiveInt(raw, fallback) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 0) return fallback;
  return n;
}

function parsePositiveIntMin1(raw, fallback) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

export class ContestLiveLeaderboardMemoryCache {
  /**
   * @param {{ ttlMs: number, maxKeys: number }} opts
   */
  constructor(opts) {
    this.ttlMs = opts.ttlMs;
    this.maxKeys = opts.maxKeys;
    /** @type {Map<string, { expiresAt: number, payload: Record<string, unknown> }>} */
    this.map = new Map();
  }

  /**
   * @param {string} contestId
   * @param {string} fingerprint
   * @returns {Record<string, unknown> | null}
   */
  get(contestId, fingerprint) {
    if (this.ttlMs <= 0) {
      return null;
    }
    const key = `${contestId}:${fingerprint}`;
    const row = this.map.get(key);
    if (!row) {
      return null;
    }
    if (Date.now() >= row.expiresAt) {
      this.map.delete(key);
      return null;
    }
    this.map.delete(key);
    this.map.set(key, row);
    return structuredClone(row.payload);
  }

  /**
   * @param {string} contestId
   * @param {string} fingerprint
   * @param {Record<string, unknown>} payload — JSON-serializable response body (without `cache` field)
   */
  set(contestId, fingerprint, payload) {
    if (this.ttlMs <= 0) {
      return;
    }
    const key = `${contestId}:${fingerprint}`;
    while (this.map.size >= this.maxKeys) {
      const first = this.map.keys().next().value;
      if (first === undefined) {
        break;
      }
      this.map.delete(first);
    }
    this.map.set(key, {
      expiresAt: Date.now() + this.ttlMs,
      payload: structuredClone(payload),
    });
  }
}

/** @type {ContestLiveLeaderboardMemoryCache | null} */
let singleton = null;

export function getContestLiveLeaderboardCache() {
  if (singleton) {
    return singleton;
  }
  const ttlMs = parsePositiveInt(
    process.env.CONTEST_LIVE_LEADERBOARD_CACHE_TTL_MS,
    30_000,
  );
  const maxKeys = parsePositiveIntMin1(
    process.env.CONTEST_LIVE_LEADERBOARD_CACHE_MAX_KEYS,
    250,
  );
  singleton = new ContestLiveLeaderboardMemoryCache({ ttlMs, maxKeys });
  return singleton;
}

/** Test hook — clears singleton so env can be re-read. */
export function resetContestLiveLeaderboardCacheForTests() {
  singleton = null;
}
