#!/usr/bin/env node
/**
 * Story G1 — verify a fixed test cohort’s `users/{uid}/stats/summary` wins match a JSON fixture
 * and that **within-cohort** global ordering matches `expectedGlobalOrder` (ADR tie-break).
 *
 * Usage:
 *   node scripts/verify-leaderboard-cohort.mjs [path/to/fixture.json]
 *
 * Default path: `./leaderboard-test-cohort.json` or `LEADERBOARD_COHORT_FIXTURE`.
 * Requires Firebase Admin (same as other verify scripts): `GOOGLE_APPLICATION_CREDENTIALS` or
 * `FIREBASE_SERVICE_ACCOUNT_JSON`, optional `FIRESTORE_DATABASE_ID`.
 *
 * Exit: 0 OK; 1 mismatch / missing doc; 2 usage / read error.
 *
 * @see docs/leaderboards-test-cohort-g1.md
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import process from 'process';
import { fileURLToPath } from 'url';

import { getAdminFirestore } from '../server/lib/admin-firestore.js';
import {
  LEADERBOARD_SCOPES,
  sortLeaderboardPageRows,
  winsScoreFromStatsDoc,
} from '../server/leaderboards/leaderboard-query.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function usage() {
  console.error(
    'Usage: node scripts/verify-leaderboard-cohort.mjs [fixture.json]\n' +
      '  Default: ./leaderboard-test-cohort.json or env LEADERBOARD_COHORT_FIXTURE',
  );
}

/**
 * @param {unknown} data
 * @param {string} uid
 * @param {Record<string, number>} exp
 */
function assertWins(data, uid, exp) {
  for (const [mode, want] of Object.entries(exp)) {
    const scope =
      mode === 'global' ? 'global' : /** @type {import('../server/leaderboards/leaderboard-query.js').LeaderboardScope} */ (mode);
    if (mode !== 'global' && !LEADERBOARD_SCOPES.includes(/** @type {string} */ (scope))) {
      console.error(`Unknown mode in fixture for ${uid}: ${mode}`);
      process.exit(1);
    }
    const got = winsScoreFromStatsDoc(scope, data);
    if (got !== want) {
      console.error(
        JSON.stringify({
          component: 'verify_leaderboard_cohort',
          outcome: 'wins_mismatch',
          uid,
          scope: mode,
          expected: want,
          actual: got,
        }),
      );
      process.exit(1);
    }
  }
}

async function main() {
  const argPath = process.argv[2];
  const envPath = process.env.LEADERBOARD_COHORT_FIXTURE?.trim();
  const defaultPath = path.join(root, 'leaderboard-test-cohort.json');
  const fixturePath =
    argPath ||
    envPath ||
    (fs.existsSync(defaultPath) ? defaultPath : null);

  if (!fixturePath) {
    usage();
    process.exit(2);
  }

  let raw;
  try {
    raw = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  } catch (e) {
    console.error(
      JSON.stringify({
        component: 'verify_leaderboard_cohort',
        outcome: 'fixture_read_failed',
        path: fixturePath,
        message: e instanceof Error ? e.message : String(e),
      }),
    );
    process.exit(2);
  }

  const cohort = raw.cohort;
  const expectedGlobalOrder = raw.expectedGlobalOrder;
  if (!Array.isArray(cohort) || cohort.length === 0) {
    console.error('Fixture must include non-empty "cohort" array.');
    process.exit(2);
  }
  if (!Array.isArray(expectedGlobalOrder) || expectedGlobalOrder.length === 0) {
    console.error('Fixture must include non-empty "expectedGlobalOrder" array.');
    process.exit(2);
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    console.error(
      JSON.stringify({
        component: 'verify_leaderboard_cohort',
        outcome: 'firestore_init_failed',
        message: e instanceof Error ? e.message : String(e),
      }),
    );
    process.exit(2);
  }

  /** @type {{ uid: string, score: number }[]} */
  const rows = [];

  for (const row of cohort) {
    if (!row || typeof row.uid !== 'string' || !row.uid.trim()) {
      console.error('Each cohort entry needs a string "uid".');
      process.exit(2);
    }
    const uid = row.uid.trim();
    const exp = row.expected;
    if (!exp || typeof exp !== 'object') {
      console.error(`Cohort entry for ${uid} needs an "expected" object.`);
      process.exit(2);
    }
    const snap = await db.doc(`users/${uid}/stats/summary`).get();
    if (!snap.exists) {
      console.error(
        JSON.stringify({
          component: 'verify_leaderboard_cohort',
          outcome: 'missing_stats_summary',
          uid,
        }),
      );
      process.exit(1);
    }
    const data = snap.data();
    assertWins(data, uid, exp);
    rows.push({ uid, score: winsScoreFromStatsDoc('global', data) });
  }

  const sorted = sortLeaderboardPageRows(rows);
  const actualOrder = sorted.map((r) => r.uid);
  if (actualOrder.length !== expectedGlobalOrder.length) {
    console.error(
      JSON.stringify({
        component: 'verify_leaderboard_cohort',
        outcome: 'order_length_mismatch',
        expectedLen: expectedGlobalOrder.length,
        actualLen: actualOrder.length,
      }),
    );
    process.exit(1);
  }
  for (let i = 0; i < actualOrder.length; i++) {
    if (actualOrder[i] !== expectedGlobalOrder[i]) {
      console.error(
        JSON.stringify({
          component: 'verify_leaderboard_cohort',
          outcome: 'global_order_mismatch',
          index: i,
          expected: expectedGlobalOrder[i],
          actual: actualOrder[i],
          actualOrder,
          expectedGlobalOrder,
        }),
      );
      process.exit(1);
    }
  }

  console.log(
    JSON.stringify({
      component: 'verify_leaderboard_cohort',
      outcome: 'ok',
      fixture: fixturePath,
      cohortSize: cohort.length,
    }),
  );
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
