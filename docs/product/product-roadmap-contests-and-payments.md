# Product roadmap — contests, payments, and operations (Phases 0–7)

**Purpose:** Single reference for the **intended build order** for paid weekly contests: scope and compliance first, then identity, stats, leaderboards, dry-run contests, **entry fees**, **payouts**, and **hardening**.  
**Status:** Product / engineering guidance — not a commitment date or contract.  
**Related in repo:** [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md) (Phase 4 v1 scope), [stripe.md](stripe.md) (Stripe placeholders), [leaderboards-prize-verification-f3.md](leaderboards-prize-verification-f3.md) (prize / eligibility posture).

---

## Phase 0 — Scope, risk, and compliance (before heavy build)

- **Define the contest model:** entry fee, prize pool, tie-breaking, refunds, what happens if a game is postponed, minimum entrants, age/jurisdiction rules.
- **Legal:** paid contests often trigger gambling/sweepstakes rules; get guidance for your target regions (US state-by-state is common). Terms of service, privacy policy, contest rules, and refund policy are **not optional** for payments.
- **Choose payment + payout provider:** Stripe (Connect for marketplace-style payouts to winners) is a typical path; alternatives exist but the pattern is similar: collect → hold → distribute with audit logs.
- **Success metrics:** e.g. “login works,” “stats accurate,” “leaderboard updates within X minutes,” “payout completes within Y days.”

---

## Phase 1 — Identity and sessions (login)

- **Lock in auth UX:** email/password, Google, etc., using your existing `provideAuth` setup; add protected routes and a minimal “account” shell.
- **Server trust:** anything that writes scores, contest entries, or money must be validated with Firebase Admin (verify ID tokens on Express or use Callable Cloud Functions). **Do not trust the client alone.**
- **User document:** on first sign-in, create `users/{uid}` with display name, `createdAt`, and flags you need for contests (verified email, region if required).
- **Environment separation:** dev/staging/prod Firebase projects and Stripe test mode until you are confident.
- **Exit criteria:** signed-in users have a stable `uid`; API rejects unauthenticated or forged requests.

---

## Phase 2 — Instrument gameplay for stats

- **Events:** define what you persist (per game: result, time, mode, mistakes, etc.). Prefer **append-only events** plus aggregates rather than only overwriting counters (easier to debug and extend).
- **Aggregates:** `users/{uid}/stats` (totals, streaks, bests) updated by **trusted code** (Functions or Express after validation).
- **Backfill strategy:** if you have historical data, one-time migration script; otherwise stats start from launch.
- **Exit criteria:** stats match a manual spot-check against raw events.

---

## Phase 3 — Leaderboards

- **Scope:** global vs weekly vs per-game mode; refresh cadence (real-time vs batch).
- **Data shape:**
  - Firestore: composite indexes for “this week + score desc”; cap document reads with pagination.
  - Or precomputed leaderboard docs updated by scheduled jobs (cheaper at scale).
- **Anti-abuse:** rate limits, duplicate account friction, optional verification steps before prizes.
- **Exit criteria:** leaderboard is correct for a test cohort and stable under concurrent writes.

---

## Phase 4 — Weekly contests (product, no money yet)

- **Contest entities:** `contests/{id}` (window start/end, rules version, status: `scheduled` | `open` | `scoring` | `paid` | `cancelled`).
- **Entries:** entries keyed by `contestId` + `uid` (idempotent join), snapshot of rules accepted.
- **Scoring job:** when the contest closes, compute ranks from your stats/events for that window; store final standings and tie resolution in **immutable** records.
- **Dry run payouts:** “winner gets $X” as **numbers only** — no Stripe yet.
- **Exit criteria:** a full weekly cycle works in staging with fake currency or zero-dollar entries.

**Repository:** Phase 4 weekly contests (Bio Ball, dry-run payouts) are documented and implemented per [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md), [weekly-contests-runbook-g2.md](weekly-contests-runbook-g2.md), and [weekly-contests-ui-walkthrough-check.md](weekly-contests-ui-walkthrough-check.md).

---

## Phase 5 — Payments (entry fees)

- Stripe **Checkout** or **Payment Element** for collecting entry fees; store PaymentIntent / session IDs on the **entry** document; **never** store full card data.
- **Webhooks** (Stripe → your backend): authoritative source for payment succeeded / failed / refunded. Reconcile webhooks with client state; handle retries **idempotently**.
- **Ledger:** internal table/collection for credits, debits, and balances per user and per contest (audit trail for disputes).
- **Exit criteria:** money flows in **test mode**; ledger always matches Stripe dashboard for test cases.

**Repository:** Stripe Checkout, webhooks, ledger, and join gating are implemented for paid entry (**test mode**). See [stripe.md](stripe.md) for env var names and safety rules (Angular embeds **publishable** keys only). Staging sign-off: [weekly-contests-phase5-staging-qa.md](../weekly-contests/weekly-contests-phase5-staging-qa.md).

**ADR (entry fees + join lifecycle):** [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md).

**Jira-style backlog (detailed stories):** [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md).

**Ledger (audit trail):** [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md).

---

## Phase 6 — Payouts (prize money)

- **KYC / Connect:** winners typically need Stripe Connect onboarding (or your provider’s equivalent) before large payouts; define thresholds and fallback (check, manual review).
- **Payout flow:** after scoring is final, create transfers or payouts from your platform balance; record payout IDs and status on entries or a `payouts` collection.
- **Refunds / cancellations:** define policy and implement partial refunds or full cancel flows in webhook handlers.
- **Exit criteria:** end-to-end test: entry → rank → payout record → (test) money to connected account.

**Repository:** Not implemented. Phase 4 uses **dry-run** payout docs only ([weekly-contests-schema-results.md](weekly-contests-schema-results.md)).

**Jira-style backlog (detailed stories):** [weekly-contests-phase6-payouts-jira.md](../weekly-contests/weekly-contests-phase6-payouts-jira.md).

**ADR (who / when / how much):** [weekly-contests-phase6-payouts-adr.md](../weekly-contests/weekly-contests-phase6-payouts-adr.md) (Story P6-A1).

---

## Phase 7 — Hardening and operations

- **Security rules** (Firestore/Storage): least privilege; **no client writes** to financial or leaderboard-final docs.
- **Monitoring:** structured logs for payments, webhooks, scoring jobs; alerts on webhook failures or ledger mismatches.
- **Admin tools:** support dashboard to void a contest, refund, or rerun scoring (with safeguards).
- **Load and cost:** estimate Firestore reads for leaderboards; schedule heavy work off the hot path.

**Repository:** Partial — e.g. rate limits, Firestore rules for contests, admin APIs for transitions ([weekly-contests-admin-capabilities-and-roadmap.md](weekly-contests-admin-capabilities-and-roadmap.md)). Financial hardening for live money is **not** complete until Phases 5–6 are implemented.

---

## Suggested order (dependency-aware)

Follow phases **in order** where possible: **0 → 1 → 2 → 3 → 4 → 5 → 6 → 7**. Phase 0 gates **legal and data model** decisions that are painful to reverse; Phase 5 should not start without a clear ledger and webhook strategy; Phase 6 assumes Phase 5 and final scoring artifacts from Phase 4.

---

## Approximate mapping to this codebase (engineering snapshot)

| Phase | Theme | Roster Riddles (high level) |
|-------|--------|-----------------------------|
| 0 | Compliance, provider, metrics | Partially reflected in ADRs and docs; **paid** launch needs explicit legal/product sign-off beyond code. |
| 1 | Auth + server trust | **Largely implemented** (Firebase Auth, token verification on APIs). |
| 2 | Events + stats | **Implemented** (gameplay events + aggregates; see [gameplay-stats-phase2.md](gameplay-stats-phase2.md)). |
| 3 | Leaderboards | **Implemented** (see leaderboards docs). |
| 4 | Weekly contests, dry-run | **Implemented** for Bio Ball + dry-run payouts. |
| 5 | Entry fees | **Partial** — Checkout + webhooks + ledger in repo; staging sign-off per [weekly-contests-phase5-staging-qa.md](../weekly-contests/weekly-contests-phase5-staging-qa.md). |
| 6 | Payouts | **Not implemented**. |
| 7 | Hardening + ops | **Partial** — improve as money flows go live. |

This table is a **rough** fit for planning; it is not a formal sign-off matrix.
