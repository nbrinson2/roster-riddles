#!/usr/bin/env node
/**
 * Story AD-3 — set or clear Firebase Auth custom claim `admin` for a single user (staging or prod).
 *
 * Usage:
 *   node scripts/set-admin-claim.mjs <uid> --grant [--enable-user] [--dry-run]
 *   node scripts/set-admin-claim.mjs <uid> --revoke [--revoke-sessions] [--disable-user] [--dry-run]
 *
 * Requires Admin credentials for the **target** Firebase project:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account.json
 *   or FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
 * Optional: FIRESTORE_DATABASE_ID (not used here; Auth is project-level).
 *
 * After changing claims only, the user must refresh their ID token before GET /api/v1/me
 * reflects the new isAdmin. Use --revoke-sessions to invalidate refresh tokens (stronger),
 * and/or --disable-user to block sign-in entirely.
 *
 * @see docs/admin/admin-dashboard-ops-ad3.md
 */
import 'dotenv/config';
import admin from 'firebase-admin';
import process from 'process';

import { ensureFirebaseAdminInitialized } from '../server/lib/firebase-admin-init.js';

function usage() {
  console.error(
    `Usage: node scripts/set-admin-claim.mjs <uid> --grant | --revoke [options] [--dry-run]\n` +
      `  --grant            Set custom claim admin=true\n` +
      `  --revoke           Set custom claim admin=false (removes admin UI privilege)\n` +
      `  --enable-user      With --grant: set disabled=false (re-enable account)\n` +
      `  --revoke-sessions  With --revoke: revokeRefreshTokens (invalidate refresh tokens)\n` +
      `  --disable-user     With --revoke: set disabled=true (block sign-in)\n` +
      `  --dry-run          Print planned action without calling Firebase Auth\n`,
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
  const enableUser = filtered.includes('--enable-user');
  const revokeSessions = filtered.includes('--revoke-sessions');
  const disableUser = filtered.includes('--disable-user');
  const positional = filtered.filter((a) => !a.startsWith('--'));
  const uid = positional[0]?.trim();

  if (!uid || (!grant && !revoke) || (grant && revoke)) {
    usage();
    process.exit(1);
  }

  if (enableUser && !grant) {
    console.error('--enable-user is only valid with --grant.');
    process.exit(1);
  }
  if ((revokeSessions || disableUser) && !revoke) {
    console.error(
      '--revoke-sessions and --disable-user are only valid with --revoke.',
    );
    process.exit(1);
  }
  if (grant && (revokeSessions || disableUser)) {
    console.error('--revoke-sessions and --disable-user are only valid with --revoke.');
    process.exit(1);
  }

  try {
    assertUidShape(uid);
  } catch (e) {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  }

  const claims = grant ? { admin: true } : { admin: false };

  /** @type {string[]} */
  const plannedActions = ['set_custom_claim'];
  if (grant && enableUser) {
    plannedActions.push('enable_user');
  }
  if (revoke && revokeSessions) {
    plannedActions.push('revoke_refresh_tokens');
  }
  if (revoke && disableUser) {
    plannedActions.push('disable_user');
  }

  if (dryRun) {
    console.log(
      JSON.stringify({
        component: 'set_admin_claim',
        outcome: 'dry_run',
        uid,
        claims,
        actions: plannedActions,
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

  const auth = admin.auth();

  /** @type {string[]} */
  const actionsDone = [];

  try {
    await auth.setCustomUserClaims(uid, claims);
    actionsDone.push('set_custom_claim');

    if (grant && enableUser) {
      await auth.updateUser(uid, { disabled: false });
      actionsDone.push('enable_user');
    }

    if (revoke && revokeSessions) {
      await auth.revokeRefreshTokens(uid);
      actionsDone.push('revoke_refresh_tokens');
    }

    if (revoke && disableUser) {
      await auth.updateUser(uid, { disabled: true });
      actionsDone.push('disable_user');
    }

    const user = await auth.getUser(uid);
    console.log(
      JSON.stringify({
        component: 'set_admin_claim',
        outcome: 'ok',
        uid,
        actions: actionsDone,
        customClaims: user.customClaims ?? {},
        disabled: user.disabled,
      }),
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error(
      JSON.stringify({
        component: 'set_admin_claim',
        outcome: 'error',
        uid,
        actionsAttempted: actionsDone,
        message: msg.slice(0, 500),
      }),
    );
    process.exit(2);
  }
}

main();
