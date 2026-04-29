# Story GL-B1 — Phase 5 staging QA evidence (shared staging, stable URLs)

**Story:** [GL-B1](weekly-contests-production-go-live-jira.md#story-gl-b1--repeat-phase-5-staging-qa-on-shared-staging-with-stable-urls) ([weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md))  
**Purpose:** Archive proof that **[weekly-contests-phase5-staging-qa.md](weekly-contests-phase5-staging-qa.md)** was executed **end-to-end** on **shared staging** (not only on a developer laptop), using **stable, documented URLs** for the SPA, API, Stripe webhooks, and Firebase — prerequisite evidence before production payment enablement.

**Status:** Template — fill rows when QA completes; attach ticket links / screenshot folders as needed.

**Scope:** Stripe **test mode** only; same scope as the Phase 5 staging runbook.

---

## 1. Stable environment URLs (required before QA)

Replace placeholders with your **team-shared staging** values (same URLs every engineer uses — avoid random local ports as the **only** proof).

| Surface | URL / identifier | Recorded by | Date |
|---------|------------------|-------------|------|
| **Public SPA** (origin for Checkout return) | `https://________________` | | |
| **API base** (Express / Cloud Run host serving `/api/v1/...`) | `https://________________` | | |
| **Stripe webhook** — Dashboard endpoint URL | `https://________________/api/v1/webhooks/stripe` | | |
| **Stripe Dashboard** — Webhook **Signing secret** source | ☐ Dashboard `whsec_…` ☐ CLI session (note session id below) | | |
| **Stripe CLI** session id / notes (if used instead of Dashboard URL) | | | |
| **Firebase / Firestore** — Project id | | | |
| **Angular staging build** — Branch / commit / CI run | | | |

**Rule:** `CONTESTS_CHECKOUT_APP_ORIGIN` on the server must equal the **Public SPA** origin (scheme + host + port if any), **no trailing slash** ([stripe.md](../payments/stripe.md)).

---

## 2. Execution checklist

Perform every section of the runbook on the environment above:

| Runbook section | Done (Y/N) | Notes |
|-----------------|------------|-------|
| [§ Preconditions](weekly-contests-phase5-staging-qa.md#preconditions) | | |
| [§ 1 Stripe CLI](weekly-contests-phase5-staging-qa.md#1-stripe-cli--forward-webhooks-to-staging-or-local) (skip only if Dashboard webhook already hits staging reliably) | | |
| [§ 2 Test cards](weekly-contests-phase5-staging-qa.md#2-test-cards-stripe-test-mode) | | |
| [§ 3 Exit criteria](weekly-contests-phase5-staging-qa.md#3-exit-criteria--verification-steps) — all sub-rows **3.1–3.13** | | |
| [§ 4 Ledger spot-check](weekly-contests-phase5-staging-qa.md#4-ledger-vs-dashboard-spot-check-quick) | | |
| [§ 5 Observability](weekly-contests-phase5-staging-qa.md#5-observability-optional-during-qa) (optional) | | |

**Automated:** Confirm **`npm run test:server`** (includes Phase 5 payment tests) green on release candidate — CI link: ________________

---

## 3. Webhook endpoint documentation (acceptance)

Document how staging receives webhooks (pick one or both):

### Option A — Stripe Dashboard → staging API

| Field | Value |
|-------|--------|
| Dashboard → Developers → Webhooks → **Endpoint URL** | |
| **Listening for** events (contest payment success/failure/refund + any Connect if enabled) | |
| **Last successful delivery** timestamp (screenshot or paste) | |

### Option B — Stripe CLI forward

| Field | Value |
|-------|--------|
| Command used | `stripe listen --forward-to …` |
| **Signing secret** deployed to server for that test | `whsec_…` (redact in ticket if pasting publicly) |

---

## 4. `processedStripeEvents` idempotency (acceptance)

| Step | Evidence |
|------|----------|
| Same **`evt_…`** resent (Dashboard **Resend** or duplicate delivery) | Screenshot or log line showing **`duplicate_stripe_event`** / no duplicate ledger credit |
| **`event.id`** used | `evt________________` |
| **`processedStripeEvents/{eventId}`** exists in Firestore | ☐ verified |

---

## 5. Phase 5 exit criteria — evidence summary

Copy from [§6 Sign-off template](weekly-contests-phase5-staging-qa.md#6-sign-off-template-copy-to-ticket--release-doc); add links to tickets, Drive folders, or Stripe event ids.

| Phase 5 exit criterion | Verified (Y/N) | Evidence (link / id) | Tester | Date |
|------------------------|----------------|-------------------------|--------|------|
| Test-mode money | | | | |
| No PAN/storage | | | | |
| Webhooks authoritative | | | | |
| Idempotent webhooks | | | | |
| Ledger reconciliation | | | | |
| Free contests unchanged | | | | |

**Release / environment:**  
**Stripe mode:** Test only ☐  
**Notes (blockers, follow-ups):**  

---

## 6. GL-B1 story sign-off

| Role | Name | Date |
|------|------|------|
| Tester (primary) | | |
| Reviewer (optional) | | |

---

## References

- [weekly-contests-phase5-staging-qa.md](weekly-contests-phase5-staging-qa.md) — full procedure  
- [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) — Phase 5 exit table  
- [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md) — Epic **GL-B**
