/**
 * Firestore (Admin) using the same database id as the Angular app (`firestoreDatabaseId`).
 * @see `src/app/config/firestore-instance.ts`
 */
import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';
import { ensureFirebaseAdminInitialized } from './firebase-admin-init.js';

/**
 * @returns {import('firebase-admin/firestore').Firestore}
 */
export function getAdminFirestore() {
  ensureFirebaseAdminInitialized();
  const app = admin.app();
  const databaseId = process.env.FIRESTORE_DATABASE_ID?.trim();
  if (!databaseId || databaseId === '(default)' || databaseId === 'default') {
    return getFirestore(app);
  }
  return getFirestore(app, databaseId);
}
