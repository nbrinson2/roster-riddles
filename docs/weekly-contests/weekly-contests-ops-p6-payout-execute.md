# Operations — `POST /api/internal/v1/contests/:contestId/payouts/execute` (Phase 6 Story P6-D2)

**Purpose:** After a contest is **`paid`** with **`results/final`** and **`payouts/dryRun`**, an operator (or **Cloud Scheduler** with automation enabled) calls this hook to create **Stripe Transfers** to winners’ **Connect** accounts, then writes **`payouts/final`** and append-only **`ledgerEntries`** (`prize_transfer_out`).

**Implementation:** [`server/contests/contest-payout-execute.http.js`](../../server/contests/contest-payout-execute.http.js), job [`contest-payout-execute.job.js`](../../server/contests/contest-payout-execute.job.js), helpers [`contest-payout-execute.helpers.js`](../../server/contests/contest-payout-execute.helpers.js). **Scheduler + kill switch:** [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md) (Story P6-D3).

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **`CONTESTS_PAYMENTS_ENABLED=true`** | Same gate as Checkout / webhooks. |
| **`STRIPE_SECRET_KEY`** | Platform key with **Connect** + **Transfers**. |
| **Secret** | `PAYOUT_OPERATOR_SECRET` **or** `CONTESTS_OPERATOR_SECRET` (file path or inline; see [`contest-internal-auth.js`](../../server/lib/contest-internal-auth.js) `getPayoutExecuteSecret`). |
| **Contest `status`** | Must be **`paid`**. |
| **Artifacts** | `results/final` and **`payouts/dryRun`** must exist (dry-run is authoritative per ADR). |
| **Recipients** | `users/{uid}` must be **Connect-ready** (`stripeConnectAccountId`, `charges`/`payouts`/`detailsSubmitted` flags from P6-B3 webhook). |
| **Entries** | `entries/{uid}` must be **`paymentStatus: paid`** or **`free`** for automated transfer of a money line. |

---

## Request

```http
POST /api/internal/v1/contests/{contestId}/payouts/execute
Authorization: Bearer <PAYOUT_OPERATOR_SECRET or CONTESTS_OPERATOR_SECRET>
Content-Type: application/json
```

Optional body (strict JSON):

```json
{ "payoutJobId": "opaque_optional_id", "trigger": "operator" }
```

- **`payoutJobId`** — optional trace id; server generates one if omitted.
- **`trigger`** — omit or **`operator`** (default) for manual operator runs. **`scheduler`** requires **`PAYOUTS_AUTOMATION_ENABLED=true`** on the server, otherwise **403** `payouts_automation_disabled` (Cloud Scheduler should send this only when automation is intentionally on).

Admin manual run (no operator secret): **`POST /api/v1/admin/contests/:contestId/payout-execute`** with Firebase **`admin: true`** — see [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md).

---

## Behavior summary

1. Builds payout lines with **`buildPayoutLinesFromFinal`** (P6-D1) — must match **`payouts/dryRun`** when present.
2. **Idempotency:** If **`payouts/final`** exists with **`aggregateStatus: succeeded`**, returns **200** `{ outcome: "payout_final_already_succeeded" }` and **does not** call Stripe again. If `final` exists in **`partial_failure`** / **`failed`**, returns **409** — operator must fix data / Stripe state before a future retry story.
3. For each line with **`amountCents > 0`**: skips ineligible entry or Connect-not-ready user; otherwise **`stripe.transfers.create`** with **idempotency key** `rr_payout_{contestId}_{uid}_{rank}` (sanitized, max 255 chars).
4. **Partial failure:** one transfer can **fail** while others **succeed**; **`aggregateStatus`** becomes **`partial_failure`**.
5. **Firestore batch:** writes **`payouts/final`** and one **`ledgerEntries/{tr_...}`** per successful transfer (`prize_transfer_out`, `direction: debit`).

---

## Logs

Structured JSON lines: `component: contest_payout_execute`, `requestId`, `contestId`, optional `uid`, `rank`, `amountCents`, `outcome` (e.g. `transfer_succeeded`, `transfer_failed`, `payout_execute_committed`), `latencyMs`, optional `stripeTransferId` / `stripeErrorCode`.

---

## Integration test (manual — Stripe test mode)

1. Create a **test** Connect account, complete onboarding, ensure **`account.updated`** populated **`users/{uid}`** flags (P6-B3).
2. Run a **paid** contest through scoring so **`payouts/dryRun`** exists with a **non-zero** first-place line for that uid.
3. `curl` the execute endpoint with operator secret.
4. Verify Stripe **Dashboard → Transfers**, Firestore **`payouts/final`**, and **`ledgerEntries/tr_...`**.

Automated tests cover **eligibility helpers** and **idempotency key** only (`contest-payout-execute.helpers.test.js`).

---

## References

- [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md)  
- [weekly-contests-schema-contest-payouts-final.md](weekly-contests-schema-contest-payouts-final.md)  
- [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md) (P6-C3 `prize_transfer_out`)
