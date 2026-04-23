/**
 * Phase 5 Story P5-H3 — Pure join classification for paid vs free entry (testable matrix).
 * Mirrors branching in {@link postContestJoin} before blocking-query and free-entry write.
 */
import { isPaidContestEntryForJoinReplay } from './contest-join-paid-replay.js';

/**
 * @param {number} entryFeeCents
 * @param {{ exists: boolean; data?: Record<string, unknown> }} entryState — `exists` from `entryRef.get().exists`; `data` from `.data()` when an object.
 * @returns {'payment_required' | 'idempotent_replay' | 'create_free_entry'}
 */
export function classifyContestJoinPaymentPath(entryFeeCents, entryState) {
  if (entryState.exists) {
    if (entryFeeCents > 0 && !isPaidContestEntryForJoinReplay(entryState.data)) {
      return 'payment_required';
    }
    return 'idempotent_replay';
  }
  if (entryFeeCents > 0) {
    return 'payment_required';
  }
  return 'create_free_entry';
}
