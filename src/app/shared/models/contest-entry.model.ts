/**
 * Firestore `contests/{contestId}/entries/{uid}` — weekly contests Phase 4 Story B2;
 * Phase 5 Story P5-B1 adds optional payment fields (Stripe ids, `paymentStatus`).
 * @see docs/weekly-contests/weekly-contests-schema-entries.md
 * @see docs/weekly-contests/weekly-contests-phase5-entry-fees-adr.md
 */

/** Phase 4 baseline shape (free join, no payment fields). */
export const CONTEST_ENTRY_SCHEMA_VERSION = 1;

/**
 * Use when the document includes Phase 5 payment fields (paid or explicit `free` / terminal states).
 * Legacy entries may remain `schemaVersion: 1` without payment fields.
 */
export const CONTEST_ENTRY_SCHEMA_VERSION_PHASE5 = 2;

/**
 * Entry fee lifecycle — see `weekly-contests-phase5-entry-fees-adr.md`.
 * - **`free`**: no entry fee (Phase 4 join path); prefer explicit for new writes.
 * - **`paid`**: fee captured; entrant eligible for scoring.
 * - **`pending`**: optional; reserved for future “row before webhook” flows.
 */
export type ContestEntryPaymentStatus =
  | 'free'
  | 'pending'
  | 'paid'
  | 'failed'
  | 'refunded';

/**
 * Stored at contests/{contestId}/entries/{uid} (document id === uid).
 * Timestamps are Firestore Timestamp in DB.
 */
export interface ContestEntryDocument {
  schemaVersion: number;
  contestId: string;
  uid: string;
  rulesAcceptedVersion: number | string;
  joinedAt: unknown;
  displayNameSnapshot?: string | null;
  clientRequestId?: string;

  // --- Phase 5 (P5-B1) — server / Admin SDK writes only; optional on legacy docs ---

  /**
   * Set for new free joins when `schemaVersion >= 2`; legacy docs may omit (treat as free when contest has no fee).
   */
  paymentStatus?: ContestEntryPaymentStatus;

  /** Contest `entryFeeCents` at time payment succeeded (webhook validation). */
  entryFeeCentsSnapshot?: number;

  /** Stripe Checkout Session id (`cs_...`). */
  stripeCheckoutSessionId?: string;

  /** Stripe PaymentIntent id (`pi_...`). */
  stripePaymentIntentId?: string;

  /** Stripe Customer id if Checkout created/linked one (`cus_...`). */
  stripeCustomerId?: string | null;

  /** Server time when payment succeeded and entry became `paid`. */
  paidAt?: unknown;

  /** Last processed Stripe `event.id` (debugging / idempotency aid). */
  lastStripeEventId?: string | null;
}
