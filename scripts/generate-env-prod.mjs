/**
 * Writes `src/environment.prod.ts` or `src/environment.staging.ts` from env vars.
 * CI/CD should set FIREBASE_* (and optional API_BASE_URL, STRIPE_PUBLISHABLE_KEY) per deployment target — use a **different**
 * Firebase project for staging vs production by using different substitution values per trigger.
 *
 * DEPLOYMENT=staging  → environment.staging.ts (Angular config `staging`)
 * DEPLOYMENT=production | unset → environment.prod.ts (Angular config `production`)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const deployment = (process.env.DEPLOYMENT || 'production').toLowerCase();
const isStaging = deployment === 'staging';
const outFile = path.join(
  root,
  'src',
  isStaging ? 'environment.staging.ts' : 'environment.prod.ts',
);

const required = [
  ['FIREBASE_API_KEY', process.env.FIREBASE_API_KEY],
  ['FIREBASE_AUTH_DOMAIN', process.env.FIREBASE_AUTH_DOMAIN],
  ['FIREBASE_PROJECT_ID', process.env.FIREBASE_PROJECT_ID],
  ['FIREBASE_STORAGE_BUCKET', process.env.FIREBASE_STORAGE_BUCKET],
  ['FIREBASE_MESSAGING_SENDER_ID', process.env.FIREBASE_MESSAGING_SENDER_ID],
  ['FIREBASE_APP_ID', process.env.FIREBASE_APP_ID],
];

const missing = required.filter(([, v]) => !v || String(v).trim() === '');
if (missing.length) {
  console.error(
    '[generate-env-prod] Missing required environment variables:',
    missing.map(([k]) => k).join(', '),
  );
  console.error(
    'Set them in Cloud Build (substitutions or Secret Manager) or export them locally before build.',
  );
  process.exit(1);
}

const measurementId = process.env.FIREBASE_MEASUREMENT_ID ?? '';
const apiBaseUrl = process.env.API_BASE_URL ?? '';
const deploymentLiteral = isStaging ? 'staging' : 'production';
// Staging on Spark: single (default) DB. Production: named DB unless FIRESTORE_DATABASE_ID overrides.
const firestoreDatabaseId = isStaging
  ? '(default)'
  : (process.env.FIRESTORE_DATABASE_ID ?? 'roster-riddles').trim();

const stripePublishableKey = process.env.STRIPE_PUBLISHABLE_KEY ?? '';

/** Firestore onSnapshot on B2 snapshot docs (E1). Prod: true; staging/dev: false. */
const leaderboardUseFirestoreSnapshot = !isStaging;

/** Story G2 — omit panel when Cloud Build sets LEADERBOARDS_UI_ENABLED=false */
const leaderboardsUiEnabled = process.env.LEADERBOARDS_UI_ENABLED !== 'false';

/** Story C2 — omit weekly contests drawer when WEEKLY_CONTESTS_UI_ENABLED=false */
const weeklyContestsUiEnabled = process.env.WEEKLY_CONTESTS_UI_ENABLED !== 'false';

/**
 * Simulated / dry-run contest strip + card copy.
 * - **Production:** off unless `SIMULATED_CONTESTS_UI_ENABLED=true` (explicit opt-in).
 * - **Staging:** on unless `SIMULATED_CONTESTS_UI_ENABLED=false`.
 */
const simulatedContestsUiEnabled = isStaging
  ? process.env.SIMULATED_CONTESTS_UI_ENABLED !== 'false'
  : process.env.SIMULATED_CONTESTS_UI_ENABLED === 'true';

/**
 * Phase 0 — omit “Weekly contest” tab inside the leaderboard panel when LEADERBOARD_CONTEST_TAB_ENABLED=false.
 * Independent of the contests drawer (`WEEKLY_CONTESTS_UI_ENABLED`).
 */
const leaderboardContestTabEnabled =
  process.env.LEADERBOARD_CONTEST_TAB_ENABLED !== 'false';

/** Story AD-4 — omit admin dashboard affordance when ADMIN_DASHBOARD_UI_ENABLED=false */
const adminDashboardUiEnabled = process.env.ADMIN_DASHBOARD_UI_ENABLED !== 'false';

/**
 * Story P5-D2 / GL-C1 — paid entry UX in the SPA (Stripe Checkout redirect).
 * Enabled only when the build explicitly sets `CONTESTS_PAYMENTS_ENABLED=true`
 * (applies to staging and production builds). `cloudbuild.yaml` defaults `_CONTESTS_PAYMENTS_ENABLED` to `true`.
 */
const contestsPaymentsEnabled = process.env.CONTESTS_PAYMENTS_ENABLED === 'true';

/** Max session from last auth (`authTime`). 0 = disabled. Prod defaults to 3d if unset; staging defaults to 0. */
const authSessionMaxDaysRaw = (process.env.AUTH_SESSION_MAX_DAYS ?? '').trim();
const authSessionMaxDaysLower = authSessionMaxDaysRaw.toLowerCase();
let authSessionMaxMs = 0;
if (
  authSessionMaxDaysLower === '0' ||
  authSessionMaxDaysLower === 'off' ||
  authSessionMaxDaysLower === 'false' ||
  authSessionMaxDaysLower === 'none'
) {
  authSessionMaxMs = 0;
} else if (authSessionMaxDaysRaw !== '' && Number.isFinite(Number(authSessionMaxDaysRaw))) {
  const d = Number(authSessionMaxDaysRaw);
  if (d > 0) {
    authSessionMaxMs = Math.round(d * 86400000);
  }
} else if (!isStaging) {
  authSessionMaxMs = Math.round(3 * 86400000);
}

/** Phase 3 — Angular poll of contest live leaderboard HTTP (ms). Unset → 30s; `0` / off / false / none → off. */
const contestLivePollRaw = (process.env.CONTEST_LIVE_LEADERBOARD_POLL_MS ?? '').trim();
const contestLivePollLower = contestLivePollRaw.toLowerCase();
let contestLiveLeaderboardPollIntervalMs = 30_000;
if (contestLivePollRaw !== '') {
  if (
    contestLivePollLower === '0' ||
    contestLivePollLower === 'off' ||
    contestLivePollLower === 'false' ||
    contestLivePollLower === 'none'
  ) {
    contestLiveLeaderboardPollIntervalMs = 0;
  } else if (Number.isFinite(Number(contestLivePollRaw))) {
    contestLiveLeaderboardPollIntervalMs = Math.max(
      0,
      Math.round(Number(contestLivePollRaw)),
    );
  }
}

const content = `import { FeatureFlags } from './app/shared/feature-flag/feature-flag.service';
import type { DeploymentEnvironment } from './environment.types';

const featureFlags: FeatureFlags = {
  mlbTeamLogos: false,
  gameplayTelemetry: true,
};

export const environment = {
  production: true,
  deployment: '${deploymentLiteral}' as DeploymentEnvironment,
  firestoreDatabaseId: ${JSON.stringify(firestoreDatabaseId)},
  baseUrl: ${JSON.stringify(apiBaseUrl)},
  stripePublishableKey: ${JSON.stringify(stripePublishableKey)},
  sendGameplayEvents: true,
  leaderboardPollIntervalMs: 0,
  leaderboardUseFirestoreSnapshot: ${leaderboardUseFirestoreSnapshot},
  leaderboardsUiEnabled: ${leaderboardsUiEnabled},
  weeklyContestsUiEnabled: ${weeklyContestsUiEnabled},
  simulatedContestsUiEnabled: ${simulatedContestsUiEnabled},
  leaderboardContestTabEnabled: ${leaderboardContestTabEnabled},
  contestLiveLeaderboardPollIntervalMs: ${contestLiveLeaderboardPollIntervalMs},
  adminDashboardUiEnabled: ${adminDashboardUiEnabled},
  contestsPaymentsEnabled: ${contestsPaymentsEnabled},
  authSessionMaxMs: ${authSessionMaxMs},
  featureFlags,
  firebase: {
    apiKey: ${JSON.stringify(process.env.FIREBASE_API_KEY)},
    authDomain: ${JSON.stringify(process.env.FIREBASE_AUTH_DOMAIN)},
    projectId: ${JSON.stringify(process.env.FIREBASE_PROJECT_ID)},
    storageBucket: ${JSON.stringify(process.env.FIREBASE_STORAGE_BUCKET)},
    messagingSenderId: ${JSON.stringify(process.env.FIREBASE_MESSAGING_SENDER_ID)},
    appId: ${JSON.stringify(process.env.FIREBASE_APP_ID)},
    measurementId: ${JSON.stringify(measurementId)},
  },
};
`;

fs.writeFileSync(outFile, content, 'utf8');
console.log('[generate-env-prod] Wrote', outFile, `(${deploymentLiteral})`);
