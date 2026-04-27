/**
 * `contests/{contestId}/payouts/final` — Phase 6 Story P6-C2 (immutable payout execution snapshot).
 * Optional sibling docs `payouts/run_{opaqueId}` use {@link ContestPayoutRunAttemptDocument}.
 * @see docs/weekly-contests/weekly-contests-schema-contest-payouts-final.md
 */
import type { ContestPayoutLine } from './contest-payouts-dry-run.model';

export const CONTEST_PAYOUT_FINAL_SCHEMA_VERSION = 1;

/** Roll-up status for the whole `payouts/final` artifact (optional on early writes). */
export type ContestPayoutFinalAggregateStatus =
  | 'succeeded'
  | 'partial_failure'
  | 'failed';

/**
 * Per-winner row after a payout executor touches Stripe (or marks skip).
 * Aligns with `ContestPayoutLine` (`rank` / `place`, `uid`, `amountCents`).
 */
export type ContestPayoutFinalLineStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'skipped';

export interface ContestPayoutFinalLine extends ContestPayoutLine {
  status: ContestPayoutFinalLineStatus;

  /** Stripe Transfer id (`tr_...`) when created. */
  stripeTransferId?: string | null;

  /** Stripe or app error code when `status === 'failed'`. */
  failureCode?: string | null;

  /**
   * P6-E2 — safe enum for UI (from webhook mappers), not raw Stripe strings.
   * @see server/payments/stripe-webhook-payouts.js
   */
  failurePublicCode?: string | null;

  lastStripeEventId?: string | null;
}

/**
 * Stored at `contests/{contestId}/payouts/final` (document id === `final`).
 * Timestamps are Firestore `Timestamp` in DB (`unknown` here).
 */
export interface ContestPayoutFinalDocument {
  schemaVersion: number;
  contestId: string;
  currency: string;
  /** Staging / dry only — omit or false for real money. */
  notRealMoney?: boolean;
  lines: ContestPayoutFinalLine[];
  /** From `results/final.scoringJobId` (traceability). */
  scoringJobId: string;
  /** Idempotent opaque key for this payout execution. */
  payoutJobId: string;
  lockedAt: unknown;
  aggregateStatus?: ContestPayoutFinalAggregateStatus;
  /** When this `final` was promoted from a `payouts/run_*` attempt. */
  supersedesRunDocumentId?: string | null;
}

export const CONTEST_PAYOUT_RUN_ATTEMPT_SCHEMA_VERSION = 1;

export type ContestPayoutRunAttemptStatus =
  | 'in_progress'
  | 'superseded'
  | 'promoted_to_final'
  | 'abandoned'
  | 'failed';

/**
 * Optional audit doc at `contests/{contestId}/payouts/run_{opaqueId}`.
 */
export interface ContestPayoutRunAttemptDocument {
  schemaVersion: number;
  contestId: string;
  runId: string;
  payoutJobId: string;
  supersedesRunDocumentId?: string | null;
  lines: ContestPayoutFinalLine[];
  attemptStatus: ContestPayoutRunAttemptStatus;
  createdAt: unknown;
}
