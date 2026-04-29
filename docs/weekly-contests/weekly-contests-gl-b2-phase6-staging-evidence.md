# Story GL-B2 — Phase 6 staging QA evidence (shared staging, Connect + transfer E2E)

**Story:** [GL-B2](weekly-contests-production-go-live-jira.md#story-gl-b2--repeat-phase-6-staging-qa-connect--transfer-e2e) ([weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md))  
**Purpose:** Archive proof that **[weekly-contests-phase6-staging-qa.md](weekly-contests-phase6-staging-qa.md)** was executed **end-to-end** on **shared staging** (not only on a developer laptop), using **stable, documented URLs** for the SPA, API, Stripe webhooks, Connect onboarding, and Firebase — prerequisite evidence before production prize payout enablement.

**Status:** Template — fill rows when QA completes; attach ticket links / screenshot folders as needed.

**Scope:** Stripe **test mode** only; same scope as the Phase 6 staging runbook ([P6-I1](weekly-contests-phase6-payouts-jira.md)).

---

## 1. Stable environment URLs (required before QA)

Replace placeholders with your **team-shared staging** values (same URLs every engineer uses — avoid random local ports as the **only** proof).

| Surface | URL / identifier | Recorded by | Date |
|---------|------------------|-------------|------|
| **Public SPA** | `https://________________` | | |
| **API base** (Express / Cloud Run host serving `/api/v1/...` and `/api/internal/v1/...`) | `https://________________` | | |
| **Stripe webhook** — Dashboard endpoint URL | `https://________________/api/v1/webhooks/stripe` | | |
| **Stripe Dashboard** — Webhook **Signing secret** source | ☐ Dashboard `whsec_…` ☐ CLI session (note session id below) | | |
| **Stripe CLI** session id / notes (if used instead of Dashboard URL) | | | |
| **Firebase / Firestore** — Project id | | | |
| **Angular staging build** — Branch / commit / CI run | | | |

**Rules**

- `CONTESTS_CHECKOUT_APP_ORIGIN` on the server must equal the **Public SPA** origin (scheme + host + port if any), **no trailing slash** ([stripe.md](../payments/stripe.md)).
- Phase 6 requires **`CONTESTS_PAYMENTS_ENABLED=true`** and payout execute secrets per [Preconditions](weekly-contests-phase6-staging-qa.md#preconditions) — record which operator secret path was used for **`POST …/payouts/execute`** or admin **`payout-execute`**.

---

## 2. Execution checklist

Perform every section of the runbook on the environment above:

| Runbook section | Done (Y/N) | Notes |
|-----------------|------------|-------|
| [Preconditions](weekly-contests-phase6-staging-qa.md#preconditions) | | |
| [§ 1 Stripe CLI](weekly-contests-phase6-staging-qa.md#1-stripe-cli--forward-webhooks-to-staging-or-local) (skip only if Dashboard webhook already hits staging reliably) | | |
| [§ 2 Connect test account (Express)](weekly-contests-phase6-staging-qa.md#2-connect-test-account-express) | | |
| [§ 3 Paid entry → scoring → `paid`](weekly-contests-phase6-staging-qa.md#3-paid-entry--scoring--paid-dry-run--results) | | |
| [§ 4 Prize payout execute](weekly-contests-phase6-staging-qa.md#4-prize-payout-execute) | | |
| [§ 5 Firestore + Stripe verification (transfer E2E)](weekly-contests-phase6-staging-qa.md#5-firestore--stripe-verification-transfer-e2e) | | |
| [§ 6 Refund / reversal drill](weekly-contests-phase6-staging-qa.md#6-refund--reversal-drill) — at least **6a** and/or **6b** per runbook | | |
| [§ 7 Observability](weekly-contests-phase6-staging-qa.md#7-observability-optional-during-qa) (optional) | | |

**Automated:** Confirm **`npm run test:server`** green on release candidate — CI link: ________________

---

## 3. Webhook endpoint documentation (acceptance)

Document how staging receives webhooks (pick one or both). Phase 6 proof requires lifecycle for **`account.updated`** (Connect) and at least one **`transfer.*`** path after prize execute ([weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) — P6-B3, P6-E2).

### Option A — Stripe Dashboard → staging API

| Field | Value |
|-------|--------|
| Dashboard → Developers → Webhooks → **Endpoint URL** | |
| **Listening for** events (include **`account.updated`**, **`transfer.*`**, **`payout.*`** as subscribed) | |
| **Last successful delivery** for a **`transfer.*`** or **`account.updated`** (screenshot or paste) | |

### Option B — Stripe CLI forward

| Field | Value |
|-------|--------|
| Command used | `stripe listen --forward-to …` |
| **Signing secret** deployed to server for that test | `whsec_…` (redact in ticket if pasting publicly) |

---

## 4. Connect + Transfer E2E identifiers (acceptance)

| Artifact | Value / evidence |
|----------|------------------|
| Winner **Firebase uid** | |
| **`stripeConnectAccountId`** (`acct_…`) after onboarding | |
| **Contest id** used for E2E | |
| At least one **`stripeTransferId`** (`tr_…`) from **`payouts/final`** | |
| **`transfer.created` / `transfer.paid`** (or equivalent) **evt_…** processed | `evt________________` |
| **`processedStripeEvents/{eventId}`** exists for prize-path events | ☐ verified |

---

## 5. `processedStripeEvents` idempotency (acceptance)

| Step | Evidence |
|------|----------|
| Same **`evt_…`** resent (Dashboard **Resend** or duplicate delivery) for a prize-related event | Log line showing idempotent handling / no duplicate ledger movement |
| **`event.id`** used | `evt________________` |

---

## 6. Phase 6 exit criteria — evidence summary

Copy from [§8 Sign-off](weekly-contests-phase6-staging-qa.md#8-sign-off-copy-to-ticket--release-doc); add links to tickets, Drive folders, Stripe **Transfer** ids, or Firestore paths.

| Phase 6 exit criterion | Verified (Y/N) | Evidence (link / id) | Tester | Date |
|------------------------|----------------|-------------------------|--------|------|
| Connect Express + `users/{uid}` mirrors | | | | |
| Scoring → `paid` + `results/final` + `payouts/dryRun` | | | | |
| Payout execute + `payouts/final` + `ledgerEntries` | | | | |
| Connected account balance / Dashboard matches transfer | | | | |
| Refund drill **and/or** void-after-prize | | | | |
| Product acceptance (UX, copy) | | | | |
| Finance / risk (test-mode noted) | | | | |

**Release / environment:**  
**Stripe mode:** Test only ☐  
**Notes (blockers, follow-ups):**  

---

## 7. GL-B2 story sign-off

| Role | Name | Date |
|------|------|------|
| Tester (primary) | | |
| Reviewer (optional) | | |

---

## References

- [weekly-contests-phase6-staging-qa.md](weekly-contests-phase6-staging-qa.md) — full procedure  
- [weekly-contests-phase6-payouts-jira.md](weekly-contests-phase6-payouts-jira.md) — Story **P6-I1**  
- [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md) — Epic **GL-B**
