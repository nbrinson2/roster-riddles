# Operations — `POST /api/internal/v1/contests/:contestId/payouts/execute` (Phase 6 Story P6-D2)

**Purpose:** After a contest is **`paid`** with **`results/final`** and **`payouts/dryRun`**, an operator (or **Cloud Scheduler** with automation enabled) calls this hook to create **Stripe Transfers** to winners’ **Connect** accounts, then writes **`payouts/final`** and append-only **`ledgerEntries`** (`prize_transfer_out`).

**Implementation:** [`server/contests/contest-payout-execute.http.js`](../../server/contests/contest-payout-execute.http.js), job [`contest-payout-execute.job.js`](../../server/contests/contest-payout-execute.job.js), helpers [`contest-payout-execute.helpers.js`](../../server/contests/contest-payout-execute.helpers.js), platform balance [`contest-payout-platform-balance.js`](../../server/contests/contest-payout-platform-balance.js) (Story P6-E1). **Scheduler + kill switch:** [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md) (Story P6-D3).

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

**Scheduler batch (dynamic contests):** **`POST /api/internal/v1/contests/payout-automation/run`** — scans recent **`paid`** contests and runs this job for each candidate; see [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md) § **3a**.

---

## Behavior summary

1. **Optional balance guard (P6-E1):** When **`CONTEST_PAYOUT_BALANCE_GUARD_ENABLED=true`**, after resolving entry + user docs the job calls **`stripe.balance.retrieve()`**, sums **`available`** rows with **`currency: usd`**, and **blocks** (HTTP **409** `insufficient_platform_balance`) if that total is **strictly less** than the sum of **planned** prize transfers (only lines with **`amountCents > 0`** that pass entry eligibility and Connect readiness — same gates as actual `transfers.create`). Structured log: **`outcome: insufficient_platform_balance`**, **`availableUsdCents`**, **`requiredUsdCents`**, **`plannedMoneyLineCount`** (aggregates only). If Balance cannot be read, **503** `stripe_balance_unavailable`. There is still a small **race** between check and transfers; Stripe remains authoritative if a transfer fails for funds.
2. Builds payout lines with **`buildPayoutLinesFromFinal`** (P6-D1) — must match **`payouts/dryRun`** when present.
3. **Idempotency:** If **`payouts/final`** exists with **`aggregateStatus: succeeded`**, returns **200** `{ outcome: "payout_final_already_succeeded" }` and **does not** call Stripe again. If `final` exists in **`partial_failure`** / **`failed`**, returns **409** — operator must fix data / Stripe state before a future retry story.
4. For each line with **`amountCents > 0`**: skips ineligible entry or Connect-not-ready user; otherwise **`stripe.transfers.create`** with **idempotency key** `rr_payout_{contestId}_{uid}_{rank}` (sanitized, max 255 chars).
5. **Partial failure:** one transfer can **fail** while others **succeed**; **`aggregateStatus`** becomes **`partial_failure`**.
6. **Firestore batch:** writes **`payouts/final`** and one **`ledgerEntries/{tr_...}`** per successful transfer (`prize_transfer_out`, `direction: debit`).

---

## Logs

Structured JSON lines: **`domain: contest_payouts`**, **`component: payout_job`**, `requestId`, `contestId`, optional `uid`, `rank`, `amountCents`, `outcome` (e.g. `transfer_succeeded`, `transfer_failed`, `payout_execute_committed`, **`insufficient_platform_balance`** (with **`availableUsdCents`**, **`requiredUsdCents`**, **`plannedMoneyLineCount`** only)), `latencyMs`, optional `stripeTransferId` / `stripeErrorCode`. See [weekly-contests-phase6-observability.md](weekly-contests-phase6-observability.md).

---

## Integration test (manual — Stripe test mode)

1. Create a **test** Connect account, complete onboarding, ensure **`account.updated`** populated **`users/{uid}`** flags (P6-B3).
2. Run a **paid** contest through scoring so **`payouts/dryRun`** exists with a **non-zero** first-place line for that uid.
3. `curl` the execute endpoint with operator secret.
4. Verify Stripe **Dashboard → Transfers**, Firestore **`payouts/final`**, and **`ledgerEntries/tr_...`**.

Automated tests cover **eligibility helpers** and **idempotency key** only (`contest-payout-execute.helpers.test.js`).

---

## Load and cost (Story P6-I2)

**Implementation reference:** [`server/contests/contest-payout-execute.job.js`](../../server/contests/contest-payout-execute.job.js) (`runContestPayoutExecuteJob`).

Symbols (one successful run, no early exit):

| Symbol | Meaning |
|--------|---------|
| **P** | Payout execution row count — length of **`baseLines`** after `buildPayoutLinesFromFinal` (typically one row per ranked entrant in **`results/final.standings`** that survives validation). |
| **E** | Rows with **`amountCents > 0`** (intended money lines). |
| **K** | **`stripe.transfers.create`** calls actually attempted (**≤ E**); skipped rows (zero cents, ineligible entry, Connect not ready) perform **no** Stripe transfer. |
| **S** | Transfers that **succeed** (**S ≤ K**); each gets one **`ledgerEntries/{tr_…}`** `set` in the commit batch. |

### Firestore reads

| Phase | Count | Notes |
|--------|------:|--------|
| Initial load | **4** | Parallel **`get`**: `contests/{id}`, `results/final`, `payouts/dryRun`, `payouts/final`. |
| Entry + user | **2P** | Two parallel fan-outs: **`contests/{id}/entries/{uid}`** and **`users/{uid}`** for each payout line (**P** reads each). |
| **Total reads** | **4 + 2P** | Worst case before any Stripe work. |

### Firestore writes (success path)

Single **`batch.commit()`**: **`set`** `payouts/final`, **`set`** `ledgerEntries/{tr_id}` for each succeeded line, **`update`** `contests/{id}` (`prizePayoutStatus`, `updatedAt`).

| Metric | Count |
|--------|------:|
| Document writes in batch | **2 + S** (one final doc + **S** ledger docs + one contest patch) |
| Firestore **operation** budget | Must stay **≤ 500** per batch ([limit](https://firebase.google.com/docs/firestore/manage-data/transactions#batched-writes)); today **2 + S ≤ 2 + K**. If product ever allows **many** simultaneous prize lines, **S > ~498** requires splitting into multiple batches (not implemented in v1 — cap **P** / prize rows in product, or extend the job). |

### Stripe API calls

| Call | Count | When |
|------|------:|------|
| **`balance.retrieve`** | **0 or 1** | **1** only if **`CONTEST_PAYOUT_BALANCE_GUARD_ENABLED=true`** and planned prize total **> 0** cents. |
| **`transfers.create`** | **K** | **Sequential** `await` in a loop — one HTTP round-trip per attempted line (success or Stripe error still one call). |

### Table — N-style sizing (v1 mental model)

Treat **N ≈ P** when every standing row becomes a payout line (typical). **M = K** = transfer attempts; **S** = successes.

| Entrants **N** (≈ **P**) | Max transfer attempts **K** (≤ money lines **E**) | Stripe `transfers.create` | Stripe `balance.retrieve` (guard on) | Firestore reads | Firestore writes (batch) |
|-------------------------|-----------------------------------------------------|---------------------------|----------------------------------------|------------------|---------------------------|
| 50 | ≤ 50 (often **1** in v1 winner-only pools) | **K** | 0–1 | **4 + 2N** | **2 + S** |
| 500 | ≤ 500 | **K** | 0–1 | **4 + 2N** | **2 + S** |
| 2000 | ≤ 2000 | **K** | 0–1 | **4 + 2N** | **2 + S** (watch **2+S ≤ 500**) |

**Wall clock:** dominated by **K** sequential Stripe calls (tens–hundreds of ms each plus network). Example: **K = 20** and ~150 ms per call ⇒ **~3 s** transfer phase alone; set Scheduler **attempt-deadline** and client timeouts accordingly ([weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md)).

### Stripe rate limits — mitigation

- **v1 behavior is already sequential** — no burst of parallel `transfers.create` from this job; easiest way to respect Stripe velocity limits for Transfers.
- **Idempotency keys** (`rr_payout_{contestId}_{uid}_{rank}` pattern in [`contest-payout-execute.helpers.js`](../../server/contests/contest-payout-execute.helpers.js)) make safe retries after **5xx** or **`payout_persist_failed`** without double-charging the same logical line.
- On **429** or **rate_limit** errors: **retry with exponential backoff and jitter** at the caller (Scheduler, operator script, or a future job wrapper); parse **`Retry-After`** when Stripe sends it ([Stripe errors](https://docs.stripe.com/api/errors)).
- **Capacity planning:** use Dashboard **Developers →** request metrics in **test** before live; if multiple contests run payouts in parallel, aggregate **K** across jobs — Stripe limits are **per account**, not per contest.

---

## References

- [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md)  
- [weekly-contests-schema-contest-payouts-final.md](weekly-contests-schema-contest-payouts-final.md)  
- [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md) (P6-C3 `prize_transfer_out`)
