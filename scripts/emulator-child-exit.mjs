/**
 * Teardown for Node scripts launched by `firebase emulators:exec`.
 * The Firebase CLI stops emulators only after the child process exits; lingering
 * handles (gRPC, WebChannel, timers) can prevent exit unless released explicitly.
 */

/**
 * @param {import('firebase-admin').default} admin
 */
export async function deleteFirebaseAdminApp(admin) {
  try {
    if (admin.apps.length) {
      await admin.app().delete();
    }
  } catch {
    /* ignore */
  }
}

/**
 * @param {number} [code=0]
 */
export function exitEmulatorExecChild(code = 0) {
  const n =
    typeof code === 'number' && Number.isFinite(code) ? Math.trunc(code) : 0;
  process.exit(n);
}
