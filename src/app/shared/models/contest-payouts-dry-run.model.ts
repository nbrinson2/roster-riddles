/**
 * `contests/{contestId}/payouts/dryRun` — weekly contests Phase 4 Story B3 (numeric only; no Stripe).
 * @see docs/weekly-contests-schema-results.md
 */

export const CONTEST_DRY_RUN_PAYOUTS_SCHEMA_VERSION = 1;

export interface ContestPayoutLine {
  rank?: number;
  place?: number;
  uid: string;
  amountCents: number;
  label?: string;
}

/**
 * Stored at contests/{contestId}/payouts/dryRun.
 */
export interface ContestDryRunPayoutsDocument {
  schemaVersion: number;
  notRealMoney: boolean;
  currency: string;
  lines: ContestPayoutLine[];
  finalizedAt: unknown;
  payoutJobId?: string;
}
