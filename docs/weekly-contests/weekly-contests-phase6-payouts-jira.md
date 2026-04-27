# Phase 6 — Payouts (prize money) — Jira backlog

**Scope:** Move from **dry-run** prize lines (`contests/{contestId}/payouts/dryRun`, numeric only) to **real money movement** to winners (or declared recipients), with **auditability**, **idempotency**, **operator controls**, and **Stripe** (recommended: **Connect** for recipient onboarding + **Transfers** or **Payouts** per product choice). Assumes **Phase 4** scoring artifacts (`results/final`) and **Phase 5** entry fees + `ledgerEntries` patterns exist.

**Prerequisites**

- [product-roadmap-contests-and-payments.md](../product/product-roadmap-contests-and-payments.md) Phase **0** extended for **prizes / KYC / tax / sweepstakes** posture (regions, winner verification, 1099 thresholds if US).
- Phase **4**: `results/final`, `payouts/dryRun` stable and trusted.
- Phase **5**: `CONTESTS_PAYMENTS_ENABLED`, webhooks, `ledgerEntries` append-only model ([weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md)).

**Suggested labels:** `phase-6`, `contests`, `payouts`, `stripe`, `connect`, `compliance`  
**Suggested fix version:** `Weekly contests — winner payouts (Stripe Connect)`

---

## Phase exit criteria (product)

| Criterion | Verification |
|-----------|--------------|
| **Deterministic prize lines** | For a frozen `results/final` + contest config, generated **payout instructions** match dry-run semantics (amounts, ranks, tie policy) unless product explicitly diverges — document any delta. |
| **Recipient readiness** | Winners above threshold **cannot** receive automated transfer until **Connect onboarding** (or chosen alternative) is **`charges_enabled` / payouts_enabled`** per Stripe; UX + admin path documented. |
| **Money movement traceable** | Every outbound movement has **Stripe object id(s)** + **ledger line(s)** + **immutable contest payout run** doc (no silent edits). |
| **Idempotent execution** | Retries of the same payout job **do not** double-pay; Stripe idempotency keys or “already paid” guards documented. |
| **Webhook authoritative** | Transfer / payout / failure events update Firestore **only** through verified handlers (same discipline as Phase 5). |
| **Staging E2E** | Test mode: contest close → scoring → payout job → **test connected account** receives expected amount (minus fees if applicable). |
| **Rollback / hold** | Operator can **hold** or **cancel** a scheduled payout before settlement; policy for **already sent** funds is documented (manual Stripe Dashboard + ticket). |

---

## Epic P6-A — ADR & payout semantics

### Story P6-A1 — ADR: Phase 6 payouts (who gets paid, when, how much)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Author `docs/weekly-contests/weekly-contests-phase6-payouts-adr.md`: mapping from `results/final` + `payouts/dryRun` to real payouts, currency, rounding, split prizes, void contests. |

**Description**

Lock **product + engineering** before Connect work:

- **Source of truth for amounts:** Start from **`payouts/dryRun.lines`** vs recompute from `results/final` — pick one; if both, define precedence on mismatch.
- **Eligible recipients:** Paid entries only? Minimum entrants? Disqualified users? Ties → split pot rules.
- **Timing:** Payout only when contest `status === 'paid'` (post-scoring) vs separate `payouts_ready` — align with existing lifecycle ([weekly-contests-schema-contests.md](weekly-contests-schema-contests.md)).
- **Currency / fees:** Single currency v1; **Stripe fees** absorbed by platform vs deducted from winner — document per line.
- **Tax / reporting:** Placeholder for **1099-K / 1099-NEC** thresholds and **W-9** collection if US; defer implementation to sub-stories but capture **non-code** requirements.
- **Non-goals v1:** Cross-border complexity, crypto, multi-currency FX.

**Acceptance criteria**

- [x] ADR merged with **state machine** for contest-level payout status (`none` \| `scheduled` \| `in_progress` \| `completed` \| `failed` \| `held`).
- [x] Explicit **link** to Phase 0 legal sign-off for real-money prizes.
- [x] Table: **event** → **Stripe API** → **Firestore writes** → **ledger line type** (new `lineType` values enumerated).

**Dependencies**

- Phase 4 scoring + dry-run payout shape ([weekly-contests-schema-results.md](weekly-contests-schema-results.md)).

**Deliverable**

- [`docs/weekly-contests/weekly-contests-phase6-payouts-adr.md`](weekly-contests-phase6-payouts-adr.md) ✅

---

### Story P6-A2 — Product copy & UX spec: winner onboarding + status

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | UX doc: what winners see when payout is pending, blocked (Connect incomplete), paid, or failed; email templates optional. |

**Description**

- **In-app:** Banner on contest detail / profile when `payoutStatus` requires action.
- **Deep link:** Stripe Connect **Account Link** return URLs; error states (user aborted, under review).
- **Support:** What CS can say from Firestore fields without opening Stripe for every ticket.

**Acceptance criteria**

- [x] UX doc linked from ADR; **product owner** sign-off table in UX doc *(pending names/dates)*.
- [x] No PII in client-visible fields beyond standings policy — **§PII & client data boundaries** in UX doc.

**Dependencies**

- Story P6-A1.

**Deliverable**

- [`docs/weekly-contests/weekly-contests-phase6-payouts-ux.md`](weekly-contests-phase6-payouts-ux.md) ✅

---

## Epic P6-B — Recipient identity: Stripe Connect onboarding

### Story P6-B1 — Stripe Connect account model (Standard vs Express vs Custom)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Choose Connect configuration; document in ADR + `docs/payments/stripe.md` appendix (capabilities, dashboard exposure, compliance). |

**Description**

- **Recommendation for v1:** **Express** connected accounts for individuals — balance of UX vs control (confirm with legal).
- Map **Firebase `uid`** → **`stripeConnectAccountId`** (acct_…) on `users/{uid}` or dedicated subdoc; **server writes only**.
- **Refresh:** When to re-fetch Account from Stripe (webhook-driven vs periodic job).

**Acceptance criteria**

- [x] Decision recorded; risks (account takeover, duplicate accounts) cross-link [leaderboards-duplicate-accounts-f2.md](../leaderboards/leaderboards-duplicate-accounts-f2.md) if winners must be email-verified.

**Dependencies**

- Story P6-A1.

**Deliverable**

- [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md) § *Stripe Connect account model* + [stripe.md](../payments/stripe.md) **Stripe Connect** appendix ✅

---

### Story P6-B2 — API: Create Stripe Account Link (authenticated)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | `POST /api/v1/me/stripe/connect/onboarding` (or under `/api/v1/payouts/...`) returns `{ url }` for hosted onboarding. |

**Description**

- **Auth:** Firebase ID token.
- **Server:** If no `acct_` yet, `stripe.accounts.create({ type: 'express', ...metadata: { uid } })` then `stripe.accountLinks.create`.
- **Idempotency:** Re-use existing account if uid already linked; handle Stripe errors with safe JSON codes.
- **Env:** `STRIPE_SECRET_KEY` with Connect permission; never expose secret to client.

**Acceptance criteria**

- [x] OpenAPI-style table in new or existing API doc; errors: `401`, `409` (already onboarded), `503` (Stripe down).
- [x] Rate limit per uid.
- [x] Server tests with Stripe mock / fixture.

**Dependencies**

- Stories P6-B1, P5-C1 (Stripe bootstrap).

**Deliverable**

- `server/payments/stripe-connect-onboarding.http.js` (or contests namespace), tests, `docs/weekly-contests/weekly-contests-api-phase6.md` ✅

---

### Story P6-B3 — Webhook: Connect `account.updated` (and related)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Extend `POST /api/v1/webhooks/stripe` routing to update user payout eligibility flags from Connect account state. |

**Description**

- Persist: `chargesEnabled`, `payoutsEnabled`, `detailsSubmitted`, `requirements.currently_due` (summary only, not full payload in Firestore if heavy).
- **Security:** Same raw-body verification as Phase 5; add event types to allowlist.
- **Idempotency:** Upsert user payout profile doc keyed by `acct_` + `uid`.

**Acceptance criteria**

- [x] Documented event list in [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) or Phase 6 webhook appendix.
- [ ] Staging: toggle test Connect account through Dashboard → Firestore reflects state within one webhook delivery.

**Dependencies**

- Story P5-C2 pattern; P6-B2.

**Deliverable**

- `server/payments/stripe-webhook-connect.js`, tests, docs update ✅

---

## Epic P6-C — Data model: payout plans & execution records

### Story P6-C1 — Schema: `users/{uid}` payout profile extension

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Document optional fields: `stripeConnectAccountId`, `connectOnboardingStatus`, `payoutsEnabledAt`, etc. |

**Description**

- **Rules:** Clients **read** only what’s needed for UX; **no client writes** (update `firestore.rules` comments).
- **Privacy:** Do not store full SSN/bank numbers — Stripe holds PII.

**Acceptance criteria**

- [x] Schema doc + TS model.
- [x] Rules tests if any new paths (none — existing `users/{uid}` deny-list tests cover payout keys).

**Dependencies**

- Story P6-B1.

**Deliverable**

- `docs/weekly-contests/weekly-contests-schema-users-payouts.md`, `src/app/shared/models/user-payout-profile.model.ts` ✅

---

### Story P6-C2 — Schema: `contests/{contestId}/payouts/final` (or `runs/{runId}`)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Immutable **execution** artifact: intended lines + Stripe transfer ids + status per winner row. |

**Description**

- **Option A (single doc):** `payouts/final` with `lines[]` including `uid`, `amountCents`, `stripeTransferId`, `status`, `failureCode`.
- **Option B (runs):** `payouts/runs/{runId}` for retries — prefer if you need full audit of each attempt.
- Link **`scoringJobId`** / **`payoutJobId`** to scoring for traceability.

**Acceptance criteria**

- [x] Doc idempotency: second job with same logical inputs **no-op** or creates new `run` with explicit `supersedesRunId`.
- [x] `firestore.rules`: **no client write**; client read optional behind feature flag / admin only (v1: same signed-in read as `payouts/dryRun`; tightening documented in schema).

**Dependencies**

- Story P6-A1.

**Deliverable**

- Schema doc [weekly-contests-schema-contest-payouts-final.md](weekly-contests-schema-contest-payouts-final.md) + cross-links in [weekly-contests-schema-results.md](weekly-contests-schema-results.md); TS [`contest-payout-final.model.ts`](../../src/app/shared/models/contest-payout-final.model.ts) ✅

---

### Story P6-C3 — Schema: extend `ledgerEntries` for prize payouts

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Add validated `lineType` values: e.g. `prize_transfer_out`, `prize_transfer_reversal`, `platform_fee_retained` — per accounting convention in ADR. |

**Description**

- **Direction** semantics consistent with Phase 5 ([weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md)).
- **Idempotency:** Prefer **Stripe object id** (`tr_...`, `po_...`) or **event id** as doc id where one-to-one.

**Acceptance criteria**

- [x] Ledger ADR updated; server validators reject unknown `lineType`.
- [x] Indexes if new query patterns (e.g. by `stripeObjectId`).

**Dependencies**

- Story P6-A1; P5-B2.

**Deliverable**

- Doc + `server/payments/contest-ledger-entry-validate.js` + tests + `firestore.indexes.json` composite on `stripeObjectId` + `createdAt` ✅  
- **Migration:** none — new `lineType` values apply to **new** ledger rows only; existing Phase 5 docs unchanged.

---

## Epic P6-D — Payout computation job (server)

### Story P6-D1 — Pure function: `buildPayoutLinesFromFinal(resultsFinal, dryRun, contest)`

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Extract or mirror dry-run logic into a shared module used by **both** scoring dry-run and payout executor. |

**Description**

- Input: frozen `results/final`, contest `winnerAmountCents` / pool rules, `payouts/dryRun` optional cross-check.
- Output: ordered `{ rank, uid, amountCents }[]` with **integer cents**; throw on invalid contest state.

**Acceptance criteria**

- [x] Unit tests: ties, single winner, zero pool edge cases.
- [x] Golden parity with existing `buildDryRunPayoutLines` behavior unless ADR documents intentional change.

**Dependencies**

- Story P6-A1; existing `contest-scoring-job.js` / `buildDryRunPayoutLines`.

**Deliverable**

- `server/contests/contest-payout-compute.js` + tests; `contest-scoring-job.js` calls `buildPayoutLinesFromFinal` ✅

---

### Story P6-D2 — Job / HTTP: `POST /api/internal/v1/contests/:contestId/payouts/execute` (operator)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Internal secured route: validates contest `paid`, loads `results/final`, builds lines, creates Stripe **Transfers** (or batch), writes `payouts/*` + ledger in **transactions** where possible. |

**Description**

- **Auth:** shared secret pattern like other internal routes (`CONTESTS_OPERATOR_SECRET` or dedicated `PAYOUT_OPERATOR_SECRET`).
- **Stripe:** `stripe.transfers.create({ amount, currency, destination: acct_..., metadata: { contestId, uid, rank } })` — use **idempotency key** `contestId:uid:rank` or similar.
- **Ordering:** Sequential vs limited parallelism; cap API rate to Stripe limits.
- **Partial failure:** One transfer fails → mark row `failed`, continue or abort per ADR.

**Acceptance criteria**

- [x] Structured logs: `contestId`, `uid`, `amountCents`, `outcome`, Stripe ids, `latencyMs`.
- [x] Integration test with Stripe test mode + Connect test account (manual QA runbook in ops doc; automated tests for eligibility helpers + idempotency key).

**Dependencies**

- Stories P6-D1, P6-C2, P6-B2 (recipients exist).

**Deliverable**

- `server/contests/contest-payout-execute.http.js`, `contest-payout-execute.helpers.js`, tests, `index.js`, [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md) ✅

---

### Story P6-D3 — Scheduler / manual trigger for payout execution

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Cloud Scheduler hits internal endpoint with secret **or** Admin UI button calls same handler. |

**Description**

- **Safety:** Feature flag `PAYOUTS_AUTOMATION_ENABLED`; default **manual** in first prod cut.
- **DLQ / retry:** On 5xx, Scheduler retry with backoff; document double-submit safety (idempotency).

**Acceptance criteria**

- [x] Runbook section: how to force-run, how to disable automation ([leaderboards-runbook.md](../leaderboards/leaderboards-runbook.md)-style).

**Dependencies**

- Story P6-D2.

**Deliverable**

- [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md) (Scheduler `gcloud` example, idempotency / 5xx), env **`PAYOUTS_AUTOMATION_ENABLED`**, internal body **`trigger`**, Admin **`POST .../payout-execute`** ✅

---

## Epic P6-E — Stripe money movement & reconciliation

### Story P6-E1 — Platform balance / available funds guard

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Before transfers, optionally verify Stripe **balance** ≥ sum of intended payouts (or document reliance on Stripe errors). |

**Description**

- Read `stripe.balance.retrieve()`; compare to pending batch; **hold** if insufficient with operator alert.

**Acceptance criteria**

- [x] Logged outcome `insufficient_platform_balance` with amounts **aggregated** only (no secrets).

**Dependencies**

- Story P6-D2.

**Deliverable**

- [`server/contests/contest-payout-platform-balance.js`](../../server/contests/contest-payout-platform-balance.js), [`contest-payout-platform-balance.test.js`](../../server/contests/contest-payout-platform-balance.test.js), wired in [`contest-payout-execute.job.js`](../../server/contests/contest-payout-execute.job.js); ops notes in [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md) ✅

---

### Story P6-E2 — Webhooks: `transfer.*` / `payout.*` / failure paths

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Extend webhook router for transfer paid/failed/canceled; update `payouts/*` lines + ledger. |

**Description**

- Mirror Phase 5 patterns: **processedStripeEvents** or reuse idempotency doc per `evt_...`.
- Map Stripe failure codes to **user-visible** safe messages (stored as enum, not raw Stripe strings in client if sensitive).

**Acceptance criteria**

- [x] Duplicate webhook delivery does not duplicate ledger lines.
- [x] Docs list new subscribed events for Stripe Dashboard.

**Dependencies**

- P5 webhook infrastructure; P6-C3.

**Deliverable**

- [`server/payments/stripe-webhook-payouts.js`](../../server/payments/stripe-webhook-payouts.js), [`stripe-webhook-payouts.test.js`](../../server/payments/stripe-webhook-payouts.test.js), [`stripe-webhook.http.js`](../../server/payments/stripe-webhook.http.js) routing, [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) P6-E2 section ✅

---

## Epic P6-F — Refunds, cancellations, and disputes (post-prize)

### Story P6-F1 — Policy + implementation: void contest after prize authorized

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Define **irreversible** states; if contest must cancel after payout started, use **Stripe reversal** + ledger `prize_transfer_reversal` + admin audit. |

**Description**

- Coordinate with existing **paid → cancelled** overrides ([weekly-contests-ops-f2.md](weekly-contests-ops-f2.md) family).
- **Operator-only** tools; never client-callable.

**Acceptance criteria**

- [x] ADR matrix: contest status × payout status × allowed actions.
- [x] At least one automated test for “reversal succeeds” path in test mode.

**Dependencies**

- Stories P6-A1, P6-E2.

**Deliverable**

- [`POST /api/v1/admin/contests/:contestId/void-after-prize`](../../index.js), [`contest-void-after-prize.job.js`](../../server/contests/contest-void-after-prize.job.js), [`contest-void-after-prize.job.test.js`](../../server/contests/contest-void-after-prize.job.test.js), [weekly-contests-ops-p6-f1-void-prize.md](weekly-contests-ops-p6-f1-void-prize.md), ADR matrix in [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md) ✅

---

### Story P6-F2 — Dispute / chargeback playbook (entry fee vs prize)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Document-only story: Stripe dispute objects do not map 1:1 to contest prizes — define **financial** response and **user comms**. |

**Acceptance criteria**

- [x] Runbook: links to Stripe Dashboard sections, internal escalation, ledger annotation convention (`lineType: dispute_adjustment` future).

**Dependencies**

- Phase 5 charge flow knowledge.

**Deliverable**

- [weekly-contests-phase6-disputes-runbook.md](weekly-contests-phase6-disputes-runbook.md) ✅

---

## Epic P6-G — Admin dashboard & support

### Story P6-G1 — Admin read APIs: payout status per contest / per user

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Authenticated **admin** endpoints to read `payouts/*`, user Connect flags, recent ledger lines (aggregated). |

**Description**

- Reuse `requireAdmin` patterns from existing admin routes.
- **PII minimization:** default omit email; show uid + masked Connect id.

**Acceptance criteria**

- [x] E2E: admin can answer “was user X paid for contest Y?” from API response alone.

**Dependencies**

- Stories P6-C2, P6-C3.

**Deliverable**

- [`server/admin/admin-payouts.http.js`](../../server/admin/admin-payouts.http.js), [`server/admin/admin-payouts.http.test.js`](../../server/admin/admin-payouts.http.test.js), routes in [`index.js`](../../index.js), [weekly-contests-api-phase6.md](weekly-contests-api-phase6.md) (P6-G1 section) ✅

---

### Story P6-G2 — Admin actions: hold / resume / retry failed line

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Mutations with **force** + audit log (who/when/why). |

**Description**

- Writes `payoutHoldReason`, `heldByAdminUid`, `heldAt`; resume clears hold and optionally enqueues job.
- **Retry:** only for rows in `failed` with idempotent Stripe retry.

**Acceptance criteria**

- [x] Every mutation appends **ledger** `admin_adjustment` or dedicated **audit** collection (pick one in ADR).

**Dependencies**

- Story P6-D2.

**Deliverable**

- [`server/contests/contest-payout-admin-actions.job.js`](../../server/contests/contest-payout-admin-actions.job.js), [`contest-payout-admin-actions.job.test.js`](../../server/contests/contest-payout-admin-actions.job.test.js), [`server/admin/admin-payouts.http.js`](../../server/admin/admin-payouts.http.js) (POST handlers), [`contest-payout-execute.job.js`](../../server/contests/contest-payout-execute.job.js) (`prizePayoutStatus` + hold gate), routes in [`index.js`](../../index.js), [weekly-contests-api-phase6.md](weekly-contests-api-phase6.md) (P6-G2) ✅ — Angular UI stubs optional / not in this PR

---

## Epic P6-H — Security, compliance, and observability

### Story P6-H1 — Firestore rules + indexes for all new payout paths

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Deny all client writes; tighten reads; add composite indexes for operator queries. |

**Acceptance criteria**

- [ ] `npm run test:firestore-rules` green with new match blocks.
- [ ] No client read of full bank/Connect payload.

**Dependencies**

- Stories P6-C1, P6-C2.

**Deliverable**

- `firestore.rules`, `firestore.indexes.json`, rules test fixtures

---

### Story P6-H2 — Metrics & alerts for payout job + webhooks

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Extend Phase 5-style JSON logs / optional counters: `payout_job`, `stripe_webhook_payout`, failure rates. |

**Acceptance criteria**

- [ ] Log-based alert examples in doc (p95 latency, error rate, stuck `in_progress`).

**Dependencies**

- Story P6-D2, P6-E2.

**Deliverable**

- `docs/weekly-contests/weekly-contests-phase6-observability.md`, small server helpers

---

## Epic P6-I — QA, staging, and launch gates

### Story P6-I1 — Staging QA checklist (Connect + transfer E2E)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | `docs/weekly-contests/weekly-contests-phase6-staging-qa.md` mirroring Phase 5 checklist style. |

**Acceptance criteria**

- [ ] Includes: create Connect test account, run scoring, execute payout, verify balance on connected account, refund/reversal drill.
- [ ] Sign-off table for product + eng + finance (optional rows).

**Dependencies**

- Most of P6 implemented in staging.

**Deliverable**

- Staging QA doc

---

### Story P6-I2 — Load / cost estimate: payout job Firestore + Stripe calls

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Document worst-case reads/writes per contest size; define batch sizes. |

**Acceptance criteria**

- [ ] Table: N entrants → M transfers → API calls; Stripe rate limit mitigation.

**Dependencies**

- Story P6-D2.

**Deliverable**

- Section in ADR or ops doc

---

## Dependency graph (high level)

```text
P6-A1 (ADR) ─┬─► P6-B1 ─► P6-B2 ─► P6-B3
             ├─► P6-C1 / P6-C2 / P6-C3
             ├─► P6-A2 (UX)
             └─► P6-D1 ─► P6-D2 ─► P6-D3 / P6-E1 / P6-E2
P6-D2 ─► P6-F1 / P6-G2
P6-*   ─► P6-H1 / P6-H2 / P6-I*
```

---

## References

- [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md) — Story P6-A1 (decisions)
- [weekly-contests-phase6-payouts-ux.md](weekly-contests-phase6-payouts-ux.md) — Story P6-A2 (copy & UX)
- [product-roadmap-contests-and-payments.md](../product/product-roadmap-contests-and-payments.md) — Phase 6 bullets
- [weekly-contests-schema-results.md](weekly-contests-schema-results.md) — `results/final`, `payouts/dryRun`
- [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) — Phase 5 patterns  
- [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md) — append-only ledger  
- [stripe.md](../payments/stripe.md) — keys, env vars, **Connect appendix** (P6-B1)  
