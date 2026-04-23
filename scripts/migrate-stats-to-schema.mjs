#!/usr/bin/env node
/**
 * Migrate `users/{uid}/stats/summary` to the current aggregate schema by **replaying**
 * all `users/{uid}/gameplayEvents/*` through `server/lib/stats-aggregate.js` (`applyEventToStatsTree`).
 *
 * Gameplay event documents are **not modified** by default; they are already the source of truth
 * for totals, per-mode totals, per-mode win streaks, bests, and optional `modeMetrics` merges.
 *
 * Usage (requires Admin SDK env — same as `verify-stats-reconciliation.mjs`):
 *
 *   FIREBASE_SERVICE_ACCOUNT_JSON='...' FIRESTORE_DATABASE_ID=roster-riddles \
 *     node scripts/migrate-stats-to-schema.mjs --uid <firebaseAuthUid>
 *
 *   # Dry-run (default): print whether stored summary differs from replay; no writes
 *   node scripts/migrate-stats-to-schema.mjs --uid <uid> --verbose
 *
 *   # Apply recomputed summary to Firestore (writes only when replay ≠ stored summary)
 *   node scripts/migrate-stats-to-schema.mjs --uid <uid> --apply
 *
 *   # All users that have at least one gameplay event (paginates `users` collection)
 *   node scripts/migrate-stats-to-schema.mjs --all-users --apply
 *
 * Options:
 *   --uid <id>       Migrate a single user (mutually exclusive with --all-users)
 *   --all-users      Iterate `users/*` and migrate each user who has ≥1 gameplay event
 *   --apply          Write `users/{uid}/stats/summary` (default is dry-run only)
 *   --verbose        Log per-user diff JSON when dry-run mismatch
 *   --max-users N    With --all-users, stop after N users (safety cap)
 *
 * Exit codes: 0 success; 1 dry-run mismatch for single uid; 2 usage / Firestore init / fatal
 *
 * @see scripts/verify-stats-reconciliation.mjs
 * @see server/lib/stats-aggregate.js
 */
import 'dotenv/config';
import process from 'node:process';
import { isDeepStrictEqual } from 'node:util';

import { FieldPath, Timestamp } from 'firebase-admin/firestore';
import {
  applyEventToStatsTree,
  buildStatsFirestoreDocument,
  defaultStatsTree,
  normalizeStatsFromFirestore,
  STATS_DOC_ID,
} from '../server/lib/stats-aggregate.js';
import { getAdminFirestore } from '../server/lib/admin-firestore.js';

const VALID_RESULTS = new Set(['won', 'lost', 'abandoned']);
const VALID_MODES = new Set(['bio-ball', 'career-path', 'nickname-streak']);

/**
 * @param {unknown} ts
 * @returns {number | null}
 */
function timestampMs(ts) {
  if (!ts) return null;
  if (ts instanceof Timestamp) return ts.toMillis();
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toMillis' in ts &&
    typeof /** @type {{ toMillis: () => number }} */ (ts).toMillis === 'function'
  ) {
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
async function loadEventsSorted(db, uid) {
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
  return rows;
}

/**
 * @param {Array<{ id: string, data: Record<string, unknown>, createdMs: number }>} rows
 */
function replayToTree(rows) {
  /** @type {import('../server/lib/stats-aggregate.js').StatsTree | null} */
  let tree = null;
  const bad = [];
  for (const r of rows) {
    const input = toStatsInput(r.data);
    if (!input) {
      bad.push(r.id);
      continue;
    }
    tree = applyEventToStatsTree(tree, input);
  }
  const finalTree = tree ?? defaultStatsTree();
  const lastCreatedMs =
    rows.length > 0 && rows[rows.length - 1].createdMs !== Number.MAX_SAFE_INTEGER
      ? rows[rows.length - 1].createdMs
      : null;
  return { finalTree, bad, lastCreatedMs };
}

/**
 * @param {import('firebase-admin/firestore').Firestore} db
 * @param {string} uid
 * @param {{ apply: boolean, verbose: boolean }}
 */
async function migrateOneUser(db, uid, { apply, verbose }) {
  const rows = await loadEventsSorted(db, uid);
  if (rows.length === 0) {
    return {
      uid,
      skipped: true,
      reason: 'no_gameplay_events',
      eventCount: 0,
      mismatch: false,
      written: false,
    };
  }

  const { finalTree, bad, lastCreatedMs } = replayToTree(rows);
  if (bad.length > 0) {
    console.warn(
      `[migrate-stats] ${uid}: skipped ${bad.length} invalid event(s), ids: ${bad.slice(0, 5).join(', ')}${bad.length > 5 ? '…' : ''}`,
    );
  }

  const statsRef = db.collection('users').doc(uid).collection('stats').doc(STATS_DOC_ID);
  const statsSnap = await statsRef.get();
  const stored = normalizeStatsFromFirestore(statsSnap.exists ? statsSnap.data() : undefined);
  const recomputedCore = coreAggregate(finalTree);
  const storedCore = coreAggregate(stored);
  const mismatch = !isDeepStrictEqual(recomputedCore, storedCore);

  if (verbose && mismatch) {
    console.log(`[migrate-stats] ${uid}: stored (normalized core) —`);
    console.log(JSON.stringify(storedCore, null, 2));
    console.log(`[migrate-stats] ${uid}: recomputed core —`);
    console.log(JSON.stringify(recomputedCore, null, 2));
  }

  let written = false;
  if (apply && mismatch) {
    const lastTs =
      lastCreatedMs != null ? Timestamp.fromMillis(lastCreatedMs) : Timestamp.now();
    const payload = buildStatsFirestoreDocument(finalTree, lastTs);
    await statsRef.set(payload);
    written = true;
  }

  return {
    uid,
    skipped: false,
    eventCount: rows.length,
    skippedInvalid: bad.length,
    mismatch,
    written,
  };
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  /** @type {{ uid?: string, allUsers: boolean, apply: boolean, verbose: boolean, maxUsers?: number }} */
  const out = {
    allUsers: false,
    apply: false,
    verbose: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--all-users') {
      out.allUsers = true;
    } else if (a === '--apply') {
      out.apply = true;
    } else if (a === '--verbose' || a === '-v') {
      out.verbose = true;
    } else if (a === '--uid' && argv[i + 1]) {
      out.uid = argv[++i].trim();
    } else if (a.startsWith('--uid=')) {
      out.uid = a.slice('--uid='.length).trim();
    } else if (a === '--max-users' && argv[i + 1]) {
      out.maxUsers = Number(argv[++i]);
    } else if (a.startsWith('--max-users=')) {
      out.maxUsers = Number(a.slice('--max-users='.length));
    }
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if ((!args.uid && !args.allUsers) || (args.uid && args.allUsers)) {
    console.error(
      'Usage: node scripts/migrate-stats-to-schema.mjs --uid <firebaseAuthUid> [--apply] [--verbose]\n' +
        '   or: node scripts/migrate-stats-to-schema.mjs --all-users [--apply] [--verbose] [--max-users N]\n',
    );
    process.exit(2);
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    console.error('[migrate-stats] Firestore init failed:', e?.message ?? e);
    process.exit(2);
  }

  if (args.uid) {
    const r = await migrateOneUser(db, args.uid, {
      apply: args.apply,
      verbose: args.verbose,
    });
    if (r.skipped) {
      console.log(`[migrate-stats] ${r.uid}: skipped (${r.reason}).`);
      process.exit(0);
    }
    console.log(
      `[migrate-stats] ${r.uid}: events=${r.eventCount} invalidSkipped=${r.skippedInvalid} mismatch=${r.mismatch} apply=${args.apply}`,
    );
    if (r.mismatch && !args.apply) {
      console.error(
        '[migrate-stats] Dry-run: aggregate differs from replay. Re-run with --apply to write `stats/summary`.',
      );
      process.exit(1);
    }
    if (args.apply) {
      if (r.written) {
        console.log(`[migrate-stats] ${r.uid}: wrote users/${r.uid}/stats/${STATS_DOC_ID}`);
      } else {
        console.log(
          `[migrate-stats] ${r.uid}: summary already matches replay; skipped write.`,
        );
      }
    }
    process.exit(0);
  }

  /** @type {string[]} */
  const uids = [];
  let q = db.collection('users').orderBy(FieldPath.documentId()).limit(500);
  // Paginate all `users` docs (document id order) until exhausted or `--max-users`.
  paginateUsers: while (true) {
    const snap = await q.get();
    if (snap.empty) {
      break paginateUsers;
    }
    for (const d of snap.docs) {
      uids.push(d.id);
      if (args.maxUsers != null && uids.length >= args.maxUsers) {
        break paginateUsers;
      }
    }
    if (snap.docs.length < 500) {
      break paginateUsers;
    }
    const lastDoc = snap.docs[snap.docs.length - 1];
    q = db.collection('users').orderBy(FieldPath.documentId()).startAfter(lastDoc).limit(500);
  }

  let migrated = 0;
  let mismatches = 0;
  let skippedNoEvents = 0;
  let writes = 0;

  for (const uid of uids) {
    const r = await migrateOneUser(db, uid, { apply: args.apply, verbose: false });
    if (r.skipped) {
      skippedNoEvents++;
      continue;
    }
    migrated++;
    if (r.mismatch) {
      mismatches++;
      if (args.verbose) {
        console.log(`[migrate-stats] mismatch uid=${uid} (use single --uid + --verbose for full diff)`);
      }
    }
    if (r.written) {
      writes++;
    }
  }

  console.log(
    `[migrate-stats] --all-users done: usersScanned=${uids.length} withEvents=${migrated} noEvents=${skippedNoEvents} mismatches=${mismatches} writes=${writes} apply=${args.apply}`,
  );

  if (mismatches > 0 && !args.apply) {
    console.error(
      '[migrate-stats] Dry-run: at least one user had a mismatch. Re-run with --apply to write all recomputed summaries (only users with ≥1 event).',
    );
    process.exit(1);
  }

  process.exit(0);
}

main().catch((e) => {
  console.error('[migrate-stats] Fatal:', e);
  process.exit(2);
});
