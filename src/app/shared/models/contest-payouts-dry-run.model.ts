/**
 * `contests/{contestId}/payouts/dryRun` — weekly contests Phase 4 Story B3 (numeric only; no Stripe).
 * @see docs/weekly-contests/weekly-contests-schema-results.md
 * @see docs/weekly-contests/weekly-contests-schema-contest-payouts-final.md (P6-C2 `payouts/final`)
 */

export const CONTEST_DRY_RUN_PAYOUTS_SCHEMA_VERSION = 1;

/** Each line is numeric fields only (no freeform labels); UI derives “Winner gets $X” from `amountCents`. */
export interface ContestPayoutLine {
  rank?: number;
  place?: number;
  uid: string;
  amountCents: number;
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
