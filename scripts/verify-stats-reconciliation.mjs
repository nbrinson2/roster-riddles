#!/usr/bin/env node
import 'dotenv/config';

/**
 * Story 8 — Recompute `users/{uid}/stats/summary` from raw `gameplayEvents` and diff vs Firestore.
 *
 * Usage:
 *   FIREBASE_SERVICE_ACCOUNT_JSON='...' FIRESTORE_DATABASE_ID=roster-riddles \
 *     node scripts/verify-stats-reconciliation.mjs <uid>
 *
 * Options:
 *   --limit N   Process only the first N events after sorting by createdAt (oldest first). Warns if truncated.
 *   --verbose   Print event order summary and optional lastPlayedAt check.
 *
 * Exit: 0 if aggregate matches recomputation; 1 on mismatch or invalid events; 2 usage / Firestore init / truncated --limit.
 *
 * @see docs/platform/stats-reconciliation.md
 */
import { isDeepStrictEqual } from 'node:util';
import process from 'node:process';

import { Timestamp } from 'firebase-admin/firestore';
import {
  applyEventToStatsTree,
  defaultStatsTree,
  normalizeStatsFromFirestore,
  STATS_DOC_ID,
} from '../server/lib/stats-aggregate.js';
import { getAdminFirestore } from '../server/lib/admin-firestore.js';

const VALID_RESULTS = new Set(['won', 'lost', 'abandoned']);
const VALID_MODES = new Set(['bio-ball', 'career-path', 'nickname-streak']);

/**
 * @param {string[]} argv
 * @returns {{ uid?: string, limit?: number, verbose: boolean }}
 */
function parseArgs(argv) {
  const out = /** @type {{ uid?: string, limit?: number, verbose: boolean }} */ ({
    verbose: false,
  });
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-v' || a === '--verbose') {
      out.verbose = true;
    } else if (a === '--limit' && argv[i + 1]) {
      out.limit = Number(argv[++i]);
    } else if (a.startsWith('--limit=')) {
      out.limit = Number(a.slice('--limit='.length));
    } else if (a.startsWith('--uid=')) {
      out.uid = a.slice('--uid='.length);
    } else if (!a.startsWith('-')) {
      positional.push(a);
    }
  }
  if (!out.uid && positional[0]) {
    out.uid = positional[0];
  }
  return out;
}

/**
 * @param {unknown} ts
 * @returns {number | null}
 */
function timestampMs(ts) {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (typeof ts === 'object' && ts !== null && 'toMillis' in ts && typeof ts.toMillis === 'function') {
    try {
      return /** @type {{ toMillis: () => number }} */ (ts).toMillis();
    } catch {
      return null;
    }
  }
  return null;
}

/**
 * @param {Record<string, unknown>} raw
 * @returns {{ result: string, gameMode: string, durationMs: number, mistakeCount: number, modeMetrics?: Record<string, unknown> } | null}
 */
function toStatsInput(raw) {
  const result = raw.result;
  const gameMode = raw.gameMode;
  if (typeof result !== 'string' || !VALID_RESULTS.has(result)) {
    return null;
  }
  if (typeof gameMode !== 'string' || !VALID_MODES.has(gameMode)) {
    return null;
  }
  const durationMs =
    typeof raw.durationMs === 'number' && Number.isFinite(raw.durationMs)
      ? Math.trunc(raw.durationMs)
      : 0;
  const mistakeCount =
    typeof raw.mistakeCount === 'number' && Number.isFinite(raw.mistakeCount)
      ? Math.trunc(raw.mistakeCount)
      : 0;
  /** @type {{ result: string, gameMode: string, durationMs: number, mistakeCount: number, modeMetrics?: Record<string, unknown> }} */
  const out = { result, gameMode, durationMs, mistakeCount };
  const mm = raw.modeMetrics;
  if (mm && typeof mm === 'object') {
    out.modeMetrics = /** @type {Record<string, unknown>} */ (mm);
  }
  return out;
}

/**
 * Core aggregate fields only (no Firestore metadata).
 * @param {import('../server/lib/stats-aggregate.js').StatsTree | ReturnType<typeof normalizeStatsFromFirestore>} tree
 */
function coreAggregate(tree) {
  return {
    aggregateVersion: tree.aggregateVersion,
    totals: tree.totals,
    totalsByMode: tree.totalsByMode,
    streaks: tree.streaks,
    bests: tree.bests,
  };
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 */
async function loadAndRecompute(db, uid, limit, verbose) {
  const col = db.collection('users').doc(uid).collection('gameplayEvents');
  const snap = await col.get();
  /** @type {Array<{ id: string, data: Record<string, unknown>, createdMs: number }>} */
  const rows = [];
  snap.forEach((doc) => {
    const data = doc.data() ?? {};
    const createdMs = timestampMs(data.createdAt) ?? Number.MAX_SAFE_INTEGER;
    rows.push({ id: doc.id, data, createdMs });
  });
  rows.sort((a, b) => {
    if (a.createdMs !== b.createdMs) return a.createdMs - b.createdMs;
    return a.id.localeCompare(b.id);
  });

  const missingCreated = rows.filter((r) => r.createdMs === Number.MAX_SAFE_INTEGER);
  if (missingCreated.length) {
    console.warn(
      `[verify-stats] Warning: ${missingCreated.length} event(s) missing createdAt; sorted last by id.`,
    );
  }

  let slice = rows;
  let truncated = false;
  if (limit != null && Number.isFinite(limit) && limit > 0 && rows.length > limit) {
    slice = rows.slice(0, limit);
    truncated = true;
    console.warn(
      `[verify-stats] Processing only first ${limit} events (of ${rows.length}) — totals will NOT match stored aggregate.`,
    );
  }

  if (verbose) {
    console.log(`[verify-stats] Events in apply order (${slice.length}):`);
    slice.forEach((r, i) => {
      const si = toStatsInput(r.data);
      console.log(
        `  ${i + 1}. ${r.id.slice(0, 12)}… ${si ? `${si.result} ${si.gameMode}` : '(invalid payload)'}`,
      );
    });
  }

  /** @type {import('../server/lib/stats-aggregate.js').StatsTree | null} */
  let tree = null;
  const bad = [];
  for (const r of slice) {
    const input = toStatsInput(r.data);
    if (!input) {
      bad.push(r.id);
      continue;
    }
    tree = applyEventToStatsTree(tree, input);
  }
  if (bad.length) {
    console.error(
      `[verify-stats] Skipped ${bad.length} event(s) with invalid result/gameMode:`,
      bad.slice(0, 5).join(', '),
      bad.length > 5 ? '…' : '',
    );
  }

  return {
    tree,
    totalDocs: rows.length,
    processed: slice.length,
    truncated,
    skippedInvalid: bad.length,
    lastEventCreatedMs:
      slice.length > 0 &&
      slice[slice.length - 1].createdMs !== Number.MAX_SAFE_INTEGER
        ? slice[slice.length - 1].createdMs
        : null,
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const uid = args.uid?.trim();
  if (!uid) {
    console.error(
      'Usage: node scripts/verify-stats-reconciliation.mjs <uid> [--limit N] [--verbose]\n',
    );
    process.exit(2);
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    console.error('[verify-stats] Firestore init failed:', e?.message ?? e);
    process.exit(2);
  }

  const statsRef = db.collection('users').doc(uid).collection('stats').doc(STATS_DOC_ID);
  const [statsSnap, recompute] = await Promise.all([
    statsRef.get(),
    loadAndRecompute(db, uid, args.limit, args.verbose),
  ]);

  if (!statsSnap.exists) {
    console.error(`[verify-stats] No aggregate document users/${uid}/stats/${STATS_DOC_ID}`);
    if (recompute.tree && recompute.processed > 0) {
      console.error('[verify-stats] Recomputed from events is non-empty — mismatch.');
      process.exit(1);
    }
    if (recompute.totalDocs === 0) {
      console.log('[verify-stats] No events and no aggregate — OK (empty user).');
      process.exit(0);
    }
    process.exit(1);
  }

  const stored = normalizeStatsFromFirestore(statsSnap.data());
  const finalTree = recompute.tree ?? defaultStatsTree();
  const recomputedCore = coreAggregate(finalTree);
  const storedCore = coreAggregate(stored);

  if (recompute.truncated) {
    console.error(
      '[verify-stats] Equality check skipped (--limit truncated). Re-run without --limit for a full reconciliation.',
    );
    process.exit(2);
  }

  if (recompute.skippedInvalid > 0) {
    console.error('[verify-stats] Cannot reconcile: invalid event payloads present.');
    process.exit(1);
  }

  if (!isDeepStrictEqual(recomputedCore, storedCore)) {
    console.error('[verify-stats] MISMATCH: aggregate ≠ replay from gameplayEvents\n');
    console.error('--- stored (normalized) ---');
    console.error(JSON.stringify(storedCore, null, 2));
    console.error('--- recomputed ---');
    console.error(JSON.stringify(recomputedCore, null, 2));
    process.exit(1);
  }

  if (args.verbose) {
    const data = statsSnap.data() ?? {};
    const lastPlayedMs = timestampMs(data.lastPlayedAt);
    if (
      recompute.lastEventCreatedMs != null &&
      lastPlayedMs != null &&
      recompute.lastEventCreatedMs !== lastPlayedMs
    ) {
      console.warn(
        `[verify-stats] Note: last event createdAt (${recompute.lastEventCreatedMs}) ≠ lastPlayedAt (${lastPlayedMs}) on aggregate (ms).`,
      );
    } else if (args.verbose && recompute.processed > 0) {
      console.log('[verify-stats] lastPlayedAt matches last event createdAt (ms).');
    }
  }

  console.log(
    `[verify-stats] OK — users/${uid}/stats/${STATS_DOC_ID} matches replay of ${recompute.processed} gameplay event(s).`,
  );
  process.exit(0);
}

main().catch((e) => {
  console.error('[verify-stats] Fatal:', e);
  process.exit(2);
});
