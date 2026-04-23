/**
 * Firestore `ledgerEntries/{ledgerEntryId}` — Phase 5 Story P5-B2 (append-only payment ledger).
 * Server / Admin SDK writes only; clients have no access.
 * @see docs/weekly-contests/weekly-contests-phase5-ledger-schema.md
 */

export const CONTEST_LEDGER_ENTRY_SCHEMA_VERSION = 1;

/** High-level category for reconciliation and dashboards. */
export type ContestLedgerLineType =
  | 'contest_entry_charge'
  | 'contest_entry_refund'
  | 'contest_entry_adjustment'
  | 'other';

/**
 * Credit vs debit in **ledger convention** (must match webhook writers):
 * e.g. `credit` = fee captured to platform balance; `debit` = refund out.
 */
export type ContestLedgerDirection = 'credit' | 'debit';

export type ContestLedgerSource = 'webhook' | 'admin_adjustment' | 'system';

/**
 * Stored at ledgerEntries/{ledgerEntryId}. Prefer ledgerEntryId === stripeEventId (evt_...) for webhook lines.
 * Timestamps are Firestore Timestamp in DB.
 */
export interface ContestLedgerEntryDocument {
  schemaVersion: number;
  uid: string;
  contestId: string;
  entryPathHint?: string;
  lineType: ContestLedgerLineType;
  direction: ContestLedgerDirection;
  /** Non-negative magnitude in USD cents (v1). */
  amountCents: number;
  /** v1: `usd`. */
  currency: string;
  stripeEventId?: string | null;
  stripeObjectType?: string | null;
  stripeObjectId?: string | null;
  source: ContestLedgerSource;
  createdAt: unknown;
  metadata?: Record<string, unknown>;
}
