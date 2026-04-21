# Phase 5 — Payments (entry fees) — Jira backlog

**Scope:** **Paid entry** for weekly contests via **Stripe** (Checkout Session and/or Payment Element), **server-authoritative** payment state, **webhooks** for lifecycle events, and an **append-only ledger** for audit and reconciliation — **no** winner payouts yet (that is [Phase 6](product-roadmap-contests-and-payments.md)). **Never** store full card or bank numbers; store only Stripe object ids.

**Prerequisites**

- [product-roadmap-contests-and-payments.md](product-roadmap-contests-and-payments.md) Phase **0** legal / product gates addressed for **entry fees** (regions, ToS, contest rules, refunds at a high level).
- Phase **4** complete in target environments: `contests/{id}`, `entries/{uid}`, join API, scoring, `results/final`, `payouts/dryRun` (numeric).
- [stripe.md](stripe.md) — env var naming; test vs live keys.

**Suggested labels:** `phase-5`, `contests`, `payments`, `stripe`  
**Suggested fix version:** `Weekly contests — entry fees (Stripe test mode)`

---

## Phase exit criteria (product)

| Criterion | Verification |
|-----------|--------------|
| **Test-mode money** | End-to-end in **staging**: user pays **test** card → webhook fires → entry shows **paid** (or equivalent) → ledger lines exist for the contest + user. |
| **No PAN/storage** | Code review + Stripe Dashboard: only PaymentIntent / Checkout Session / Customer ids on server/Firestore — **no** raw card data in logs or DB. |
| **Webhooks authoritative** | UI does not “trust” redirect alone; **payment success** for contest entry is driven by **verified** webhook handling (redirect may only show UX). |
| **Idempotent webhooks** | Duplicate Stripe event delivery does **not** double-credit ledger or corrupt entry state. |
| **Ledger reconciliation** | For a defined test matrix, **ledger sums** match **Stripe** balances/charges for those test cases (document tolerance, e.g. currency rounding). |
| **Free contests unchanged** | Contests with **no** entry fee (or `entryFeeCents === 0`) still join via existing **free** path without Stripe. |

---

## Epic P5-A — ADR & payment semantics

### Story P5-A1 — ADR: Phase 5 entry fees (data model + join lifecycle)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Author `docs/weekly-contests-phase5-entry-fees-adr.md`: entry fee timing, Stripe objects, entry states, free vs paid join, refund policy hooks. |

**Description**

Lock engineering decisions before large implementation:

- **Amount:** Use contest `entryFeeCents` (already on contest doc for display) vs snapshot on entry at payment time; currency (single currency v1).
- **Join vs pay order:** Options — (a) **Checkout first**, then create entry on webhook; (b) **pending entry** created on “start checkout”, confirmed by webhook; (c) **join** blocked until `paymentStatus === paid`. Pick one and document race conditions (double tab, expired session).
- **Stripe surface:** **Checkout Session** (redirect) vs **Payment Element** (embedded) — recommend Checkout for v1 simplicity.
- **Stripe metadata:** `contestId`, `uid`, `rulesVersion` (or hash) on Session / PaymentIntent for traceability.
- **Non-goals:** Connect, transfers to winners, tax — defer to Phase 6/7.

**Acceptance criteria**

- [x] New ADR merged under `docs/` with status machine for **`paymentStatus`** (or equivalent) on `contests/{id}/entries/{uid}`.
- [x] Explicit **free path**: when `entryFeeCents` is 0 or absent, no Stripe calls; aligns with Phase 4 join.
- [x] Links to Phase 0 legal docs / ToS placeholders as “must ship before prod live keys”.
- [ ] Review sign-off table (product + engineering + legal) completed in ADR *(fill names/dates when reviewed)*.

**Dependencies**

- Phase 4 contest + entry schemas.

**Deliverable**

- **[`docs/weekly-contests-phase5-entry-fees-adr.md`](weekly-contests-phase5-entry-fees-adr.md)** ✅

---

## Epic P5-B — Data model: entry payment fields & ledger

### Story P5-B1 — Schema: payment fields on `contests/{contestId}/entries/{uid}`

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Document + implement (server writes only) Stripe reference ids and payment state on the entry document. |

**Description**

Add fields such as (exact names in schema doc): `paymentStatus`, `stripeCheckoutSessionId`, `stripePaymentIntentId`, `stripeCustomerId` (optional), `entryFeeCentsSnapshot`, `paidAt` (server timestamp), `lastStripeEventId` (optional, for debugging). **Server / Admin SDK only** — clients read for UI if rules allow.

**Acceptance criteria**

- [x] `docs/weekly-contests-schema-entries.md` updated (or new subsection) with field table and example JSON.
- [x] TypeScript model updated (`contest-entry.model.ts` or equivalent).
- [x] No client writes to these fields in `firestore.rules` (all entry writes already denied to clients; comment updated).

**Dependencies**

- Story P5-A1.

**Deliverable**

- Doc + `src/app/shared/models/...` updates ✅

---

### Story P5-B2 — Schema: append-only ledger (audit trail)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Define `ledger` (or `paymentLedger`) collection/lines: credits, debits, idempotency, Stripe ids. |

**Description**

Choose layout: e.g. `ledgerEntries/{autoId}` with `userId`, `contestId`, `entryId`, `type` (`contest_entry_fee`, `refund`, …), `amountCents`, `currency`, `stripeObjectType`, `stripeObjectId`, `stripeEventId` (unique for idempotency), `createdAt`, `source` (`webhook`, `admin_adjustment`). **Append-only** from application perspective; corrections via reversing lines, not deletes.

**Acceptance criteria**

- [x] `docs/weekly-contests-phase5-ledger-schema.md` (or section in ADR) with field list and idempotency rule (**one ledger line per `stripeEventId`** for webhook-driven lines).
- [x] Firestore rules: **no client create/update/delete** on ledger paths (no client **read** either).
- [x] Composite indexes if listing “by user” or “by contest” for support queries.

**Dependencies**

- Story P5-A1.

**Deliverable**

- [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md), [`contest-ledger-entry.model.ts`](../src/app/shared/models/contest-ledger-entry.model.ts), [`firestore.rules`](../firestore.rules), [`firestore.indexes.json`](../firestore.indexes.json), rules test update ✅

---

## Epic P5-C — Stripe server bootstrap & webhook endpoint

### Story P5-C1 — Server: Stripe SDK, configuration, and safety

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Initialize Stripe with `STRIPE_SECRET_KEY`; validate env on startup or first use; document test vs live. |

**Description**

Add `stripe` package to **server** dependencies. Read secret from env ([stripe.md](stripe.md)); never log full keys. Optional: log Stripe **account id** or mode (`test`/`live`) on boot for ops sanity.

**Acceptance criteria**

- [x] `STRIPE_SECRET_KEY` documented; server **fails fast on startup** if `CONTESTS_PAYMENTS_ENABLED=true` and key missing (`validateStripeConfigAtStartup` in `index.js`). Payment routes can use `sendStripeServiceUnavailable` when client unavailable (future).
- [x] No secret keys in client bundle (`generate-env-prod.mjs` / Angular unchanged for secrets — verified).

**Dependencies**

- None (can parallel ADR with stub).

**Deliverable**

- [`server/stripe-server.js`](../server/stripe-server.js), [`server/stripe-server.test.js`](../server/stripe-server.test.js), [`stripe`](../package.json) dependency, [`docs/stripe.md`](stripe.md), [`.env.example`](../.env.example) ✅

---

### Story P5-C2 — HTTP: Raw body route for `POST .../webhooks/stripe`

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Dedicated Express route with **raw** body for `stripe.webhooks.constructEvent`. |

**Description**

Register **`POST /api/v1/webhooks/stripe`** (or namespaced path) **before** JSON body parser for this path, OR use `express.raw({ type: 'application/json' })` for this route only. Verify signing secret `STRIPE_WEBHOOK_SECRET`. Reject invalid signatures with **400**; do not leak key material in errors.

**Acceptance criteria**

- [x] Documented in `docs/weekly-contests-phase5-webhooks.md` (or ADR appendix): path, header, replay attack considerations (Stripe timestamp tolerance).
- [x] Invalid signature returns 400; valid signed events return 200 (verify end-to-end with `stripe listen --forward-to …/api/v1/webhooks/stripe` and test-mode signing secret).

**Dependencies**

- Story P5-C1.

**Deliverable**

- [`index.js`](../index.js) (middleware order: `requestIdMiddleware` → raw `POST /api/v1/webhooks/stripe` → `express.json()`), [`server/stripe-webhook.http.js`](../server/stripe-webhook.http.js), [`server/stripe-webhook.http.test.js`](../server/stripe-webhook.http.test.js), [`docs/weekly-contests-phase5-webhooks.md`](weekly-contests-phase5-webhooks.md) ✅

---

## Epic P5-D — Create Checkout Session (authenticated)

### Story P5-D1 — API: `POST /api/v1/contests/:contestId/checkout-session`

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Authenticated user creates a Stripe Checkout Session for contest entry fee; returns URL or session id for redirect. |

**Description**

- **Auth:** Firebase ID token; `uid` must match payer.
- **Validate:** Contest `status === open`, now in play window, `gameMode` bio-ball, `entryFeeCents > 0`, user not already **paid** entry (per ADR).
- **Stripe:** `stripe.checkout.sessions.create` with `mode: 'payment'`, `line_items` from amount, `metadata`: `contestId`, `uid`, `rulesVersion` / snapshot id, `clientReferenceId` or similar for support.
- **Success/cancel URLs:** Angular routes with query params; **do not** treat success URL as proof of payment.
- **Response:** `{ url }` or `{ sessionId }` per Stripe API.

**Acceptance criteria**

- [ ] OpenAPI-style table in `docs/weekly-contests-api-phase5.md` (new) with errors: `401`, `404`, `409` (already entered), `400` (no fee / wrong status).
- [ ] Rate limit per uid (reuse or extend contest join limits — see [weekly-contests-rate-limits](weekly-contests-api-c1.md) patterns).

**Dependencies**

- Stories P5-A1, P5-B1, P5-C1.

---

### Story P5-D2 — Angular: Paid entry UX (Checkout redirect)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Contests panel: for paid contests, “Join” flow calls checkout-session API and redirects to Stripe Checkout; success/cancel return routes. |

**Description**

- Show entry fee clearly (from contest doc); dry-run banner updated if needed for **real** money when feature flag on.
- After return from Checkout, show “Confirming payment…” until Firestore entry reflects **paid** (poll listener or webhook latency message).
- **Cancel** route: user can retry checkout per ADR.

**Acceptance criteria**

- [ ] Works end-to-end in **test mode** with [Stripe test cards](https://stripe.com/docs/testing).
- [ ] `stripePublishableKey` only if using Elements later; Checkout redirect may not need publishable key on client — document either way.

**Dependencies**

- Story P5-D1, P5-E1 (webhook updates entry).

---

## Epic P5-E — Webhook handlers & idempotency

### Story P5-E1 — Webhook: `checkout.session.completed` / `payment_intent.succeeded`

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | On verified event, set entry `paymentStatus` to paid, write ledger credit line, idempotent on `event.id`. |

**Description**

- Load metadata to find `contestId` + `uid`; verify amount matches expected fee snapshot.
- Use transaction or idempotent write: **if** `processedStripeEvents/{eventId}` exists, return 200 without double work.
- Set `paidAt`, optional denormalized flags for UI.

**Acceptance criteria**

- [ ] Duplicate delivery of same `event.id` does not duplicate ledger lines.
- [ ] Structured log: `component: stripe_webhook`, `eventType`, `contestId`, `uid`, `outcome`.

**Dependencies**

- Stories P5-B2, P5-C2, P5-D1.

---

### Story P5-E2 — Webhook: payment failed, session expired

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Handle failure paths; update `paymentStatus` / allow retry without orphaning ledger. |

**Description**

- Map `payment_intent.payment_failed`, `checkout.session.async_payment_failed`, `checkout.session.expired` per product rules.
- No ledger credit on failure; optional ledger “info” line or none — document.

**Acceptance criteria**

- [ ] Documented matrix of event types → entry state in `docs/weekly-contests-phase5-webhooks.md`.

**Dependencies**

- Story P5-E1.

---

### Story P5-E3 — Webhook: refunds (`charge.refunded` / `refund.updated`)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Partial/full refund updates entry and ledger reversing lines; idempotent per event id. |

**Description**

- Align with **Phase 0** refund policy (operator-initiated vs automatic).
- Ledger: append **debit** or reversing **credit** line; never delete prior lines.

**Acceptance criteria**

- [ ] Test mode refund in Dashboard or API produces consistent entry + ledger state.

**Dependencies**

- Stories P5-B2, P5-E1.

---

## Epic P5-F — Join API & free vs paid

### Story P5-F1 — `POST /api/v1/contests/:contestId/join` behavior for paid contests

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Align join endpoint with ADR: reject paid contest without payment, or create `pending_payment` entry — implement chosen model. |

**Description**

Per P5-A1 decision:

- **Option A:** Join returns **409** with `code: payment_required` and client must complete Checkout first, then “finalize” via webhook-only entry creation.
- **Option B:** Join creates **pending** entry; webhook marks **paid** (and rejects duplicate).
- **Option C:** Separate endpoints — “reserve” vs “confirm”; document clearly.

**Acceptance criteria**

- [ ] [weekly-contests-api-c1.md](weekly-contests-api-c1.md) updated with new error codes and flow diagram (mermaid optional).
- [ ] Idempotent replay behavior preserved for **free** contests.

**Dependencies**

- Stories P5-A1, P5-E1.

---

### Story P5-F2 — Regression: free contests (`entryFeeCents === 0`)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Automated or manual regression: zero-fee contests join without Stripe; existing E2E smoke still passes. |

**Acceptance criteria**

- [ ] Documented in [weekly-contests-ui-walkthrough-check.md](weekly-contests-ui-walkthrough-check.md) optional row for “free contest join”.

**Dependencies**

- Story P5-F1.

---

## Epic P5-G — Firestore rules, indexes, and security review

### Story P5-G1 — `firestore.rules`: payment + ledger paths

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Deny all client writes to ledger; deny client writes to entry payment fields; signed-in read of own entry unchanged. |

**Acceptance criteria**

- [ ] Rules unit tests extended ([test:firestore-rules](package.json)) for new paths.
- [ ] Deploy notes in [firestore-rules-deploy.md](firestore-rules-deploy.md) if new collections.

**Dependencies**

- Stories P5-B1, P5-B2.

---

## Epic P5-H — Observability, reconciliation, and QA exit

### Story P5-H1 — Structured logging & metrics hooks

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Standard log fields for checkout creation and webhooks; optional metric counters for webhook failures. |

**Acceptance criteria**

- [ ] Log schema snippet in `docs/weekly-contests-phase5-observability.md` (new, short).

**Dependencies**

- Stories P5-D1, P5-E1.

---

### Story P5-H2 — Runbook: staging QA & reconciliation checklist

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | `docs/weekly-contests-phase5-staging-qa.md`: Stripe CLI listen, test cards, ledger vs Dashboard spot-check, sign-off template. |

**Acceptance criteria**

- [ ] Steps to satisfy **Phase exit criteria** table at top of this doc.
- [ ] Link from [product-roadmap-contests-and-payments.md](product-roadmap-contests-and-payments.md) Phase 5 section.

**Dependencies**

- Core stories P5-D2, P5-E1–E3 completed in staging.

---

### Story P5-H3 — Automated tests: webhook idempotency & join matrix

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | `node --test` or integration tests: mock Stripe payloads; verify duplicate events no-op; free vs paid join matrix. |

**Acceptance criteria**

- [ ] CI runs new tests in `npm run test:server` or dedicated script documented in package.json.

**Dependencies**

- Stories P5-E1, P5-F1.

---

## Suggested implementation order (dependency-aware)

| Order | Stories | Notes |
|-------|---------|--------|
| 1 | P5-A1 | ADR gates schema and join design. |
| 2 | P5-B1, P5-B2 | Schema docs + types; rules in P5-G1 can follow. |
| 3 | P5-C1, P5-C2 | Stripe + webhook pipe. |
| 4 | P5-D1 | Checkout Session API. |
| 5 | P5-E1, P5-E2, P5-E3 | Webhooks + ledger writes. |
| 6 | P5-F1, P5-F2 | Join alignment + regression. |
| 7 | P5-D2 | UI after API + webhook path works. |
| 8 | P5-G1 | Harden Firestore. |
| 9 | P5-H1, P5-H2, P5-H3 | Exit criteria + CI. |

Parallelism: **C1/C2** can start after A1; **B1/B2** after A1; **D1** after B+C; **E*** after D1 creates real Sessions in test.

---

## References

- [product-roadmap-contests-and-payments.md](product-roadmap-contests-and-payments.md) — Phases 5–7 context  
- [stripe.md](stripe.md) — Environment variables  
- [weekly-contests-schema-entries.md](weekly-contests-schema-entries.md) — Current entry shape  
- [weekly-contests-api-c1.md](weekly-contests-api-c1.md) — Join API  
