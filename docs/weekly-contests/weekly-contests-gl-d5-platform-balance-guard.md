# Story GL-D5 — Platform balance guard (optional prod parity)

**Story:** **GL-D5** in [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md) (Epic **GL-D** — Production server runtime).

**Purpose:** Decide whether production enables **P6-E1** — **`CONTEST_PAYOUT_BALANCE_GUARD_ENABLED=true`** — so prize payout execute **pre-flights** Stripe **platform USD available** against the **planned** Connect transfer total, blocking with **409** `insufficient_platform_balance` when funds are short. Document what operators do when that happens and how this aligns with monitoring.

## Env flag

| Variable | When guard runs |
|----------|-----------------|
| **`CONTEST_PAYOUT_BALANCE_GUARD_ENABLED`** | **`true`** (trimmed, string — only this exact value enables the guard). Any other value → guard **off** ([`isContestPayoutBalanceGuardEnabled`](../../server/contests/contest-payout-platform-balance.js)). |

**Staging:** Optional **`true`** so shared staging matches prod behavior ([weekly-contests-phase6-staging-qa.md](weekly-contests-phase6-staging-qa.md)).

**Production:** Product/finance decision — **on** catches insufficient platform balance before transfers; **off** skips the extra **`balance.retrieve`** (see cost table in [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md)).

## Behavior (summary)

When enabled and planned prize total **> 0** cents, the job calls **`stripe.balance.retrieve()`**, sums **USD `available`** ([`extractUsdAvailableCentsFromBalance`](../../server/contests/contest-payout-platform-balance.js)), and returns **409** `insufficient_platform_balance` if available **<** required (planned transfers that pass entry + Connect gates only).

Full detail: [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md) § Behavior summary (step 1).

If Balance API fails: **503** `stripe_balance_unavailable`. Small **race** remains between check and **`transfers.create`** — Stripe remains authoritative on transfer failures.

## Operators: **409 `insufficient_platform_balance`**

1. **Read logs** — structured line **`outcome: insufficient_platform_balance`** includes **`availableUsdCents`**, **`requiredUsdCents`**, **`plannedMoneyLineCount`** (aggregates only — [weekly-contests-phase6-observability.md](weekly-contests-phase6-observability.md)).
2. **Stripe Dashboard** — **Balances** (platform): confirm USD **Available** vs expected; **add funds** to the platform balance if this was a real funding gap ([Stripe docs — Connect balances](https://docs.stripe.com/connect/account-balances)).
3. **Do not** “fix” by weakening contest data unless finance agrees — resolve funding or eligibility first.
4. **Retry** — After funding or correcting eligibility, re-run **`POST …/payouts/execute`** or **[admin retry failed](weekly-contests-phase6-ops.md)** paths per [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md).

Admin UI may surface the same code — see client handling in [`admin-weekly-contests-widget.component.ts`](../../src/app/nav/admin-dashboard-panel/admin-weekly-contests-widget/admin-weekly-contests-widget.component.ts).

## Monitoring (minimum)

- **Logs / sinks:** Filter **`domain":"contest_payouts"`** and **`outcome":"insufficient_platform_balance`** — alert if sustained or unexpected in prod.
- **Stripe:** Watch platform balance vs upcoming prize obligations (manual or finance tooling outside this repo).

## Verification

- **`GET /health`** includes **`contestPayoutBalanceGuardEnabled`** matching the env flag (boolean).
- Runbook acceptance: this doc’s **Operators** section satisfies GL-D5 “what to do on **409**”.

## References

- [`server/contests/contest-payout-platform-balance.js`](../../server/contests/contest-payout-platform-balance.js)
- [`server/contests/contest-payout-execute.job.js`](../../server/contests/contest-payout-execute.job.js)
- [weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md)
- [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md)
