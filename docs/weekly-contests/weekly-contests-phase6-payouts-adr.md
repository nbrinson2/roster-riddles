# ADR: Phase 6 — Payouts (prize money): who gets paid, when, how much

| Field | Value |
|-------|-------|
| **Status** | Proposed (engineering + **product / legal / finance** sign-off required before **live** winner payouts) |
| **Date** | 2026-04-27 |
| **Scope** | **Real-money prizes** for weekly contests after **`results/final`** and **`payouts/dryRun`** exist; **Stripe Connect** (or equivalent) for recipients; **transfers** from platform balance to connected accounts — **v1 USD integer cents**. **Does not** implement code in this ADR — only decisions for P6-B onward. |
| **Depends on** | [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md), [weekly-contests-schema-results.md](weekly-contests-schema-results.md) (`results/final`, `payouts/dryRun`), [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md), [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md), [stripe.md](../payments/stripe.md) |
| **Implements (backlog)** | [weekly-contests-phase6-payouts-jira.md](weekly-contests-phase6-payouts-jira.md) Stories **P6-A1**, **P6-A2**, **P6-B1**, **P6-C2** (schema), **P6-C3** (ledger line types + validation), **P6-D1** (payout line pure function), **P6-D2** (HTTP payout execute), **P6-D3** (automation flag + Scheduler + admin trigger), **P6-E1** (platform balance guard), **P6-E2** (transfer/payout webhooks), **P6-F1** (void after prize), **P6-F2** ([disputes runbook](weekly-contests-phase6-disputes-runbook.md)), **P6-G1** ([admin payout read APIs](../../server/admin/admin-payouts.http.js)), **P6-G2** ([admin payout hold / resume / retry](../../server/contests/contest-payout-admin-actions.job.js)), **P6-H1** ([Firestore rules + indexes](../../firestore.rules)), **P6-H2** ([payout observability](weekly-contests-phase6-observability.md) + [`contest-payouts-observability.js`](../../server/payments/contest-payouts-observability.js)), **P6-I1** ([staging QA — Connect + transfer E2E](weekly-contests-phase6-staging-qa.md)), **P6-I2** ([load / cost — payout execute](weekly-contests-ops-p6-payout-execute.md#load-and-cost-story-p6-i2)) |

---

## Context

- **Phase 4** writes immutable **`contests/{contestId}/results/final`** (standings + tie metadata) and **`contests/{contestId}/payouts/dryRun`** in the **same** scoring transaction as the contest transitions **`scoring` → `paid`** (`server/contests/contest-scoring-job.js`). Dry-run lines are **numbers only**: `{ rank, uid, amountCents }` with `notRealMoney: true` ([weekly-contests-schema-results.md](weekly-contests-schema-results.md)).
- **Phase 5** collects **entry fees** and maintains **`ledgerEntries`** for charges/refunds; **no** outbound prize transfers.
- **Phase 6** must answer: **which `uid`s receive how many cents**, **when** automation may move money, and how that maps to **Stripe**, **Firestore**, and **new ledger line types** — without contradicting immutable scoring artifacts unless an explicit **operator override** story (P6-F1) applies.

---

## Phase 0 — Legal / product gate (blocking live payouts)

Paid **prizes** (not just entry fees) typically implicate **sweepstakes / gambling / skill contest** rules, **tax reporting**, **eligibility** (age, region), and **disclosure** requirements.

| Gate | Owner | Record |
|------|--------|--------|
| **Regions + rules copy** | Product + Legal | ToS, contest rules, refund / void policy — extend Phase 0 checklist in [product-roadmap-contests-and-payments.md](../product/product-roadmap-contests-and-payments.md) §Phase 0 before enabling live prize rails. |
| **Winner KYC / tax** | Finance + Legal | Thresholds for **1099** / **W-9** / Stripe **1099-K** posture — **implementation deferred** below; **v1 policy** (ops + support scripts): **[weekly-contests-tax-winner-reporting-posture.md](weekly-contests-tax-winner-reporting-posture.md)** (Story **GL-A2**). **Policy must be acknowledged** before live. |

**Engineering does not substitute** for the above sign-off.

**Record:** Complete **[weekly-contests-phase0-production-sign-off.md](weekly-contests-phase0-production-sign-off.md)** (Story **GL-A1**) before enabling live prize payouts.

---

## Decision summary

| Topic | Decision |
|--------|-----------|
| **Currency (v1)** | **USD only**; all prize amounts are **non-negative integer cents**, consistent with Phase 5 ([weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md)). |
| **Source of truth for *who* and *how much*** | **`contests/{contestId}/payouts/dryRun.lines`** is the **authoritative intended distribution** for automation **v1**, because it is written **atomically** with **`results/final`** in the scoring transaction. **Recomputation** from `results/final` + contest business rules is a **parity check** only: on mismatch, **do not** auto-pay; **fail closed**, log, and require **operator review** (future P6-G2 / admin story). |
| **Who is a payee?** | Every **`dryRun.lines[]`** row with **`amountCents > 0`** is an intended **prize recipient** for that contest. Rows with **`amountCents === 0`** are **non-recipients** (still ranked in `results/final`). **v1 code path** (`buildDryRunPayoutLines` today): only **`rank === 1`** may have a non-zero amount; others are `0` — see [Non-goals / future](#non-goals--future-prize-rules). |
| **Recipient eligibility (beyond dry-run)** | **Firebase `uid`** on the line must exist as **`contests/{contestId}/entries/{uid}`** with **`paymentStatus`** in **`paid` \| `free`** (Phase 5 semantics). If missing or **`failed` / `refunded`** (or other disallowed states), **exclude** that line from automated transfer and surface **operator queue** (implementation). **Product** may additionally require **`emailVerified`** for prizes — align with [leaderboards-duplicate-accounts-f2.md](../leaderboards/leaderboards-duplicate-accounts-f2.md) if enforced. |
| **Minimum entrants / void prizes** | **Product decision** — not encoded in this ADR. Default engineering posture: **no transfer** if contest is **`cancelled`** or if product-defined **minimum entrants** not met; operator may still run **manual** settlement outside automation (documented in ops story). |
| **When may automation run?** | **`contests/{contestId}.status === 'paid'`** and documents **`results/final`** + **`payouts/dryRun`** exist. **Additionally** **`prizePayoutStatus`** (below) must allow transition from **`scheduled` → `in_progress`**. **No** prize transfers while **`open`**, **`scoring`**, or **`cancelled`** (unless a dedicated **recovery** story explicitly allows). |
| **Stripe fees on outbound prize** | **v1:** Platform **absorbs** Stripe **Connect transfer** fees (winner receives **full** `amountCents` from dry-run line). Product may later choose **gross-up** or **net-of-fee**; that would be an ADR amendment + ledger line `platform_subsidy_prize_fee` or similar. |
| **Stripe surface (v1)** | **Connect** connected account per recipient + **`stripe.transfers.create`** from platform to **`destination`** account (details in P6-B / P6-D stories). **Payouts** to bank without Connect are **out of scope v1** unless ADR is revised. |
| **Idempotency** | One successful **outbound movement** per **(contestId, uid, rank)** logical key unless **reversal**; use **Stripe idempotency keys** on create + **`ledgerEntries`** doc id strategy aligned with Phase 5 ([weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md)). |
| **Authoritative settlement state** | Same discipline as Phase 5: **verified Stripe webhooks** (and internal job logs) update **`prizePayoutStatus`**, **`payouts/final`** (and optional **`payouts/run_*`** — [weekly-contests-schema-contest-payouts-final.md](weekly-contests-schema-contest-payouts-final.md)), and **ledger** — not client callbacks. |

### Contest × payout artifact matrix (Story P6-F1)

| **`contests.status`** | **`payouts/final`** | **`notRealMoney`** on `final` | Allowed operator action (v1) |
|----------------------|---------------------|-------------------------------|--------------------------------|
| **`paid`** | Absent | — | F2 **`paid`→`cancelled`** (or **`scoring`**) with **`force: true`** — deletes `results/final` + `payouts/dryRun` only; **no** Stripe prize reversal. |
| **`paid`** | Present | **`true`** | Same as row above (staging / dry); **do not** use Admin void-after-prize (API returns **`payout_not_real_money`**). |
| **`paid`** | Present | absent / **`false`** | If **`lines`** contain **`succeeded`** rows with **`tr_…`**: Admin **[void-after-prize](weekly-contests-ops-p6-f1-void-prize.md)** (Stripe **`transfers.createReversal`**, **`prize_transfer_reversal`** ledger, audit, then **`paid`→`cancelled`** + artifact deletes). If **no** succeeded `tr_` rows: F2 void only (no-op Stripe). |
| **`cancelled`** | Any | Any | **Terminal** — no transitions out; reconcile only via support / new ADR if product ever allows reopen. |

---

## Stripe Connect account model (Story P6-B1)

### Decision: **Express** connected accounts (v1)

| Choice | Decision |
|--------|----------|
| **Account type** | **Express** (`type: express` in Stripe API) for **individual** prize recipients in **v1**. |
| **Rationale** | Stripe-hosted **onboarding** and **identity verification** reduce bespoke PCI/KYC UI; platform retains useful **dashboard** and **transfer** controls vs **Standard** (full Stripe Dashboard for user). **Custom** accounts are **rejected for v1** — highest build and compliance load. |
| **Legal / product** | **Confirm before live prizes:** Express terms, branding, and **loss liability** vs Standard — engineering assumes **Legal + Product** sign off in Phase 0 gate ([Phase 0 — Legal / product gate](#phase-0--legal--product-gate-blocking-live-payouts)). |

### Comparison (engineering reference)

| Model | Who builds onboarding UI | User sees Stripe Dashboard? | Platform control | Typical use |
|-------|---------------------------|----------------------------|------------------|-------------|
| **Standard** | Minimal (Stripe-hosted account creation) | **Yes** — full Dashboard for connected user | Lower | SaaS where users are “merchants” |
| **Express** | **Stripe-hosted** Account Links / onboarding | **Lite** Express Dashboard (Stripe-managed) | **Medium** — platform creates accounts, **Transfers** to `acct_` | Marketplaces, creator payouts, **contest prizes** |
| **Custom** | **Platform-owned** KYC UI + API compliance | Custom / none | **Highest** | Large marketplaces with dedicated risk teams |

**v1 posture:** Prefer **Express**. Revisit **Standard** only if product insists winners manage money entirely in Stripe’s Dashboard; revisit **Custom** only with a dedicated compliance + frontend program.

### Mapping: Firebase `uid` → Stripe Connect account

| Topic | Decision |
|--------|----------|
| **Canonical id** | Store **`stripeConnectAccountId`** = Stripe **`acct_…`** string on **`users/{uid}`** as **top-level fields** (v1 — **exact field list:** [weekly-contests-schema-users-payouts.md](weekly-contests-schema-users-payouts.md), TS: `user-payout-profile.model.ts`). **Server / Admin SDK writes only** — same discipline as contest entry payment fields. |
| **Uniqueness** | **One** Connect account per **`uid`** for prize purposes in v1; **do not** create a second `acct_` for the same uid without an explicit **migration / support** story. |
| **Metadata** | When creating the account, set Stripe **`metadata.firebase_uid`** = Firebase uid for webhook routing and support correlation (no secrets). |

### State refresh: when is Connect state updated?

| Source | Role |
|--------|------|
| **Webhooks** (`account.updated`, and related Connect events as listed in P6-B3) | **Primary** — update denormalized flags on `users/{uid}` (`chargesEnabled`, `payoutsEnabled`, `detailsSubmitted`, compact **`requirements`** summary). |
| **On-demand** (e.g. `GET` self payout status after user returns from Account Link) | **Secondary** — optional **`accounts.retrieve`** to close race if webhook is delayed; **must** rate-limit per uid. |
| **Periodic batch job** | **Not required v1** — add only if webhook delivery is unreliable in production metrics. |

### Risks & mitigations

| Risk | Mitigation |
|------|------------|
| **Account takeover** (attacker links **their** Connect account to victim uid) | All Connect writes **server-side** after **Firebase ID token** verification; **never** trust client-supplied `acct_`. On `accounts.create`, bind **only** to authenticated uid. |
| **Duplicate identities / multi-account abuse** | If prizes require verified humans, align with [leaderboards-duplicate-accounts-f2.md](../leaderboards/leaderboards-duplicate-accounts-f2.md) (email verification, support policy). **Product** enables enforcement; engineering surfaces **`emailVerified`** gate in P6-B2/P6-D2 if chosen. |
| **Express branding** | Users see **Stripe**-hosted flows; copy in [weekly-contests-phase6-payouts-ux.md](weekly-contests-phase6-payouts-ux.md) sets expectations. |

---

## Contest-level prize payout status (`prizePayoutStatus`)

New **optional** field on **`contests/{contestId}`** (written only by **Admin SDK** / server jobs once implementation lands). Until first write, treat as **`none`**.

| Value | Meaning |
|-------|---------|
| **`none`** | No prize automation configured **or** not yet evaluated (legacy contests). |
| **`scheduled`** | Contest is **`paid`**; dry-run + final exist; automation **may** run when other preconditions pass (Connect ready, flags on). |
| **`in_progress`** | At least one outbound transfer **attempt** in flight for this contest. |
| **`completed`** | All intended lines with **`amountCents > 0`** reached a **terminal success** state (per execution doc). |
| **`failed`** | Terminal failure (e.g. unrecoverable Stripe error after retries) — requires operator path. |
| **`held`** | **Manual pause** — no new transfers until **`scheduled`** or **`in_progress`** resume (operator story). |

### Allowed transitions (engineering default)

```text
none ─────────────► scheduled     (when contest becomes paid + artifacts exist + product enables)
scheduled ────────► held          (operator)
held ─────────────► scheduled     (operator)
scheduled ────────► in_progress   (job start)
in_progress ──────► completed     (all lines settled ok)
in_progress ──────► failed        (unrecoverable / policy abort)
failed ───────────► scheduled     (operator retry after fix) — only via explicit tool, not implicit
completed ────────► (terminal)
```

**Contest `status`** remains the lifecycle from Phase 4 (`scheduled` … `cancelled`); **`prizePayoutStatus` is orthogonal** — e.g. contest can be **`paid`** while prizes are **`held`**.

**P6-G2 audit trail (engineering choice):** each admin **hold**, **resume**, or **retry-failed** mutation appends one **`ledgerEntries`** document with **`lineType: other`**, **`amountCents: 0`**, **`direction: credit`**, **`source: admin_adjustment`**, and **`metadata.action`** (`payout_hold` \| `payout_resume` \| `payout_retry_failed`) plus operator **`uid`** (authenticated admin). A dedicated Firestore audit collection is **not** used in v1.

---

## Rounding, ties, and `prizePoolCents`

| Topic | Decision |
|--------|-----------|
| **Rounding** | **Integer cents only**; no fractional cents in Firestore or Stripe amounts. |
| **Ties for prize places** | **v1:** Dry-run builder awards **first place only** (see `buildDryRunPayoutLines` in `server/contests/contest-scoring-core.js`). **Split pot** / **multi-place** payouts require a **product spec + ADR revision** + scoring/dry-run changes. |
| **`prizePoolCents` on contest** | **Display / cap hint** for product and integrity checks: sum of **`dryRun.lines[].amountCents`** should be **≤ `prizePoolCents`** when the latter is set (if violated, **fail closed** — operator review). **Not** the primary line source unless ADR is later amended to prefer recomputation from pool rules. |

---

## Void / cancel / correction

| Scenario | Decision |
|----------|----------|
| **Contest `cancelled`** before **`completed`** | **No new** prize transfers; existing transfers follow **Stripe reversal** policy (P6-F1). Ledger records **reversals** — never delete prior lines. |
| **Wrong amount paid** | **No silent overwrite** of `payouts/dryRun`; corrections via **operator-led** Stripe actions + **new ledger lines** + execution doc annotations. |
| **Entry invalidated after scoring** | Rare; default **do not** claw back via automation without legal approval. If product requires clawback, **separate ADR + refund/reversal** story. |

---

## Event → Stripe API → Firestore → `ledgerEntries.lineType` (v1 target)

Stripe object ids and event types are **illustrative** — exact names must match the Stripe API version the server pins.

| Trigger | Stripe API (or surface) | Firestore writes (trusted) | `ledgerEntries.lineType` (proposed) |
|---------|-------------------------|----------------------------|-------------------------------------|
| Operator / job: start Connect onboarding | `accounts.create`, `accountLinks.create` | `users/{uid}` payout profile fields | — (no money movement) |
| Stripe: Connect account state | *(webhook)* `account.updated` | `users/{uid}`: `chargesEnabled`, `payoutsEnabled`, requirements summary | — |
| Operator / job: execute prize transfer | `transfers.create` | `contests/{id}/payouts/final` (or optional `payouts/run_*` attempts — P6-C2) line: `stripeTransferId`, `status` | **`prize_transfer_out`**, `direction: debit` — see [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md) **Direction by `lineType`** (P6-C3) |
| Stripe: transfer succeeded | *(webhook)* `transfer.created` / `transfer.updated` (paid) | Update execution line **`succeeded`** | Optional duplicate-safe line or metadata-only update per idempotency design |
| Stripe: transfer failed / reversed | *(webhook)* `transfer.reversed`, failed/canceled events | Execution line **`failed` / `reversed`** | **`prize_transfer_reversal`**, `direction: credit` |
| Operator: platform fee subsidy (if ever net-of-fee) | *(optional)* balance transaction | Ledger only | **`platform_fee_retained`**, `direction: credit` (when used) |
| Stripe: dispute on underlying charge | `charge.dispute.*` | **No automatic** prize correction | **`dispute_adjustment`** (future — [P6-F2 runbook](weekly-contests-phase6-disputes-runbook.md)) |

**Convention (P6-C3):** Prize **outbound** transfers use **`prize_transfer_out` + `debit`**; reversals use **`prize_transfer_reversal` + `credit`**. Glossary and server enforcement: [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md).

---

## Non-goals (Phase 6 v1)

| Topic | Stance |
|--------|--------|
| **Multi-currency**, FX, crypto | **Out of scope** |
| **Automatic tax withholding / 1099 filing** | **Out of scope** — requires finance tooling; **ops + support posture (v1):** [weekly-contests-tax-winner-reporting-posture.md](weekly-contests-tax-winner-reporting-posture.md) (Story **GL-A2**) |
| **Split pots**, **multi-rank** prize tables | **Out of scope** until dry-run builder + ADR updated |
| **Client-initiated transfers** | **Forbidden** — server / operator only |
| **Storing bank / tax IDs in Firestore** | **Forbidden** — Stripe holds sensitive KYC data |

---

## Non-goals / future (prize rules)

| Topic | Stance |
|--------|--------|
| **`winnerAmountCents` on contest** | Today scoring uses **default** `DRY_RUN_WINNER_AMOUNT_CENTS` unless overridden in code. **Future:** persist per-contest winner amount at create/admin time and pass into `buildDryRunPayoutLines` — then **`dryRun` still wins** as snapshot if written with that value. |

---

## Review sign-off (fill before live prize payouts)

| Role | Name | Date | Notes |
|------|------|------|-------|
| Product | | | |
| Engineering | | | |
| Legal | | | |
| Finance / Tax | | | |

---

## References

- [stripe.md](../payments/stripe.md) — **Stripe Connect appendix** (ops + env notes)  
- [weekly-contests-phase6-payouts-ux.md](weekly-contests-phase6-payouts-ux.md) — **Product copy & UX** (winner onboarding, banners, support scripts)  
- [product-roadmap-contests-and-payments.md](../product/product-roadmap-contests-and-payments.md) — Phase 6 overview  
- [weekly-contests-phase6-payouts-jira.md](weekly-contests-phase6-payouts-jira.md) — implementation backlog  
- [weekly-contests-schema-results.md](weekly-contests-schema-results.md) — `results/final`, `payouts/dryRun`
- [weekly-contests-schema-contest-payouts-final.md](weekly-contests-schema-contest-payouts-final.md) — `payouts/final`, optional `payouts/run_*` (P6-C2)  
- [weekly-contests-schema-contests.md](weekly-contests-schema-contests.md) — contest `status`  
- [weekly-contests-schema-entries.md](weekly-contests-schema-entries.md) — `paymentStatus`  
