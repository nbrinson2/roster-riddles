# Weekly contests — `users/{uid}` payout / Connect profile (Phase 6 Story P6-C1)

**Status:** Schema documented; **Stripe Connect** fields written by **Express + webhooks** (P6-B2, P6-B3).  
**Physical path:** Top-level document **`users/{uid}`** (same doc as profile bootstrap — payout fields are optional merges).  
**Depends on:** [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md), [stripe.md](../payments/stripe.md) (Connect appendix), [weekly-contests-api-phase6.md](weekly-contests-api-phase6.md), [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) (Connect section).

## Access control

| Actor | Read | Write |
|-------|------|-------|
| **Signed-in owner** (`auth.uid == userId`) | Yes — full document (include payout fields needed for UX only). | Profile fields **except** payout / Connect keys (see [`firestore.rules`](../../firestore.rules) — server-only keys blocked on create/update). |
| **Other users** | No | No |
| **Admin SDK / server** | Yes | Yes — onboarding API (P6-B2), Stripe webhooks (P6-B3). |

**Privacy:** Do **not** store bank account numbers, full tax IDs, or other PII held by Stripe. This document holds **ids and boolean mirrors** only.

## Field reference — Connect & payout readiness

**Writes:** Express (onboarding) and Stripe webhook handler only — **not** client-writable.

### Account identity & creation (P6-B2)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stripeConnectAccountId` | `string` | When linked | Stripe connected account id, prefix **`acct_`**. |
| `stripeConnectAccountType` | `string` | When linked | Stripe Account `type` (v1: **`express`**). |
| `stripeConnectCreatedAt` | `Timestamp` | When created | Firestore timestamp when the platform first persisted a new connected account for this user. |

### Account state mirror (P6-B3 — `account.updated`)

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `stripeConnectChargesEnabled` | `boolean` | No | Stripe `charges_enabled`. |
| `stripeConnectPayoutsEnabled` | `boolean` | No | Stripe `payouts_enabled`. |
| `stripeConnectDetailsSubmitted` | `boolean` | No | Stripe `details_submitted`. |
| `stripeConnectRequirementsCurrentlyDueCount` | `number` (int) | No | `len(requirements.currently_due)` at last webhook. |
| `stripeConnectRequirementsCurrentlyDueSummary` | `string` | No | Comma-joined requirement keys; truncated (~500 chars + `…`). |
| `stripeConnectLastWebhookEventId` | `string` | No | Last applied Stripe event id (`evt_...`) for Connect. |
| `stripeConnectLastAccountUpdatedAt` | `Timestamp` | No | Server time when the webhook merge ran. |

## UX-oriented status (not stored in v1)

Product copy may use a single **onboarding / eligibility** label. Until a later story denormalizes it, **derive** from the mirror fields above, for example:

| Derived label | Rule of thumb (client) |
|---------------|-------------------------|
| **Not started** | No `stripeConnectAccountId`. |
| **In progress** | Has `stripeConnectAccountId` but not (`stripeConnectDetailsSubmitted` && `stripeConnectPayoutsEnabled` && `stripeConnectChargesEnabled` with `stripeConnectRequirementsCurrentlyDueCount === 0`). |
| **Ready for payouts** | Booleans true and **no** currently-due requirements (`count === 0`). |
| **Restricted / needs action** | Account exists but payouts or charges false, or `stripeConnectRequirementsCurrentlyDueCount > 0`. |

Optional future persisted fields (see backlog / Epic P6-C): **`connectOnboardingStatus`**, **`payoutsEnabledAt`** — not written by the server today; add to this doc and to [`user-payout-profile.model.ts`](../../src/app/shared/models/user-payout-profile.model.ts) when implemented.

## TypeScript

See **`src/app/shared/models/user-payout-profile.model.ts`** — `UserPayoutProfileFields` (partial shape merged into `users/{uid}` reads).

## Related

- Onboarding API: [weekly-contests-api-phase6.md](weekly-contests-api-phase6.md)  
- Webhook behavior: [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md)  
- UX: [weekly-contests-phase6-payouts-ux.md](weekly-contests-phase6-payouts-ux.md)
