# Weekly contests — void contest after real prize payouts (Phase 6 Story P6-F1)

**Status:** Implemented  
**Depends on:** [weekly-contests-ops-f2.md](weekly-contests-ops-f2.md) (F2 `paid`→`cancelled` / `scoring` with `force`), [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md) (prize execute), [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) (P6-E2 transfer lifecycle)

## When to use

| Situation | Tool |
|-----------|------|
| Contest **`paid`** but **only dry-run** artifacts (no real `payouts/final` or `notRealMoney: true`) | [F2 transition](weekly-contests-ops-f2.md) `paid`→`cancelled` with `force: true` — no Stripe reversals. |
| Contest **`paid`** with **`payouts/final`** where **`notRealMoney` is not `true`** and at least one line has **`status: succeeded`** and a **`tr_…`** id | **This story** — Admin **`POST …/void-after-prize`** (reverses Transfers, writes **`prize_transfer_reversal`** ledger lines, audit doc, then **`paid`→`cancelled`** and deletes **`results/final`**, **`payouts/dryRun`**, **`payouts/final`** in one Firestore transaction after Stripe succeeds). |

**Irreversible intent:** After successful prize movement, **do not** use F2 alone to “pretend” the contest was never paid; use this flow (or manual Stripe + ledger reconciliation) so money and Firestore stay aligned.

## Endpoint

`POST /api/v1/admin/contests/:contestId/void-after-prize`

| | |
|---|---|
| **Auth** | Firebase ID token with **`admin: true`** (same as other admin contest routes). |
| **Stripe** | `CONTESTS_PAYMENTS_ENABLED=true`, valid **`STRIPE_SECRET_KEY`**. |
| **Body (JSON, strict)** | `{ "reason": "…min 8 chars…", "confirmPhrase": "VOID_PRIZES" }` |

**Success (200):** `{ "ok": true, "contestId", "voidJobId", "reversalCount", "ledgerEntryIds": ["trr_…"] }`

**Typical errors**

| HTTP | `error.code` | Meaning |
|------|----------------|---------|
| 409 | `payout_final_missing` | No `payouts/final` — use F2 void. |
| 409 | `payout_not_real_money` | `notRealMoney: true` — use F2 void. |
| 409 | `no_succeeded_transfers_to_reverse` | Nothing to reverse in `final.lines`. |
| 409 | `contest_not_paid` | Contest not in **`paid`**. |
| 502 | `stripe_transfer_reversal_failed` | Stripe rejected a reversal (partial reversals may have succeeded — reconcile in Dashboard). |
| 409 | `contest_state_changed` | Contest changed mid-flight after Stripe calls — rare; reconcile. |

## Firestore writes

1. **`Stripe.transfers.createReversal`** per succeeded line (full line amount), with idempotency key `void_prize_{contestId}_{tr_id}_{voidJobId}` (truncated to 255 chars). Treats “already reversed” Stripe errors as success for that row.
2. Single **transaction**: **`contests/{contestId}/voidPrizeAttempts/{voidJobId}`** (audit), **`ledgerEntries/{trr_id}`** per reversal (`prize_transfer_reversal`, **`source: admin_adjustment`**), deletes **`results/final`**, **`payouts/dryRun`**, **`payouts/final`**, sets **`contests/{contestId}.status`** to **`cancelled`**.

## References

- [`server/contests/contest-void-after-prize.job.js`](../../server/contests/contest-void-after-prize.job.js)  
- [`server/contests/contest-transition-run.js`](../../server/contests/contest-transition-run.js) — shared artifact deletes (F2 + P6-F1)  
- [weekly-contests-phase6-payouts-jira.md](weekly-contests-phase6-payouts-jira.md) — Story **P6-F1**
