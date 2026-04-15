/**
 * Run with Firestore emulator (see package.json `test:firestore-rules`).
 * Uses @firebase/rules-unit-testing against firestore.rules.
 */
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} from '@firebase/rules-unit-testing';
import { doc, getDoc, setDoc } from 'firebase/firestore';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const rules = readFileSync(join(root, 'firestore.rules'), 'utf8');

const testEnv = await initializeTestEnvironment({
  projectId: 'demo-firestore-rules',
  firestore: { rules },
});

const unauth = testEnv.unauthenticatedContext().firestore();
const alice = testEnv.authenticatedContext('alice').firestore();
const bob = testEnv.authenticatedContext('bob').firestore();

await testEnv.clearFirestore();

// users/{uid}: owner can write own doc
await assertSucceeds(
  setDoc(doc(alice, 'users', 'alice'), {
    email: 'a@test.com',
    emailVerified: true,
  })
);

// cannot write another user's doc
await assertFails(setDoc(doc(alice, 'users', 'bob'), { x: 1 }));

// cannot write own profile when unauthenticated
await assertFails(setDoc(doc(unauth, 'users', 'alice'), { x: 1 }));

// owner can read own
await assertSucceeds(getDoc(doc(alice, 'users', 'alice')));

// cannot read another user's profile
await assertFails(getDoc(doc(alice, 'users', 'bob')));

// cache: read allowed (even when doc is missing; rules still apply to the path)
await assertSucceeds(getDoc(doc(unauth, 'cache', 'no-such-doc')));

// cache: client cannot write
await assertFails(setDoc(doc(alice, 'cache', 'y'), { bad: true }));

// future contest path: deny
await assertFails(setDoc(doc(alice, 'contests', 'w1'), { a: 1 }));

// ledgers: deny
await assertFails(setDoc(doc(alice, 'ledgers', 'l1'), { a: 1 }));

await testEnv.cleanup();
console.log('Firestore rules verification passed.');
