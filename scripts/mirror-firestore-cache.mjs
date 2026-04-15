/**
 * Copy all documents in the `cache` collection from production Firestore to staging.
 *
 * Prerequisites:
 * - Source: prod project, named DB `roster-riddles` (matches deployed app).
 * - Target: staging project, `(default)` DB (Spark / local dev).
 * - Two service account JSONs with Firestore read (source) and write (target).
 *
 * Usage (from repo root, after `dotenv` or export):
 *   node scripts/mirror-firestore-cache.mjs
 *
 * Env: see `.env.example` (MIRROR_*).
 */
import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const SOURCE_PATH =
  process.env.MIRROR_SOURCE_CREDENTIALS ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS_PROD;
const TARGET_PATH =
  process.env.MIRROR_TARGET_CREDENTIALS ||
  process.env.GOOGLE_APPLICATION_CREDENTIALS;

const SOURCE_DATABASE_ID =
  process.env.SOURCE_FIRESTORE_DATABASE_ID || 'roster-riddles';
/** Omit or `(default)` for the default database */
const TARGET_DATABASE_ID = (process.env.TARGET_FIRESTORE_DATABASE_ID || '').trim();

const COLLECTION = process.env.MIRROR_COLLECTION || 'cache';

function loadJson(path) {
  if (!path) {
    throw new Error('Missing credential path (set MIRROR_SOURCE_CREDENTIALS and MIRROR_TARGET_CREDENTIALS).');
  }
  const resolved = path.startsWith('/') ? path : join(root, path);
  return JSON.parse(readFileSync(resolved, 'utf8'));
}

function getDb(app, databaseId) {
  if (!databaseId || databaseId === '(default)' || databaseId === 'default') {
    return getFirestore(app);
  }
  return getFirestore(app, databaseId);
}

async function mirror() {
  const sourceAccount = loadJson(SOURCE_PATH);
  const targetAccount = loadJson(TARGET_PATH);

  const sourceApp = initializeApp(
    { credential: cert(sourceAccount) },
    'mirror-source',
  );
  const targetApp = initializeApp(
    { credential: cert(targetAccount) },
    'mirror-target',
  );

  const sourceDb = getDb(sourceApp, SOURCE_DATABASE_ID);
  const targetDb = getDb(targetApp, TARGET_DATABASE_ID);

  console.log(
    `[mirror] Source project ${sourceAccount.project_id} DB "${SOURCE_DATABASE_ID || '(default)'}" → Target ${targetAccount.project_id} DB "${TARGET_DATABASE_ID || '(default)'}" collection "${COLLECTION}"`,
  );

  const snap = await sourceDb.collection(COLLECTION).get();
  if (snap.empty) {
    console.log('[mirror] No documents to copy.');
    return;
  }

  const docs = snap.docs;
  const chunkSize = 400;
  let copied = 0;

  for (let i = 0; i < docs.length; i += chunkSize) {
    const chunk = docs.slice(i, i + chunkSize);
    const batch = targetDb.batch();
    for (const doc of chunk) {
      const ref = targetDb.collection(COLLECTION).doc(doc.id);
      batch.set(ref, doc.data());
      copied++;
    }
    await batch.commit();
    console.log(`[mirror] Committed ${Math.min(i + chunk.length, docs.length)} / ${docs.length} docs`);
  }

  console.log(`[mirror] Done. Copied ${copied} document(s) in "${COLLECTION}".`);
}

mirror().catch((err) => {
  console.error('[mirror] Failed:', err);
  process.exit(1);
});
