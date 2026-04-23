import assert from 'node:assert/strict';
import test from 'node:test';
import { firestoreTimestampToIso } from './firestore-timestamp-iso.js';

test('firestoreTimestampToIso uses toDate()', () => {
  const iso = firestoreTimestampToIso({
    toDate() {
      return new Date('2026-04-15T12:00:00.000Z');
    },
  });
  assert.equal(iso, '2026-04-15T12:00:00.000Z');
});

test('firestoreTimestampToIso returns null for missing', () => {
  assert.equal(firestoreTimestampToIso(null), null);
  assert.equal(firestoreTimestampToIso(undefined), null);
});
