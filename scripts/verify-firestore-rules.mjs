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
import { exitEmulatorExecChild } from './emulator-child-exit.mjs';

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

let exitCode = 0;
try {
  await testEnv.clearFirestore();

  // users/{uid}: owner can write own doc
  await assertSucceeds(
    setDoc(doc(alice, 'users', 'alice'), {
      email: 'a@test.com',
      emailVerified: true,
    }),
  );

  // P6-B2: Stripe Connect fields on `users/{uid}` are server-only (Admin SDK)
  await assertSucceeds(
    setDoc(
      doc(alice, 'users', 'alice'),
      { displayName: 'Alice' },
      { merge: true },
    ),
  );
  await assertFails(
    setDoc(
      doc(alice, 'users', 'alice'),
      { stripeConnectAccountId: 'acct_fake' },
      { merge: true },
    ),
  );
  await assertFails(
    setDoc(
      doc(alice, 'users', 'alice'),
      { stripeConnectChargesEnabled: true },
      { merge: true },
    ),
  );

  await assertFails(
    setDoc(doc(bob, 'users', 'bob'), {
      email: 'b@test.com',
      emailVerified: true,
      stripeConnectAccountType: 'express',
    }),
  );
  await assertSucceeds(
    setDoc(doc(bob, 'users', 'bob'), {
      email: 'b@test.com',
      emailVerified: true,
    }),
  );

  // cannot write another user's doc
  await assertFails(setDoc(doc(alice, 'users', 'bob'), { x: 1 }));

  // cannot write own profile when unauthenticated
  await assertFails(setDoc(doc(unauth, 'users', 'alice'), { x: 1 }));

  // owner can read own
  await assertSucceeds(getDoc(doc(alice, 'users', 'alice')));

  // cannot read another user's profile
  await assertFails(getDoc(doc(alice, 'users', 'bob')));

  // users/{uid}/gameplayEvents: owner may read; client writes denied (Admin SDK only)
  await assertSucceeds(
    getDoc(doc(alice, 'users', 'alice', 'gameplayEvents', 'no-such-event')),
  );
  await assertFails(
    setDoc(doc(alice, 'users', 'alice', 'gameplayEvents', 'evt1'), { x: 1 }),
  );
  await assertFails(
    getDoc(doc(alice, 'users', 'bob', 'gameplayEvents', 'evt1')),
  );

  // users/{uid}/stats: owner may read; client writes denied
  await assertSucceeds(getDoc(doc(alice, 'users', 'alice', 'stats', 'summary')));
  await assertFails(
    setDoc(doc(alice, 'users', 'alice', 'stats', 'summary'), { wins: 99 }),
  );
  await assertFails(getDoc(doc(alice, 'users', 'bob', 'stats', 'summary')));

  // cache: read allowed (even when doc is missing; rules still apply to the path)
  await assertSucceeds(getDoc(doc(unauth, 'cache', 'no-such-doc')));

  // cache: client cannot write
  await assertFails(setDoc(doc(alice, 'cache', 'y'), { bad: true }));

  // contests/{contestId}: signed-in read; client writes denied
  await assertSucceeds(getDoc(doc(alice, 'contests', 'c1')));
  await assertFails(getDoc(doc(unauth, 'contests', 'c1')));
  await assertFails(setDoc(doc(alice, 'contests', 'c1'), { a: 1 }));

  // contests/.../entries/{uid}: read own entry only; no client writes
  await assertSucceeds(
    getDoc(doc(alice, 'contests', 'c1', 'entries', 'alice')),
  );
  await assertFails(
    getDoc(doc(alice, 'contests', 'c1', 'entries', 'bob')),
  );
  await assertFails(
    setDoc(doc(alice, 'contests', 'c1', 'entries', 'alice'), {
      schemaVersion: 1,
    }),
  );

  // contests/.../results/* and payouts/*: signed-in read; no client writes (Story B3)
  await assertSucceeds(
    getDoc(doc(alice, 'contests', 'c1', 'results', 'final')),
  );
  await assertFails(
    getDoc(doc(unauth, 'contests', 'c1', 'results', 'final')),
  );
  await assertFails(
    setDoc(doc(alice, 'contests', 'c1', 'results', 'final'), { schemaVersion: 1 }),
  );
  await assertSucceeds(
    getDoc(doc(alice, 'contests', 'c1', 'payouts', 'dryRun')),
  );
  await assertFails(
    setDoc(doc(alice, 'contests', 'c1', 'payouts', 'dryRun'), { x: 1 }),
  );

  // unknown contest subpath: deny
  await assertFails(getDoc(doc(alice, 'contests', 'c1', 'scratch', 'x')));
  await assertFails(
    getDoc(doc(alice, 'contests', 'c1', 'stripePiSettlements', 'pi_test_1')),
  );
  await assertFails(
    setDoc(doc(alice, 'contests', 'c1', 'stripePiSettlements', 'pi_test_1'), {
      firstLedgerStripeEventId: 'evt_x',
    }),
  );
  await assertFails(
    getDoc(doc(unauth, 'contests', 'c1', 'stripePiSettlements', 'pi_test_1')),
  );

  // processedStripeEvents (Phase 5 P5-E1 / P5-G1): Admin only
  await assertFails(getDoc(doc(alice, 'processedStripeEvents', 'evt_test_1')));
  await assertFails(
    setDoc(doc(alice, 'processedStripeEvents', 'evt_test_2'), {
      outcome: 'ok',
    }),
  );
  await assertFails(getDoc(doc(unauth, 'processedStripeEvents', 'evt_test_1')));

  // ledgers: deny
  await assertFails(setDoc(doc(alice, 'ledgers', 'l1'), { a: 1 }));

  // ledgerEntries (Phase 5 P5-B2 / P5-G1): no client read or write
  await assertFails(getDoc(doc(alice, 'ledgerEntries', 'evt_test_1')));
  await assertFails(
    setDoc(doc(alice, 'ledgerEntries', 'evt_test_1'), { schemaVersion: 1 }),
  );
  await assertFails(getDoc(doc(unauth, 'ledgerEntries', 'evt_test_1')));

  // P5-G1: clients cannot forge paid entry / Stripe fields (writes still fully denied on entries)
  await assertFails(
    setDoc(doc(alice, 'contests', 'c1', 'entries', 'alice'), {
      schemaVersion: 2,
      contestId: 'c1',
      uid: 'alice',
      rulesAcceptedVersion: 1,
      paymentStatus: 'paid',
      stripePaymentIntentId: 'pi_evil',
    }),
  );

  console.log('Firestore rules verification passed.');
} catch (err) {
  console.error(err);
  exitCode = 1;
} finally {
  try {
    await testEnv.cleanup();
  } catch (e) {
    console.error('testEnv.cleanup failed:', e);
    exitCode = 1;
  }
}

exitEmulatorExecChild(exitCode);
