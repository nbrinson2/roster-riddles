# Phase 5 — Staging QA & reconciliation runbook (Story P5-H2)

**Purpose:** Operator checklist to satisfy **Phase exit criteria** in [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) (table at top of that doc) before promoting payment work or turning on **`CONTESTS_PAYMENTS_ENABLED=true`** in a shared environment.

**Scope:** Stripe **test mode** only; **Express** webhook + Checkout + Firestore (`entries`, `ledgerEntries`, `processedStripeEvents`). Not a substitute for legal/product sign-off on live keys.

**Related:** [stripe.md](../payments/stripe.md), [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md), [weekly-contests-phase5-observability.md](weekly-contests-phase5-observability.md), [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md), [weekly-contests-schema-entries.md](weekly-contests-schema-entries.md), UI Walk **C** in [weekly-contests-ui-walkthrough-check.md](weekly-contests-ui-walkthrough-check.md). **Phase 6 (prizes):** [weekly-contests-phase6-staging-qa.md](weekly-contests-phase6-staging-qa.md).

**Automated (Story P5-H3):** `npm run test:server:phase5-payments` exercises mock Stripe payloads, success-webhook idempotency, and the paid vs free join matrix (the same files are also run by **`npm run test:server`**).

---

## Preconditions

| Item | Notes |
|------|--------|
| **Stripe** | Dashboard project in **test mode**; webhook endpoint URL points at **staging** `POST …/api/v1/webhooks/stripe`, or use **Stripe CLI** (below). |
| **Env (server)** | `CONTESTS_PAYMENTS_ENABLED=true`, `STRIPE_SECRET_KEY` (**`sk_test_…`**), `STRIPE_WEBHOOK_SECRET` (`whsec_…` from Dashboard or CLI), `CONTESTS_CHECKOUT_APP_ORIGIN` = public staging web origin (no trailing slash). See [stripe.md](../payments/stripe.md). |
| **Contest data** | At least one **`open`** contest with **`entryFeeCents > 0`**, join window active, **`gameMode: bio-ball`**. Optional second contest with **`entryFeeCents === 0`** for free-path regression. |
| **Access** | Firebase console (Firestore), Stripe Dashboard (Payments, Developers → Webhooks, Developers → Events), logs for **`domain: contest_payments`** (see [weekly-contests-phase5-observability.md](weekly-contests-phase5-observability.md)). |

---

## 1. Stripe CLI — forward webhooks to staging (or local)

Use this when the Dashboard cannot reach localhost, or to capture **`whsec_…`** without editing Dashboard URLs.

```bash
# Replace host with your staging API base if not local
stripe listen --forward-to https://<staging-api-host>/api/v1/webhooks/stripe
```

- The CLI prints a **signing secret** — set **`STRIPE_WEBHOOK_SECRET`** on the server that receives the forward to that value for the duration of the test (rotate back to Dashboard secret when done if needed).
- Trigger test events from the CLI if useful: `stripe trigger checkout.session.completed` (payload may **not** match contest metadata; prefer real Checkout from the app for E2E). See [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md).

**Pass:** At least one **`checkout.session.completed`** or **`payment_intent.succeeded`** from a **real** contest Checkout shows **200** in CLI and server logs include `component: stripe_webhook`, `eventId`, `eventType`.

---

## 2. Test cards (Stripe test mode)

Use [Stripe test cards](https://docs.stripe.com/testing#cards) in Checkout. Examples:

| Goal | Card number | CVC / expiry | Notes |
|------|----------------|--------------|--------|
| **Success** | `4242 4242 4242 4242` | Any future expiry, any 3-digit CVC | Expect webhook → entry **`paymentStatus: paid`**, fee snapshot, ledger **credit** line. |
| **Decline** | `4000 0000 0000 0002` | Any valid | Expect failure webhook path; entry should **`failed`** when entry was **`pending`** (see [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) P5-E2). |
| **3DS / extra auth** | `4000 0025 3159 4242` | Per Stripe docs | Use when testing redirect / async edge cases. |

**Never** use live card numbers in staging. **Pass:** Success path completes; decline path matches documented entry states without corrupting **`paid`** rows.

---

## 3. Exit criteria → verification steps

Map each **Phase exit criterion** (Jira doc table) to concrete checks.

### Criterion: **Test-mode money**

| Step | Action | Expected |
|------|--------|----------|
| 3.1 | Sign in as test user; start Checkout for a **paid** contest; pay with **`4242…`**. | Redirect success URL; Stripe Dashboard shows **succeeded** PaymentIntent / Checkout Session in **test** data. |
| 3.2 | After webhooks process, open **`contests/{contestId}/entries/{uid}`** in Firestore. | **`paymentStatus: paid`**, `stripePaymentIntentId` / session ids set, `entryFeeCentsSnapshot` matches contest fee, `paidAt` populated (see [weekly-contests-schema-entries.md](weekly-contests-schema-entries.md)). |
| 3.3 | Open **`ledgerEntries/{stripeEventId}`** where `stripeEventId` is the **`evt_…`** from success handler. | One **credit** line: `lineType: contest_entry_charge`, `direction: credit`, `amountCents` equals fee, `stripeEventId` matches, `source: webhook` ([ledger schema](weekly-contests-phase5-ledger-schema.md)). |

### Criterion: **No PAN/storage**

| Step | Action | Expected |
|------|--------|----------|
| 3.4 | Search Firestore and server logs for card-like 16-digit strings or full PAN. | **No** matches; only `pi_`, `cs_`, `cus_`, `evt_` style ids. |
| 3.5 | Stripe Dashboard → PaymentIntent → expand metadata. | Contest metadata keys only; no card number stored in your DB. |

### Criterion: **Webhooks authoritative**

| Step | Action | Expected |
|------|--------|----------|
| 3.6 | Complete payment; **before** webhook lands (or simulate delay), observe client after redirect. | UI may show “pending payment” / not fully entered until webhook; final **entered + paid** state requires webhook processing (not redirect alone). |
| 3.7 | Confirm **`POST …/join`** for same contest returns **409** `payment_required` until entry is **`paid`** ([join / checkout alignment](weekly-contests-phase5-entry-fees-adr.md)). | Matches ADR Option A behavior. |

### Criterion: **Idempotent webhooks**

| Step | Action | Expected |
|------|--------|----------|
| 3.8 | In Stripe Dashboard → **Events**, **Resend** the same **`checkout.session.completed`** (or duplicate delivery). | **`processedStripeEvents/{eventId}`** semantics: no second ledger credit for same `evt_…`; logs show `duplicate_stripe_event` or companion PI path as documented. |
| 3.9 | Optional: resend companion **`payment_intent.succeeded`** for same PI. | No duplicate **credit** line; settlement doc prevents double fee ledger ([webhooks doc](weekly-contests-phase5-webhooks.md) P5-E1). |

### Criterion: **Ledger reconciliation**

| Step | Action | Expected |
|------|--------|----------|
| 3.10 | Pick one successful test payment: note **amount** (USD cents) in Stripe for that PI/session. | Equals **`entryFeeCentsSnapshot`** on the entry and **`amountCents`** on the **`contest_entry_charge`** ledger line (tolerance: **0** cents for v1 USD integer fees). |
| 3.11 | (Optional refund test) Issue a **partial** then **full** refund in test Dashboard. | **`refund.updated` (succeeded)** produces **debit** ledger lines; cumulative **`refundedAmountCents`** on entry matches refunds; full refund sets **`paymentStatus: refunded`** per [webhooks doc](weekly-contests-phase5-webhooks.md) P5-E3. |
| 3.12 | Sum **credit** lines minus **debit** lines for that `uid` + `contestId` in Firestore (manual or script). | Matches net expected for that test case against Stripe balance for the test account (document any known Stripe test quirks in ticket notes). |

### Criterion: **Free contests unchanged**

| Step | Action | Expected |
|------|--------|----------|
| 3.13 | Run **Walk C** in [weekly-contests-ui-walkthrough-check.md](weekly-contests-ui-walkthrough-check.md) on a contest with **`entryFeeCents === 0`**. | Join via **`POST …/join`** only; **no** Checkout; entry present without paid Stripe fields required. |

---

## 4. Ledger vs Dashboard spot-check (quick)

1. **Stripe** — Payments: locate the test charge; note **PaymentIntent id**, **gross amount**, **currency** (USD).
2. **Firestore** — `contests/{id}/entries/{uid}`: confirm **`stripePaymentIntentId`**, **`entryFeeCentsSnapshot`**, **`paymentStatus`**.
3. **Firestore** — `ledgerEntries`: filter by `contestId` / `uid` (indexed queries per [ledger schema](weekly-contests-phase5-ledger-schema.md)); confirm line **`stripeObjectId`** / **`stripeEventId`** align with Dashboard **event** ids.
4. **Logs** — Filter **`domain":"contest_payments"`**; confirm **`outcome`** for the flow is `ok` (or documented skip), not `contest_payment_handler_failed`.

---

## 5. Observability (optional during QA)

- Set **`CONTESTS_PAYMENTS_METRIC_COUNTERS=1`** only if validating counter emission to stderr/log sink ([weekly-contests-phase5-observability.md](weekly-contests-phase5-observability.md)).
- Alerting: plan a log-based metric on **`metricName":"contest_webhook_failure_total"`** or **`outcome":"contest_payment_handler_failed"`** before production.

---

## 6. Sign-off template (copy to ticket / release doc)

| Phase 5 exit criterion | Verified (Y/N) | Evidence (link / id) | Tester | Date |
|------------------------|----------------|-------------------------|--------|------|
| Test-mode money | | | | |
| No PAN/storage | | | | |
| Webhooks authoritative | | | | |
| Idempotent webhooks | | | | |
| Ledger reconciliation | | | | |
| Free contests unchanged | | | | |

**Release / environment:** ________________________  
**Stripe mode:** Test only ☐  
**Notes (blockers, follow-ups):**  

---

## References

- [product-roadmap-contests-and-payments.md](../product/product-roadmap-contests-and-payments.md) — Phase 5 context  
- [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) — backlog + exit table  
- [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md) — join vs pay order  
