# Weekly contests — production go-live (Jira backlog)

**Purpose:** Track **cross-cutting** work to run **live** weekly contests with **entry fees** and **prize payouts** in production. Assumes **Phase 4–6** implementation exists in the repo; this focuses on **cutover**, **configuration**, **compliance**, **operability**, and **gaps** not covered by a single phase Jira.

**Not in scope for this file:** Re-implementing Phase 5/6 features; use [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) and [weekly-contests-phase6-payouts-jira.md](weekly-contests-phase6-payouts-jira.md) for feature completion.

**Related:** [product-roadmap-contests-and-payments.md](../product/product-roadmap-contests-and-payments.md) Phase 0, [weekly-contests-phase5-staging-qa.md](weekly-contests-phase5-staging-qa.md), [weekly-contests-gl-b1-phase5-staging-evidence.md](weekly-contests-gl-b1-phase5-staging-evidence.md) (GL-B1 evidence template), [weekly-contests-phase6-staging-qa.md](weekly-contests-phase6-staging-qa.md), [weekly-contests-gl-b2-phase6-staging-evidence.md](weekly-contests-gl-b2-phase6-staging-evidence.md) (GL-B2 evidence template), [weekly-contests-gl-c1-production-paid-ui-build.md](weekly-contests-gl-c1-production-paid-ui-build.md) (GL-C1 wiring + verification), [weekly-contests-gl-c2-simulated-contests-ui-build.md](weekly-contests-gl-c2-simulated-contests-ui-build.md) (GL-C2 simulated UX defaults), [weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md](weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md) (GL-C3 publishable key), [weekly-contests-gl-d1-api-contest-payments-enabled.md](weekly-contests-gl-d1-api-contest-payments-enabled.md) (GL-D1 API payments flag), [weekly-contests-gl-d2-stripe-webhook-live.md](weekly-contests-gl-d2-stripe-webhook-live.md) (GL-D2 live webhooks), [weekly-contests-gl-d3-checkout-redirect-origin.md](weekly-contests-gl-d3-checkout-redirect-origin.md) (GL-D3 checkout origin), [stripe.md](../payments/stripe.md), [generate-env-prod.mjs](../../scripts/generate-env-prod.mjs), [`.env.example`](../../.env.example).

**Suggested labels:** `weekly-contests`, `production`, `stripe`, `payments`, `launch`

---

## Epic GL-A — Product & legal gates (blocking live money)

### Story GL-A1 — Phase 0 legal / contest rules sign-off for paid entry + prizes

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Record formal sign-off that published rules, fees, refunds, prize eligibility, and regions match what production will enforce. |
| **Deliverable** | **[weekly-contests-phase0-production-sign-off.md](weekly-contests-phase0-production-sign-off.md)** |

**Description**

- Align marketing copy, in-app rules links (`fullRulesHref` → [`src/assets/contests/weekly-contests-rules.html`](../../src/assets/contests/weekly-contests-rules.html)), and contest creation defaults with counsel-approved language.
- Confirm sweepstakes / skill-contest classification posture per jurisdictions you serve (document scope: US-only vs broader).
- Tie to ADR: [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md), [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md) Phase 0 sections.

**Acceptance criteria**

- [ ] **[weekly-contests-phase0-production-sign-off.md](weekly-contests-phase0-production-sign-off.md)** — Section **3** (role sign-off) filled with names and dates.
- [ ] Same doc — Section **2** (checklist C1–C8) completed or gaps listed in Section **4** (waiver register) with owner and approver.
- [ ] No open “must ship before prod keys” items without an explicit waiver row in Section **4**.

**Dependencies:** None (blocking).

---

### Story GL-A2 — Tax / 1099 / winner reporting posture (document-only v1)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Document threshold triggers and operational plan for winner tax reporting (even if automation is deferred). |
| **Deliverable** | **[weekly-contests-tax-winner-reporting-posture.md](weekly-contests-tax-winner-reporting-posture.md)** |

**Description**

- Reference Stripe Connect reporting capabilities vs operator manual exports.
- Decide what support tells winners when asked about tax forms.

**Acceptance criteria**

- [x] One-page addendum: **[weekly-contests-tax-winner-reporting-posture.md](weekly-contests-tax-winner-reporting-posture.md)**.
- [x] Cross-links from [stripe.md](../payments/stripe.md) (Connect) and [weekly-contests-phase6-payouts-ux.md](weekly-contests-phase6-payouts-ux.md) (Support playbook).

---

## Epic GL-B — Staging proof before prod keys

### Story GL-B1 — Repeat Phase 5 staging QA on shared staging with stable URLs

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Execute [weekly-contests-phase5-staging-qa.md](weekly-contests-phase5-staging-qa.md) end-to-end; archive evidence (screenshots, Stripe event ids, Firestore paths). |
| **Deliverable** | Completed **[weekly-contests-gl-b1-phase5-staging-evidence.md](weekly-contests-gl-b1-phase5-staging-evidence.md)** (template → filled evidence) |

**Description**

- Use **team-shared staging** with **fixed** SPA + API + webhook URLs ([stripe.md](../payments/stripe.md) — `CONTESTS_CHECKOUT_APP_ORIGIN`).
- Run all sections of the Phase 5 staging runbook; attach **`npm run test:server`** green on the release candidate where applicable.

**Acceptance criteria**

- [ ] All Phase 5 exit criteria in [weekly-contests-phase5-payments-jira.md](weekly-contests-phase5-payments-jira.md) verified with **test mode** Stripe on shared staging — recorded in evidence doc §5.
- [ ] Webhook endpoint documented (Dashboard URL **or** Stripe CLI forward) — evidence doc §3.
- [ ] **`processedStripeEvents`** idempotency observed under replay test — evidence doc §4.

---

### Story GL-B2 — Repeat Phase 6 staging QA (Connect + transfer E2E)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Execute [weekly-contests-phase6-staging-qa.md](weekly-contests-phase6-staging-qa.md) end-to-end on shared staging; archive Connect onboarding, execute, **`tr_…`**, and webhook proof. |
| **Deliverable** | Completed **[weekly-contests-gl-b2-phase6-staging-evidence.md](weekly-contests-gl-b2-phase6-staging-evidence.md)** (template → filled evidence) |

**Description**

- Use **team-shared staging** with **fixed** SPA + API + webhook URLs ([stripe.md](../payments/stripe.md) — `CONTESTS_CHECKOUT_APP_ORIGIN`; Connect env vars per [weekly-contests-phase6-staging-qa.md](weekly-contests-phase6-staging-qa.md) Preconditions).
- Complete **Express** onboarding for a winner test user; run scoring → **`paid`** → **payout execute** so **`payouts/final`** contains at least one real **`tr_…`** in test mode (or a documented intentional **`skipped`** line).
- Verify **`transfer.*`** / optional **`payout.*`** webhooks and consistency across Stripe Dashboard, **`payouts/final`**, and **`ledgerEntries`**.
- Run **§6** refund and/or void-after-prize drill as in the runbook.
- Confirm **`npm run test:server`** green on the release candidate.

**Acceptance criteria**

- [ ] All substantive Phase 6 checks in evidence doc **§6** (aligned with runbook [§8 Sign-off](weekly-contests-phase6-staging-qa.md#8-sign-off-copy-to-ticket--release-doc)) verified on **test mode** Stripe — recorded with ids/links.
- [ ] Webhook endpoint documented (Dashboard URL **or** Stripe CLI forward); evidence shows **`account.updated`** and **`transfer.*`** deliveries succeeding — evidence doc **§3**.
- [ ] At least one **`tr_…`** on **`payouts/final`** with matching Stripe Connect **Transfers** row — evidence doc **§4**.
- [ ] **`processedStripeEvents`** idempotency observed under replay test for at least one webhook — evidence doc **§5**.
- [ ] **`npm run test:server`** green on branch tagged for release — link in evidence doc **§2**.

---

## Epic GL-C — Production Angular bundle configuration

### Story GL-C1 — Enable paid contest UI in production builds (`CONTESTS_PAYMENTS_ENABLED`)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Set **`CONTESTS_PAYMENTS_ENABLED=true`** in Cloud Build / CI for **production** Angular builds so `environment.contestsPaymentsEnabled` is true (see [generate-env-prod.mjs](../../scripts/generate-env-prod.mjs)). |
| **Deliverable** | **[weekly-contests-gl-c1-production-paid-ui-build.md](weekly-contests-gl-c1-production-paid-ui-build.md)** (wiring summary + verification); repo defaults documented in **[cloudbuild.yaml](../../cloudbuild.yaml)** (`_CONTESTS_PAYMENTS_ENABLED: 'true'`) |

**Description**

- Without **`CONTESTS_PAYMENTS_ENABLED=true`** at **Angular build** time, checkout buttons and paid-entry flows stay hidden even if the API is enabled.
- **Default:** [`cloudbuild.yaml`](../../cloudbuild.yaml) sets **`_CONTESTS_PAYMENTS_ENABLED: 'true'`** and passes it to Docker **`CONTESTS_PAYMENTS_ENABLED`** so **`generate-env-prod.mjs`** emits **`contestsPaymentsEnabled: true`** unless the trigger overrides it.
- Coordinate timing with Story **GL-D1** so users never see paid UI while API rejects checkout (**503** `contest_payments_disabled`).

**Acceptance criteria**

- [ ] Production Cloud Build trigger keeps **`_CONTESTS_PAYMENTS_ENABLED`** **`true`** (or explicitly sets it) — recorded in [weekly-contests-gl-c1-production-paid-ui-build.md](weekly-contests-gl-c1-production-paid-ui-build.md) § Verification **or** in ticket notes.
- [ ] Production artifact inspected (search built **`main-*.js`** or sourcemap for **`contestsPaymentsEnabled`**) **or** verify generated **`environment.prod.ts`** / build log from CI.
- [ ] Staging remains independently configurable (**separate trigger** / **`_DEPLOYMENT=staging`**; optional **`_CONTESTS_PAYMENTS_ENABLED=false`**).

---

### Story GL-C2 — Simulated contests UI default for production (`SIMULATED_CONTESTS_UI_ENABLED`)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Confirm **`SIMULATED_CONTESTS_UI_ENABLED`** for prod builds: **`unset` or not `true`** → live-oriented strip/card copy ([generate-env-prod.mjs](../../scripts/generate-env-prod.mjs) production branch); opt-in **`true`** only for dry-run branded environments. |
| **Deliverable** | **[weekly-contests-gl-c2-simulated-contests-ui-build.md](weekly-contests-gl-c2-simulated-contests-ui-build.md)** (behavior + verification); optional **`_SIMULATED_CONTESTS_UI_ENABLED`** in **[cloudbuild.yaml](../../cloudbuild.yaml)** / **[Dockerfile](../../Dockerfile)** |

**Description**

- **Production** Angular output sets **`simulatedContestsUiEnabled`** to **`true`** only when **`SIMULATED_CONTESTS_UI_ENABLED===`'true'`** at build time — see [weekly-contests-gl-c2-simulated-contests-ui-build.md](weekly-contests-gl-c2-simulated-contests-ui-build.md).
- **Staging** defaults to simulated UX unless the var is **`false`** (shared staging QA).
- Coordinate with product so marketing / legal expectations match live-oriented copy on production.

**Acceptance criteria**

- [ ] Production Cloud Build leaves **`_SIMULATED_CONTESTS_UI_ENABLED`** **empty** or **`false`** (or unset substitution so default applies) for normal prod — recorded in ticket notes **or** [weekly-contests-gl-c2-simulated-contests-ui-build.md](weekly-contests-gl-c2-simulated-contests-ui-build.md) § Verification.
- [ ] Prod artifact shows **`simulatedContestsUiEnabled`** falsy unless a trigger explicitly opts in — grep **`dist/`** / sourcemap **or** generated env step log.
- [ ] [`.env.example`](../../.env.example) documents prod vs staging semantics (**already present**); [weekly-contests-gl-c2-simulated-contests-ui-build.md](weekly-contests-gl-c2-simulated-contests-ui-build.md) matches **`generate-env-prod.mjs`**.

---

### Story GL-C3 — Stripe publishable key (`STRIPE_PUBLISHABLE_KEY`) in prod bundle

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Inject **`pk_live_…`** via CI into **`environment.prod.ts`** (`stripePublishableKey`) for Checkout / Elements surfaces that require it. |
| **Deliverable** | **[weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md](weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md)** (security, wiring, verification); **`_STRIPE_PUBLISHABLE_KEY`** on the **production** Cloud Build trigger |

**Description**

- **`STRIPE_PUBLISHABLE_KEY`** → **`environment.stripePublishableKey`** via [`generate-env-prod.mjs`](../../scripts/generate-env-prod.mjs); Docker **`STRIPE_PUBLISHABLE_KEY`** / Cloud Build **`_STRIPE_PUBLISHABLE_KEY`** ([`cloudbuild.yaml`](../../cloudbuild.yaml)).
- **Production** trigger: set **`pk_live_…`** when enabling live client Stripe usage; **staging** trigger: **`pk_test_…`** only ([docs/payments/stripe.md](../payments/stripe.md)).
- **Never** bake **`sk_*`** into Angular — server-only ([weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md](weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md) § Security).

**Acceptance criteria**

- [ ] **`STRIPE_SECRET_KEY`** / webhook secrets **not** present in built SPA assets — verify by inspection (publishable **`pk_`** only).
- [ ] Production trigger **`_STRIPE_PUBLISHABLE_KEY`** set to **`pk_live_…`** before relying on client Stripe.js — evidence per [weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md](weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md) § Verification.
- [ ] Smoke: load Bio Ball (or home with contests drawer), confirm **no** Stripe console errors **where** the app initializes Stripe.js against **`environment.stripePublishableKey`**; if no client Stripe path exists yet, artifact grep / CI log suffices.

---

## Epic GL-D — Production server runtime (Express / Cloud Run)

### Story GL-D1 — Enable contest payments on API (`CONTESTS_PAYMENTS_ENABLED=true`)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Set server env **`CONTESTS_PAYMENTS_ENABLED=true`** in production so Checkout session creation, webhooks, Connect routes, and payout execute gates succeed ([stripe-server.js](../../server/payments/stripe-server.js)). |
| **Deliverable** | **[weekly-contests-gl-d1-api-contest-payments-enabled.md](weekly-contests-gl-d1-api-contest-payments-enabled.md)** (runtime wiring + verification); Cloud Run env via **[cloudbuild.yaml](../../cloudbuild.yaml)** **`CONTESTS_PAYMENTS_ENABLED`** deploy flag |

**Description**

- Startup validation requires **`STRIPE_SECRET_KEY`** when payments enabled — provision **`sk_live_…`** in Secret Manager / runtime env.
- Coordinate rollout with **GL-C1** so Angular **`contestsPaymentsEnabled`** and API gates stay aligned.
- **`GET /health`** returns **`contestsPaymentsEnabled`** and **`stripeSecretKeyMode`** (`test` \| `live` \| `unknown` \| `null`) — no secret values ([`index.js`](../../index.js), [`getStripeHealthFields`](../../server/payments/stripe-server.js)).

**Acceptance criteria**

- [ ] Deploy startup logs show **`stripe_client_initialized`** (no **`exit(1)`** from **`validateStripeConfigAtStartup`** when payments + secret key are correctly set).
- [ ] **`GET /health`** JSON includes **`contestsPaymentsEnabled`** and **`stripeSecretKeyMode`** — verify against [weekly-contests-gl-d1-api-contest-payments-enabled.md](weekly-contests-gl-d1-api-contest-payments-enabled.md) § Verification.

---

### Story GL-D2 — Stripe webhook endpoint + signing secret (live mode)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Register **`POST /api/v1/webhooks/stripe`** on **live** Stripe Dashboard; set **`STRIPE_WEBHOOK_SECRET`** (`whsec_…`) in prod server env. |
| **Deliverable** | **[weekly-contests-gl-d2-stripe-webhook-live.md](weekly-contests-gl-d2-stripe-webhook-live.md)** (live endpoint checklist + verification) |

**Description**

- Subscribe to events required for Phase 5 + 6: contest payment success/failure/refund paths; Connect **`account.updated`**; prize **`transfer.*`** / **`payout.*`** per [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md).
- **Live** signing secret must match the **live** Dashboard endpoint (not test-mode **`whsec_…`**).
- **`GET /health`** exposes **`stripeWebhookSecretConfigured`** (boolean) when secret resolves — see [weekly-contests-gl-d2-stripe-webhook-live.md](weekly-contests-gl-d2-stripe-webhook-live.md) § Verification.

**Acceptance criteria**

- [ ] **Live** Stripe Dashboard: webhook URL **`https://<prod-host>/api/v1/webhooks/stripe`**, required events subscribed — recorded in ticket or GL-D2 doc notes.
- [ ] **`STRIPE_WEBHOOK_SECRET`** set on production Cloud Run (live **`whsec_…`**); **`GET /health`** shows **`stripeWebhookSecretConfigured":true`**.
- [ ] Webhook **Send test event** (or real event) shows **2xx** delivery after deploy.
- [ ] Idempotency: **`processedStripeEvents`** smoke — replay same **`evt_…`** → no duplicate ledger rows ([weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md)).

---

### Story GL-D3 — Checkout redirect origin (`CONTESTS_CHECKOUT_APP_ORIGIN`)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Set **`CONTESTS_CHECKOUT_APP_ORIGIN=https://rosterriddles.com`** (no trailing slash) [or actual canonical prod origin] for Checkout success/cancel URLs ([contest-checkout.http.js](../../server/contests/contest-checkout.http.js)). |
| **Deliverable** | **[weekly-contests-gl-d3-checkout-redirect-origin.md](weekly-contests-gl-d3-checkout-redirect-origin.md)** (origin rules, URL shape, verification) |

**Description**

- Server builds **`success_url`** / **`cancel_url`** as **`{origin}/bio-ball/mlb?contestId=…&checkout=success|cancel`** — see [weekly-contests-gl-d3-checkout-redirect-origin.md](weekly-contests-gl-d3-checkout-redirect-origin.md).
- Set **`CONTESTS_CHECKOUT_APP_ORIGIN`** on **Cloud Run** (not baked into Angular); default **`cloudbuild.yaml`** deploy does **not** set this var — configure on the service so it survives deploys.
- **`GET /health`** includes **`contestsCheckoutAppOriginConfigured`** when the origin env is non-empty.

**Acceptance criteria**

- [ ] **`CONTESTS_CHECKOUT_APP_ORIGIN`** set to canonical prod **`https://…`** (no trailing slash) on production Cloud Run — recorded in ticket or [weekly-contests-gl-d3-checkout-redirect-origin.md](weekly-contests-gl-d3-checkout-redirect-origin.md) notes.
- [ ] **`GET /health`** shows **`contestsCheckoutAppOriginConfigured":true`** after deploy.
- [ ] Paid join completes redirect to **`/bio-ball/mlb?...`** with **`checkout=success`** (or cancel flow **`checkout=cancel`**); no mixed-content or wrong-host redirects.

---

### Story GL-D4 — Operator secrets for payout execute / automation

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Provision **`PAYOUT_OPERATOR_SECRET`** or **`CONTESTS_OPERATOR_SECRET`** (per ops docs) in prod for **`POST /api/internal/.../payouts/execute`** and automation hooks ([contest-payout-automation.http.js](../../server/contests/contest-payout-automation.http.js)). |

**Acceptance criteria**

- [ ] Secrets stored only in Secret Manager / encrypted env — not in repo.
- [ ] Dry-run call from bastion returns **401** without secret, **200** with valid secret on staging clone before prod.

---

### Story GL-D5 — Platform balance guard (optional prod parity)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Decide **`CONTEST_PAYOUT_BALANCE_GUARD_ENABLED`** for prod and document minimum platform balance monitoring ([weekly-contests-ops-p6-payout-execute.md](weekly-contests-ops-p6-payout-execute.md)). |

**Acceptance criteria**

- [ ] Runbook states what operators do on **409 `insufficient_platform_balance`**.

---

## Epic GL-E — Firestore security & client data boundaries

### Story GL-E1 — Rules review for production contest paths

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Review **`firestore.rules`** for `contests/*`, `entries/*`, `results/*`, `payouts/dryRun` — confirm **no** unintended client writes; **`payouts/final`** remains server-only ([firestore.rules](../../firestore.rules)). |

**Acceptance criteria**

- [ ] Rules deploy job included in release checklist.
- [ ] Pen-test or automated rules tests pass for anonymous vs signed-in reads.

---

### Story GL-E2 — Client-visible payout status vs `payouts/final` (gap closure)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Resolve mismatch: SPA subscribes to **`payouts/final`** for Stripe prize rail UI, but rules **deny** client read on **`final`** — choose one: (a) add **`payouts/status`** (or similar) doc with **safe** public fields only, (b) expose **`GET /api/v1/contests/:id/prize-status`**, or (c) remove client listener and show generic copy only. |

**Acceptance criteria**

- [ ] No dependency on blocked Firestore reads for critical user messaging **or** documented acceptance of degraded UX.
- [ ] No Stripe transfer ids / failure codes leaked to clients against policy.

---

## Epic GL-F — Observability & on-call

### Story GL-F1 — Log sinks + alerts for `contest_payments` / `contest_payouts` domains

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Route structured logs ([weekly-contests-phase5-observability.md](weekly-contests-phase5-observability.md), Phase 6 observability) to retained sink; alert on sustained webhook failures or payout execute errors. |

**Acceptance criteria**

- [ ] Dashboard or query shows error rate baseline week 1.
- [ ] On-call runbook links from [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md).

---

### Story GL-F2 — Stripe Dashboard operational access

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Ensure **least two** operators have Stripe prod access (Payments, Connect, Webhooks, Radar if used) with MFA; document break-glass if primary locked out. |

---

## Epic GL-G — Rollout & kill switches

### Story GL-G1 — Phased rollout plan (single contest / cohort)

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Define rollout: e.g. **one** paid contest, fee cap, monitored window; expansion criteria (no Sev-1 for N days). |

**Acceptance criteria**

- [ ] Written plan approved by product + eng.
- [ ] **`CONTESTS_PAYMENTS_ENABLED`** toggle procedure documented (API + SPA implications).

---

### Story GL-G2 — Kill switch drill

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Practice turning **`CONTESTS_PAYMENTS_ENABLED=false`** on API (and optionally Angular redeploy) within **15 minutes** SLO; verify Checkout returns **503** and webhooks still **200** noop per docs. |

**Acceptance criteria**

- [ ] Drill completed in staging with timestamped log excerpt.

---

## Epic GL-H — Post-launch validation

### Story GL-H1 — First live contest reconciliation

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Within **24h** of first live fee collection: reconcile **`ledgerEntries`**, Stripe Dashboard charges, and **`entries/{uid}.paymentStatus`** for sample uids. |

---

### Story GL-H2 — First live prize transfer reconciliation

| Field | Value |
|-------|-------|
| **Type** | Story |
| **Summary** | Within **24h** of first **`payouts/final`** execute: verify **`ledgerEntries`** outbound lines, Stripe **Transfer** ids, and winner bank-side receipt per support playbook. |

---

## Appendix — Quick dependency graph (recommended order)

1. **GL-A*** (legal) → **GL-B*** (staging QA)  
2. **GL-D1–D3** (API + Stripe live infra) + **GL-C1–C3** (SPA flags + publishable key) in tight coordination  
3. **GL-E*** (rules + payout visibility gap)  
4. **GL-G1** rollout → **GL-H*** reconciliation  

Kill switch **GL-G2** should be rehearsed before **GL-G1**.

---

## Appendix — Environment checklist (copy/paste for tickets)

| Variable / knob | Where | Prod live notes |
|-----------------|-------|-----------------|
| `CONTESTS_PAYMENTS_ENABLED` | Server **and** Angular CI | Must be **`true`** for paid UX + API — SPA [GL-C1](weekly-contests-gl-c1-production-paid-ui-build.md), Cloud Run [GL-D1](weekly-contests-gl-d1-api-contest-payments-enabled.md) |
| `STRIPE_SECRET_KEY` | Server | **`sk_live_…`** |
| `STRIPE_PUBLISHABLE_KEY` | Angular CI → `environment.prod.ts` | **`pk_live_…`** ([GL-C3](weekly-contests-gl-c3-stripe-publishable-key-prod-bundle.md)) |
| `STRIPE_WEBHOOK_SECRET` | Server | Live **`whsec_…`** ([GL-D2](weekly-contests-gl-d2-stripe-webhook-live.md)) |
| `CONTESTS_CHECKOUT_APP_ORIGIN` | Server | Canonical **`https://…`** ([GL-D3](weekly-contests-gl-d3-checkout-redirect-origin.md)) |
| `SIMULATED_CONTESTS_UI_ENABLED` | Angular CI | Prod: **`true`** only when explicit ([GL-C2](weekly-contests-gl-c2-simulated-contests-ui-build.md)); default empty / omitted |
| `PAYOUT_OPERATOR_SECRET` / `CONTESTS_OPERATOR_SECRET` | Server | Payout execute / automation |
| `CONTEST_PAYOUT_BALANCE_GUARD_ENABLED` | Server | Optional prod parity |
