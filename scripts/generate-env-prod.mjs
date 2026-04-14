import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const outFile = path.join(root, 'src/environment.prod.ts');

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
    'Set them in Cloud Build (substitutions or Secret Manager) or export them locally before npm run build:prod.',
  );
  process.exit(1);
}

const measurementId = process.env.FIREBASE_MEASUREMENT_ID ?? '';
const apiBaseUrl = process.env.API_BASE_URL ?? '';

const content = `import { FeatureFlags } from './app/shared/feature-flag/feature-flag.service';

const featureFlags: FeatureFlags = {
  mlbTeamLogos: false,
};

export const environment = {
  production: true,
  baseUrl: ${JSON.stringify(apiBaseUrl)},
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
console.log('[generate-env-prod] Wrote', outFile);
