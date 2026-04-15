import { getApp } from 'firebase/app';
import {
  getFirestore,
  initializeFirestore,
  type Firestore,
} from 'firebase/firestore';
import { environment } from 'src/environment';

/**
 * Staging (Spark / single DB) uses `(default)`; prod uses named DB `roster-riddles`.
 * See `environment.firestoreDatabaseId`.
 */
export function getConfiguredFirestore(): Firestore {
  const app = getApp();
  const id = environment.firestoreDatabaseId?.trim();
  if (!id || id === '(default)' || id === 'default') {
    return getFirestore(app);
  }
  return initializeFirestore(app, {}, id);
}
