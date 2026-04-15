import type { FirebaseOptions } from 'firebase/app';

/**
 * Web app config for the **roster-riddles-staging** Firebase project.
 * **Local development** (`environment.ts`) and staging CI builds use this config (CI via `FIREBASE_*`).
 * Client-safe (same values ship in the browser).
 */
export const firebaseConfig: FirebaseOptions = {
  apiKey: 'AIzaSyA3nwYqO5ZzEBtP9kz3xA-WrxzflTc6eIA',
  authDomain: 'roster-riddles-staging.firebaseapp.com',
  projectId: 'roster-riddles-staging',
  storageBucket: 'roster-riddles-staging.firebasestorage.app',
  messagingSenderId: '919941132088',
  appId: '1:919941132088:web:dc8f90f76098dbcf345bcd',
  measurementId: 'G-YBQ71EZX00',
};
