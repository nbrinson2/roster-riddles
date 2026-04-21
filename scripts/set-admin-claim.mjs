#!/usr/bin/env node
/**
 * Story AD-3 — set or clear Firebase Auth custom claim `admin` for a single user (staging or prod).
 *
 * Usage:
 *   node scripts/set-admin-claim.mjs <uid> --grant | --revoke [--dry-run]
 *
 * Requires Admin credentials for the **target** Firebase project:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   or FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 * Optional: FIRESTORE_DATABASE_ID (not used here; Auth is project-level).
 *
 * After changing claims, the user must refresh their ID token (e.g. sign out/in or getIdToken(true))
 * before GET /api/v1/me returns the new isAdmin value.
 *
 * @see docs/admin-dashboard-ops-ad3.md
 */
import 'dotenv/config';
import admin from 'firebase-admin';
import process from 'process';

import { ensureFirebaseAdminInitialized } from '../server/firebase-admin-init.js';

function usage() {
  console.error(
    `Usage: node scripts/set-admin-claim.mjs <uid> --grant | --revoke [--dry-run]\n` +
      `  --grant   Set custom claim admin=true\n` +
      `  --revoke  Set custom claim admin=false (removes admin UI privilege per server/auth-claims.js)\n` +
      `  --dry-run Print planned action without calling Firebase Auth\n`,
  );
}

/**
 * @param {string} uid
 */
function assertUidShape(uid) {
  if (!uid || typeof uid !== 'string' || uid.length < 1 || uid.length > 128) {
    throw new Error('Invalid uid length.');
  }
  if (!/^[a-zA-Z0-9_-]+$/.test(uid)) {
    throw new Error('Invalid uid: expected Firebase Auth uid characters only.');
  }
}

async function main() {
  const argv = process.argv.slice(2);
  const dryRun = argv.includes('--dry-run');
  const filtered = argv.filter((a) => a !== '--dry-run');
  const grant = filtered.includes('--grant');
  const revoke = filtered.includes('--revoke');
  const positional = filtered.filter((a) => !a.startsWith('--'));
  const uid = positional[0]?.trim();

  if (!uid || (!grant && !revoke) || (grant && revoke)) {
    usage();
    process.exit(1);
  }

  try {
    assertUidShape(uid);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  const claims = grant ? { admin: true } : { admin: false };

  if (dryRun) {
    console.log(
      JSON.stringify({
        component: 'set_admin_claim',
        outcome: 'dry_run',
        uid,
        claims,
      }),
    );
    process.exit(0);
  }

  try {
    ensureFirebaseAdminInitialized();
  } catch (e) {
    console.error(
      e instanceof Error ? e.message : String(e),
    );
    process.exit(2);
  }

  try {
    await admin.auth().setCustomUserClaims(uid, claims);
    const user = await admin.auth().getUser(uid);
    console.log(
      JSON.stringify({
        component: 'set_admin_claim',
        outcome: 'ok',
        uid,
        customClaims: user.customClaims ?? {},
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      JSON.stringify({
        component: 'set_admin_claim',
        outcome: 'error',
        uid,
        message: msg.slice(0, 500),
      }),
    );
    process.exit(2);
  }
}

main();
