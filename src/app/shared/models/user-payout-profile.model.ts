/**
 * Optional payout / Stripe Connect fields on Firestore `users/{uid}` (top-level).
 * Written only by the server (P6-B2 onboarding, P6-B3 `account.updated` webhook).
 * @see docs/weekly-contests/weekly-contests-schema-users-payouts.md
 * @see docs/weekly-contests/weekly-contests-phase6-payouts-adr.md
 */

/** Stripe Account.type on the connected account (v1 product uses Express). */
export type StripeConnectAccountType = 'express' | 'standard' | 'custom';

/**
 * Subset of `users/{uid}` used for contest payout eligibility UX.
 * All keys are optional on the document until first Connect write.
 * Timestamps are Firestore `Timestamp` in the database (`unknown` here to avoid coupling models to `@angular/fire`).
 */
export interface UserPayoutProfileFields {
  // --- P6-B2 (Connect onboarding API) ---

  /** Stripe connected account id (`acct_...`). */
  stripeConnectAccountId?: string;

  stripeConnectAccountType?: StripeConnectAccountType;

  /** When the platform first created/persisted the connected account for this user. */
  stripeConnectCreatedAt?: unknown;

  // --- P6-B3 (Stripe `account.updated` webhook mirror) ---

  stripeConnectChargesEnabled?: boolean;

  stripeConnectPayoutsEnabled?: boolean;

  stripeConnectDetailsSubmitted?: boolean;

  /** Length of `requirements.currently_due` at last webhook application. */
  stripeConnectRequirementsCurrentlyDueCount?: number;

  /**
   * Comma-joined keys from `requirements.currently_due`; server-truncated (~500 chars).
   * Not a full Stripe payload — for support / lightweight UI hints only.
   */
  stripeConnectRequirementsCurrentlyDueSummary?: string;

  stripeConnectLastWebhookEventId?: string;

  /** Server time when Connect webhook state was last merged. */
  stripeConnectLastAccountUpdatedAt?: unknown;

  // --- P6-E2 — Connect bank payout webhooks (`payout.*`) mirror (optional) ---

  stripePayoutLastWebhookEventId?: string;

  stripePayoutLastWebhookType?: string;

  stripePayoutLastWebhookAt?: unknown;

  /** Mapped public enum when last relevant payout event was a failure/cancel. */
  stripePayoutLastFailurePublicCode?: string;
}
