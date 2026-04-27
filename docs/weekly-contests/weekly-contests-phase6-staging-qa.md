# Phase 6 — Staging QA checklist (Connect + transfer E2E) (Story P6-I1)

**Purpose:** Operator checklist before enabling **automated** prize payouts or treating Phase 6 as **staging-complete** for winner money. Complements [weekly-contests-phase5-staging-qa.md](weekly-contests-phase5-staging-qa.md) (entry fees); this doc focuses on **Stripe Connect (Express)**, **scoring → `paid`**, **prize execute**, **Transfer** lifecycle, and **reversal / refund** drills in **Stripe test mode** only.

**Scope:** `users/{uid}` Connect fields, `contests/{contestId}` through **`paid`** with **`results/final`** + **`payouts/dryRun`**, internal or Admin **payout execute**, **`payouts/final`** + **`ledgerEntries`**, **`transfer.*` / `payout.*`** webhooks (P6-E2), optional **void-after-prize** reversal (P6-F1). Not a substitute for [Phase 0 legal / product gates](weekly-contests-phase6-payouts-adr.md#phase-0--legal--product-gate-blocking-live-payouts) before **live** keys.

**Related:** [stripe.md](../payments/stripe.md) (Connect appendix, env vars), [weekly-contests-phase5-staging-qa.md](weekly-contests-phase5-staging-qa.md), [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) (P6-B3 Connect, P6-E2 prize webhooks), [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md), [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md), [weekly-contests-phase6-observability.md](weekly-contests-phase6-observability.md), [weekly-contests-schema-users-payouts.md](weekly-contests-schema-users-payouts.md), [weekly-contests-schema-contest-payouts-final.md](weekly-contests-schema-contest-payouts-final.md), [weekly-contests-ops-p6-f1-void-prize.md](weekly-contests-ops-p6-f1-void-prize.md).

**Automated:** There is no separate `npm` script for full Connect + Transfer E2E (Stripe + Firestore integration). **`npm run test:server`** covers helpers, webhook parsing, and payout logic with mocks — run it in CI before manual staging.

**Capacity:** Firestore read/write and Stripe call counts per run are summarized in [weekly-contests-ops-p6-payout-execute.md — Load and cost (P6-I2)](weekly-contests-ops-p6-payout-execute.md#load-and-cost-story-p6-i2).

---

## Preconditions

| Item | Notes |
|------|--------|
| **Stripe** | Dashboard in **test mode**; platform account has **Connect** enabled; webhook endpoint reaches staging **`POST …/api/v1/webhooks/stripe`** (or [Stripe CLI](#1-stripe-cli--forward-webhooks-to-staging-or-local)). Subscribe to **`account.updated`**, **`transfer.*`**, **`payout.*`** (see [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) § P6-E2). |
| **Env (server)** | `CONTESTS_PAYMENTS_ENABLED=true`, `STRIPE_SECRET_KEY` (**`sk_test_…`**), `STRIPE_WEBHOOK_SECRET`, `CONTESTS_CHECKOUT_APP_ORIGIN` as in Phase 5. **Payout execute:** `PAYOUT_OPERATOR_SECRET` or `CONTESTS_OPERATOR_SECRET` for internal hook; optional `CONTEST_PAYOUT_BALANCE_GUARD_ENABLED=true` (P6-E1) if you want staging to match production balance checks. |
| **Platform balance** | Test transfers debit the **platform** test balance. Ensure enough **USD available** for the planned prize line(s), or temporarily disable the balance guard — see [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md). |
| **Contest** | **`bio-ball`**, **`entryFeeCents > 0`** (or zero if you only need a free winner — then skip Checkout in §3), join window, winner user distinct from operator test account if that simplifies Firestore checks. |
| **Access** | Firebase (Firestore), Stripe Dashboard (**Connect → Accounts**, **Transfers**, **Developers → Events**), server logs filtered by **`domain":"contest_payouts"`** ([weekly-contests-phase6-observability.md](weekly-contests-phase6-observability.md)). |
| **Admin** | Firebase user with **`admin: true`** for Admin payout execute / void-after-prize / scoring admin routes used in your environment. |

---

## 1. Stripe CLI — forward webhooks to staging (or local)

Same pattern as Phase 5; required if Dashboard cannot reach your API.

```bash
stripe listen --forward-to https://<staging-api-host>/api/v1/webhooks/stripe
```

- Set **`STRIPE_WEBHOOK_SECRET`** on the receiving server to the CLI **signing secret** for the session (or use the Dashboard endpoint secret when not using CLI).
- **Pass:** `account.updated` and at least one **`transfer.*`** after prize execute show **200** in CLI; server logs include **`component":"stripe_webhook_payout"`** (or generic webhook success path) with `eventId` / `eventType` where applicable.

---

## 2. Connect test account (Express)

Complete onboarding for the **winner** test user so execute can target a real **`acct_…`**.

| Step | Action | Expected |
|------|--------|----------|
| 2.1 | Sign in as the winner test user; open the in-app **Connect / payout setup** flow (Account Link from server — see [weekly-contests-phase6-payouts-ux.md](weekly-contests-phase6-payouts-ux.md), API [weekly-contests-api-phase6.md](weekly-contests-api-phase6.md)). | Redirect to Stripe-hosted onboarding; complete **test** data until Stripe allows the account. |
| 2.2 | Wait for **`account.updated`** (or refresh user in app). | Firestore **`users/{uid}`** has **`stripeConnectAccountId`** (`acct_…`), and mirrors **`stripeConnectChargesEnabled`**, **`stripeConnectPayoutsEnabled`**, **`stripeConnectDetailsSubmitted`** consistent with a **payout-ready** test account ([schema](weekly-contests-schema-users-payouts.md)). |
| 2.3 | Stripe Dashboard → **Connect → Accounts**. | Same **`acct_…`** appears; type **Express** (or documented test variant). |

**Pass:** Winner uid is **Connect-ready** per [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md) prerequisites.

---

## 3. Paid entry → scoring → `paid` (dry-run + results)

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Join contest and pay entry fee (**Phase 5** path: Checkout + webhooks) so **`entries/{uid}.paymentStatus`** is **`paid`** (or use **`free`** only if your dry-run awards that uid without a paid fee). | Entry doc matches [weekly-contests-schema-entries.md](weekly-contests-schema-entries.md). |
| 3.2 | Close contest window; run **scoring** (admin or scheduled job per your ops doc) so contest transitions **`open` → `scoring` → `paid`**. | **`contests/{id}.status`** is **`paid`**. |
| 3.3 | Inspect **`contests/{id}/results/final`** and **`contests/{id}/payouts/dryRun`**. | Both exist; dry-run lines include intended **`rank`**, **`uid`**, **`amountCents`** for the winner ([weekly-contests-schema-results.md](weekly-contests-schema-results.md)). |

**Pass:** Artifacts required for execute exist; winner line **`amountCents > 0`** matches product intent for the test contest.

---

## 4. Prize payout execute

| Step | Action | Expected |
|------|--------|----------|
| 4.1 | Call **`POST /api/internal/v1/contests/:contestId/payouts/execute`** with operator Bearer secret **or** **`POST /api/v1/admin/contests/:contestId/payout-execute`** with admin token (see [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md)). Body `{}` or optional `payoutJobId`. | HTTP **200**; JSON includes **`aggregateStatus`**, **`lines`**, **`payoutJobId`**. |
| 4.2 | On failure, read JSON **`error.code`** and logs (`payout_job` lines). | **409** `insufficient_platform_balance`, **409** `payout_held`, **409** `payout_final_exists_incomplete`, etc., are documented in ops docs — resolve before declaring pass. |

**Pass:** At least one successful **`transfers.create`** for a money line **or** a documented intentional **skip** (`skipped` line with public failure code) that matches test setup.

---

## 5. Firestore + Stripe verification (transfer E2E)

| Step | Action | Expected |
|------|--------|----------|
| 5.1 | Open **`contests/{id}/payouts/final`**. | **`lines`** show **`status`**, **`stripeTransferId`** (`tr_…`) for succeeded transfers, **`aggregateStatus`** matches API response ([schema](weekly-contests-schema-contest-payouts-final.md)). |
| 5.2 | Open **`ledgerEntries/{tr_id}`** for each succeeded **`tr_…`**. | **`lineType: prize_transfer_out`**, **`direction: debit`**, **`amountCents`** matches line ([weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md)). |
| 5.3 | Stripe Dashboard → **Connect → Transfers** (platform). | Transfer amount and **destination** **`acct_…`** match the winner; metadata includes **`contest_id`**, **`firebase_uid`** (and rank) as implemented. |
| 5.4 | **Connected account balance:** Stripe Dashboard → select the **connected account** → **Balances** / **Transactions** (Express test account). | **Available** (or pending) balance increased by the prize amount in **test mode** (timing may follow `transfer.paid` / Stripe test rules). |
| 5.5 | Stripe **Events** or Firestore **`processedStripeEvents`**. | **`transfer.created` / `transfer.paid`** (and related) processed; **`payouts/final`** line updated if webhooks arrive after execute ([P6-E2](weekly-contests-phase5-webhooks.md)). |
| 5.6 | (Optional) Trigger **`payout.paid`** path: if the test user initiates a **bank payout** from Express in test mode, confirm **`users/{uid}`** **`stripePayoutLast*`** fields update when exactly one user maps to the Connect account ([schema](weekly-contests-schema-users-payouts.md)). | Confirms **`payout.*`** webhook wiring; skip if product does not exercise bank payout in staging. |

**Pass:** Money movement and documents are **consistent** across Stripe, **`payouts/final`**, and **`ledgerEntries`**.

---

## 6. Refund / reversal drill

Run **at least one** of the following (both is better for combined P5+P6 confidence).

### 6a. Entry fee refund (Phase 5)

| Step | Action | Expected |
|------|--------|----------|
| 6a.1 | In Stripe test Dashboard, issue a **partial** then **full** refund on the contest entry PaymentIntent used in §3. | **`refund.updated`** path updates entry **`refundedAmountCents`** / **`paymentStatus: refunded`** per [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) P5-E3; ledger debits align. |

### 6b. Prize transfer reversal (Phase 6 — P6-F1)

Use only on a **throwaway** staging contest after §4–5 succeeded with real **`tr_…`** rows (not `notRealMoney`).

| Step | Action | Expected |
|------|--------|----------|
| 6b.1 | **`POST /api/v1/admin/contests/:contestId/void-after-prize`** with body **`reason`** (≥8 chars) and **`confirmPhrase": "VOID_PRIZES"`** ([runbook](weekly-contests-ops-p6-f1-void-prize.md)). | **200**; **`reversalCount`** ≥ 1; Stripe shows **transfer reversals**; new **`ledgerEntries`** with **`prize_transfer_reversal`**; contest ends **`cancelled`**; **`results/final`**, **`payouts/dryRun`**, **`payouts/final`** removed per runbook. |
| 6b.2 | Confirm connected account balance / Dashboard. | Reversed funds no longer available as in step 5.4 (subject to Stripe test timing). |

**Pass:** No orphaned **`tr_…`** without matching Firestore ledger + contest state; support notes any Stripe test quirks.

---

## 7. Observability (optional during QA)

- Filter **`jsonPayload.domain="contest_payouts"`** — see [weekly-contests-phase6-observability.md](weekly-contests-phase6-observability.md).
- Set **`CONTESTS_PAYOUT_METRIC_COUNTERS=1`** briefly to validate **`contest_payout_metrics`** lines in the log sink ([stripe.md](../payments/stripe.md)).

---

## 8. Sign-off (copy to ticket / release doc)

| Check | Verified (Y/N) | Evidence (link / id) | Owner | Date |
|-------|------------------|----------------------|-------|------|
| Connect Express test account + `users/{uid}` mirrors | | | Eng | |
| Scoring → `paid` + `results/final` + `payouts/dryRun` | | | Eng | |
| Payout execute 200 + `payouts/final` + `ledgerEntries` | | | Eng | |
| Connected account balance / Dashboard matches transfer | | | Eng | |
| Refund drill (§6a) **and/or** void-after-prize (§6b) | | | Eng | |
| Product acceptance (UX, copy, winner communication) | | | Product | |
| Finance / risk sign-off (test-mode only still noted) | | | Finance | |

**Environment:** ________________________  
**Stripe mode:** Test only ☐  
**Notes (blockers, follow-ups):**  

---

## References

- [weekly-contests-phase6-payouts-jira.md](weekly-contests-phase6-payouts-jira.md) — Story **P6-I1**  
- [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md)  
- [product-roadmap-contests-and-payments.md](../product/product-roadmap-contests-and-payments.md) — Phase 6  
