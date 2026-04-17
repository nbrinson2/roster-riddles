/**
 * Firestore `contests/{contestId}/entries/{uid}` — weekly contests Phase 4 Story B2.
 * @see docs/weekly-contests-schema-entries.md
 */

export const CONTEST_ENTRY_SCHEMA_VERSION = 1;

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
}
