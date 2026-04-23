#!/usr/bin/env node
/**
 * Story G1 — seed a staging weekly contest document, entries, and Bio Ball `gameplayEvents`
 * so `run-scoring` yields predictable standings + dry-run payouts.
 *
 * Usage:
 *   node scripts/seed-weekly-contest-staging.mjs [path/to/fixture.json] [--dry-run]
 *
 * Default path: ./weekly-contest-staging.json or env WEEKLY_CONTEST_STAGING_FIXTURE.
 * Requires Firebase Admin: GOOGLE_APPLICATION_CREDENTIALS or FIREBASE_SERVICE_ACCOUNT_JSON;
 * optional FIRESTORE_DATABASE_ID.
 *
 * Exit: 0 OK; 1 validation; 2 Firestore error.
 *
 * @see docs/weekly-contests/weekly-contests-staging-seed-g1.md
 */
import 'dotenv/config';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

import { getAdminFirestore } from '../server/lib/admin-firestore.js';
import { computeGameplayEventId } from '../server/gameplay/gameplay-events.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const STATUSES = new Set(['scheduled', 'open', 'scoring', 'paid', 'cancelled']);
const RESULTS = new Set(['won', 'lost', 'abandoned']);

function usage() {
  console.error(
    'Usage: node scripts/seed-weekly-contest-staging.mjs [fixture.json] [--dry-run]\n' +
      '  Default: ./weekly-contest-staging.json or env WEEKLY_CONTEST_STAGING_FIXTURE',
  );
}

/**
 * @param {unknown} v
 * @returns {v is string}
 */
function nonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * @param {unknown} raw
 */
function validateFixture(raw) {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('Fixture must be a JSON object.');
  }
  const o = /** @type {Record<string, unknown>} */ (raw);
  const contestId = o.contestId;
  if (!nonEmptyString(contestId) || contestId.includes('REPLACE')) {
    throw new Error('contestId must be a non-empty string (replace placeholders).');
  }
  const ws = o.windowStart;
  const we = o.windowEnd;
  if (!nonEmptyString(ws) || !nonEmptyString(we)) {
    throw new Error('windowStart and windowEnd must be ISO date strings.');
  }
  const leagueGamesN =
    typeof o.leagueGamesN === 'number' && Number.isFinite(o.leagueGamesN)
      ? o.leagueGamesN
      : 10;
  if (leagueGamesN < 1 || leagueGamesN > 100) {
    throw new Error('leagueGamesN must be between 1 and 100.');
  }
  const status = typeof o.status === 'string' ? o.status : 'open';
  if (!STATUSES.has(status)) {
    throw new Error(`Invalid status: ${status}`);
  }
  const entrants = o.entrants;
  if (!Array.isArray(entrants) || entrants.length === 0) {
    throw new Error('entrants must be a non-empty array.');
  }

  const windowStartMs = Date.parse(ws);
  const windowEndMs = Date.parse(we);
  if (!Number.isFinite(windowStartMs) || !Number.isFinite(windowEndMs)) {
    throw new Error('windowStart / windowEnd must parse as dates.');
  }
  if (windowStartMs >= windowEndMs) {
    throw new Error('windowStart must be before windowEnd.');
  }

  for (let i = 0; i < entrants.length; i++) {
    const e = entrants[i];
    if (e == null || typeof e !== 'object' || Array.isArray(e)) {
      throw new Error(`entrants[${i}] must be an object.`);
    }
    const row = /** @type {Record<string, unknown>} */ (e);
    const uid = row.uid;
    if (!nonEmptyString(uid) || String(uid).includes('REPLACE')) {
      throw new Error(`entrants[${i}].uid must be a real Firebase uid (no placeholders).`);
    }
    const ja = row.joinedAt;
    if (!nonEmptyString(ja)) {
      throw new Error(`entrants[${i}].joinedAt is required (ISO string).`);
    }
    const joinedMs = Date.parse(ja);
    if (!Number.isFinite(joinedMs)) {
      throw new Error(`entrants[${i}].joinedAt must parse as a date.`);
    }
    if (joinedMs < windowStartMs || joinedMs >= windowEndMs) {
      throw new Error(
        `entrants[${i}].joinedAt must satisfy windowStart <= joinedAt < windowEnd.`,
      );
    }
    const slate = row.slate;
    if (!Array.isArray(slate) || slate.length === 0) {
      throw new Error(`entrants[${i}].slate must be a non-empty array of results.`);
    }
    if (slate.length > leagueGamesN) {
      throw new Error(
        `entrants[${i}].slate length (${slate.length}) cannot exceed leagueGamesN (${leagueGamesN}).`,
      );
    }
    for (let j = 0; j < slate.length; j++) {
      const r = slate[j];
      if (!RESULTS.has(r)) {
        throw new Error(
          `entrants[${i}].slate[${j}] must be won | lost | abandoned (got ${String(r)}).`,
        );
      }
    }
  }

  return {
    raw: o,
    contestId: String(contestId).trim(),
    windowStartMs,
    windowEndMs,
    leagueGamesN,
    status: /** @type {'scheduled'|'open'|'scoring'|'paid'|'cancelled'} */ (status),
    entrants,
  };
}

/**
 * @param {import('firebase-admin/firestore').Firestore | null} db
 * @param {Awaited<ReturnType<typeof validateFixture>>} spec
 * @param {boolean} dryRun
 */
async function seed(db, spec, dryRun) {
  const { raw, contestId, windowStartMs, windowEndMs, leagueGamesN, status, entrants } =
    spec;
  const rulesVersion = raw.rulesVersion ?? 1;
  const title =
    typeof raw.title === 'string' && raw.title.trim()
      ? raw.title.trim()
      : contestId;
  const metadata =
    raw.metadata != null && typeof raw.metadata === 'object' && !Array.isArray(raw.metadata)
      ? /** @type {Record<string, unknown>} */ (raw.metadata)
      : {};

  const eventSpacingMs = 60_000;

  if (dryRun) {
    let eventCount = 0;
    for (const ent of entrants) {
      const row = /** @type {Record<string, unknown>} */ (
        ent && typeof ent === 'object' && !Array.isArray(ent) ? ent : {}
      );
      const joinedMs = Date.parse(String(row.joinedAt));
      const lowerMs = Math.max(windowStartMs, joinedMs);
      const slate = /** @type {string[]} */ (row.slate);
      for (let i = 0; i < slate.length && i < leagueGamesN; i++) {
        const createdMs = lowerMs + (i + 1) * eventSpacingMs;
        if (createdMs >= windowEndMs) {
          throw new Error(
            `Not enough room before windowEnd for event ${i} — widen the window or tighten slate spacing.`,
          );
        }
        eventCount += 1;
      }
    }
    console.log(
      JSON.stringify({
        component: 'seed_weekly_contest_staging',
        outcome: 'dry_run',
        contestId,
        status,
        leagueGamesN,
        entrantCount: entrants.length,
        gameplayEventDocs: eventCount,
      }),
    );
    return;
  }

  if (!db) {
    throw new Error('Firestore instance required when not dry-run.');
  }

  const batch = db.batch();
  const contestRef = db.doc(`contests/${contestId}`);

  batch.set(contestRef, {
    schemaVersion: 1,
    status,
    gameMode: 'bio-ball',
    rulesVersion,
    windowStart: Timestamp.fromMillis(windowStartMs),
    windowEnd: Timestamp.fromMillis(windowEndMs),
    leagueGamesN,
    title,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    metadata: {
      ...metadata,
      seededBy: 'scripts/seed-weekly-contest-staging.mjs',
      storyG1: true,
    },
  });

  let eventCount = 0;

  for (const ent of entrants) {
    const row = /** @type {Record<string, unknown>} */ (
      ent && typeof ent === 'object' && !Array.isArray(ent) ? ent : {}
    );
    const uid = String(row.uid);
    const joinedMs = Date.parse(String(row.joinedAt));
    const lowerMs = Math.max(windowStartMs, joinedMs);
    const slate = /** @type {string[]} */ (row.slate);

    const entryRef = db.doc(`contests/${contestId}/entries/${uid}`);
    batch.set(entryRef, {
      schemaVersion: 1,
      contestId,
      uid,
      rulesAcceptedVersion: rulesVersion,
      joinedAt: Timestamp.fromMillis(joinedMs),
      displayNameSnapshot:
        row.displayNameSnapshot === null
          ? null
          : typeof row.displayNameSnapshot === 'string'
            ? row.displayNameSnapshot
            : null,
      clientRequestId: `seed-g1-${contestId}-${uid}`,
    });

    for (let i = 0; i < slate.length && i < leagueGamesN; i++) {
      const result = slate[i];
      const createdMs = lowerMs + (i + 1) * eventSpacingMs;
      if (createdMs >= windowEndMs) {
        throw new Error(
          `Not enough room before windowEnd for ${uid} event ${i} — widen the window or tighten slate spacing.`,
        );
      }
      const clientSessionId = `seed-g1-${contestId}-${uid}-evt-${i}`;
      const eventId = computeGameplayEventId(uid, clientSessionId);
      const eventRef = db
        .collection('users')
        .doc(uid)
        .collection('gameplayEvents')
        .doc(eventId);

      batch.set(eventRef, {
        schemaVersion: 1,
        gameMode: 'bio-ball',
        result,
        durationMs: 60_000,
        mistakeCount: result === 'abandoned' ? 2 : 1,
        clientSessionId,
        uid,
        createdAt: Timestamp.fromMillis(createdMs),
        deployment: 'staging',
      });
      eventCount += 1;
    }
  }

  await batch.commit();
  console.log(
    JSON.stringify({
      component: 'seed_weekly_contest_staging',
      outcome: 'ok',
      contestId,
      status,
      leagueGamesN,
      entrantCount: entrants.length,
      gameplayEventDocs: eventCount,
    }),
  );
}

async function main() {
  const argv = process.argv.slice(2).filter((a) => a !== '--dry-run');
  const dryRun = process.argv.includes('--dry-run');

  const argPath = argv[0];
  const envPath = process.env.WEEKLY_CONTEST_STAGING_FIXTURE?.trim();
  const defaultPath = path.join(root, 'weekly-contest-staging.json');
  const fixturePath =
    argPath ||
    envPath ||
    (fs.existsSync(defaultPath) ? defaultPath : null);

  if (!fixturePath) {
    usage();
    process.exit(1);
  }

  const resolved = path.isAbsolute(fixturePath)
    ? fixturePath
    : path.join(root, fixturePath);

  let parsed;
  try {
    const text = fs.readFileSync(resolved, 'utf8');
    parsed = JSON.parse(text);
  } catch (e) {
    console.error(
      e instanceof Error ? e.message : String(e),
    );
    process.exit(1);
  }

  let spec;
  try {
    spec = validateFixture(parsed);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  if (dryRun) {
    try {
      await seed(null, spec, true);
    } catch (e) {
      console.error(e instanceof Error ? e.message : String(e));
      process.exit(1);
    }
    process.exit(0);
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    console.error(
      e instanceof Error ? e.message : String(e),
    );
    process.exit(2);
  }

  try {
    await seed(db, spec, false);
  } catch (e) {
    console.error(
      e instanceof Error ? e.message : String(e),
    );
    process.exit(2);
  }
}

main();
