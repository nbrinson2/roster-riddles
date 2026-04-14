/**
 * Firebase Admin SDK — credentials from environment only (never commit keys).
 *
 * Resolution order:
 * 1. `FIREBASE_SERVICE_ACCOUNT_JSON` — full service account JSON string (e.g. Cloud Run secret).
 * 2. Default application credentials — `GOOGLE_APPLICATION_CREDENTIALS` (path to JSON file) locally,
 *    or the Cloud Run / GCE workload identity on GCP (`admin.initializeApp()` with no credential).
 *
 * Call only when verifying tokens (lazy init). Public routes do not require Admin to be configured.
 */
import admin from 'firebase-admin';

export function ensureFirebaseAdminInitialized() {
  if (admin.apps.length > 0) {
    return admin;
  }

  try {
    const rawJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
    if (rawJson && rawJson.trim()) {
      let parsed;
      try {
        parsed = JSON.parse(rawJson);
      } catch {
        throw new Error(
          'FIREBASE_SERVICE_ACCOUNT_JSON is set but is not valid JSON.'
        );
      }
      admin.initializeApp({
        credential: admin.credential.cert(parsed),
      });
      return admin;
    }

    admin.initializeApp();
    return admin;
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : String(err);
    throw new Error(
      `Firebase Admin initialization failed (${msg}). Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS, or run on GCP with default credentials.`
    );
  }
}
