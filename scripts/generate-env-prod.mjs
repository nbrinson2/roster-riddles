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
  leaderboardUseFirestoreSnapshot: false,
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
