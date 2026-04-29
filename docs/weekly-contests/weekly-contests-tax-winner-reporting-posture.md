# Tax / 1099 / winner reporting posture (document-only v1)

**Story:** GL-A2 ([weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md))  
**Purpose:** Record **v1** **operational and support** posture for **US-oriented** tax information reporting for weekly contest **prize** payouts (Stripe **Connect** + **Transfers**). **No** in-app tax automation, **no** withholding logic in Roster Riddles v1 — this doc is the **single** engineering + ops reference until finance/legal replace it with a versioned policy.

**Status:** Template — thresholds and filing obligations **change** (IRS + Stripe). **Re-validate annually** with a qualified accountant.

**Disclaimer:** This is **not** tax, legal, or accounting advice. **Legal + Finance** own final positions; engineering implements **no** tax math in the app for v1.

**Related:** [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md) (Phase 0 — Winner KYC / tax), [weekly-contests-schema-users-payouts.md](weekly-contests-schema-users-payouts.md) (no tax IDs in Firestore), [stripe.md](../payments/stripe.md) (Connect), [weekly-contests-phase0-production-sign-off.md](weekly-contests-phase0-production-sign-off.md) (optional Finance row).

---

## 1. Architecture reminder (who holds what)

| Party | Role in v1 |
|--------|----------------|
| **Platform** (Roster Riddles Stripe account) | Collects **entry fees** (Phase 5) and may receive **Form 1099-K** (or successor) for **payment processing** volume — **product of Stripe + IRS rules**, not of contest rules alone. See [Stripe: US tax reporting for platforms](https://docs.stripe.com/connect/tax-reporting) (current product names and years). |
| **Winners** (Connect **Express** **connected accounts**) | Receive **prize** funds via **`transfers.create`** to `acct_…`. Stripe may issue **1099**-series forms to **connected accounts** when reporting thresholds are met; **KYC and tax ID** live in **Stripe**, not in our Firestore ([weekly-contests-schema-users-payouts.md](weekly-contests-schema-users-payouts.md)). |
| **Roster Riddles app** | **Does not** store full tax IDs, bank account numbers, or file 1099s. **Server** stores Stripe object **ids** and **mirrors** (e.g. `stripeConnectAccountId`) for routing and support. |

**Engineering rule:** Do **not** add Firestore fields for SSN/EIN or US tax withholding without a new ADR + legal sign-off.

---

## 2. US information returns (high level — confirm with advisor)

| Form (common context) | Typical role | v1 posture |
|-------------------------|--------------|------------|
| **1099-K (or IRS successor)** | Payment card / third-party network transactions — often discussed in context of **platform** **gross** payment volume to **reportable** payees. | **Finance** monitors Stripe Dashboard **tax** / **reporting** sections yearly; platform follows Stripe’s **filing** where Stripe is the **PSP** for the platform business. **Do not** quote dollar thresholds in this repo — they **change**. |
| **1099-NEC** / **1099-MISC** | **Non-employee compensation** and other payments. Connect **recipients** may receive forms from **Stripe** (or the platform, depending on program — see Stripe docs) when **payment** reporting thresholds apply to **their** connected activity. | **Winners** directed to **Stripe Express Dashboard** (or Stripe-delivered docs) for **their** tax documents — **Support** uses scripts in §5. |
| **W-9** | US **payor** may need **TIN** before certain payments. | **Collected in Stripe-hosted Connect onboarding** — **not** duplicated in our DB. |

**Action:** Each **January**, Finance runs a **checklist**: Stripe Dashboard → Tax / Reporting → Download center (labels evolve); compare **samples** to **`ledgerEntries`** + **`payouts/final`** for the prior calendar year for **reconciliation**, not for DIY legal conclusions.

---

## 3. Operational plan v1 (no product code)

| Cadence | Owner | Activity |
|---------|--------|----------|
| **Annual** (Jan–Feb) | Finance + Legal | Confirm which Stripe **reports** and **IRS** forms apply to **platform** vs **connected accounts** for the **prior** year; archive Stripe CSV/PDF exports with **version note**. |
| **Quarterly** (optional until volume warrants) | Finance | Spot-check **Balance transactions** + **Connect** → **Transfers** vs **`ledgerEntries`** line types for prize outbounds (`prize_transfer` / names in [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md)). |
| **Per escalation** | Support → Finance | Wrong amount, missing 1099, identity mismatch — **no** tier-1 guess on tax liability; escalate per §5. |

**Automation deferred:** No BigQuery sync, no Cron to IRS — **v2** candidate after first full **live** calendar year.

---

## 4. Stripe Dashboard vs manual reconciliation

| Source | Use |
|--------|-----|
| **Stripe Dashboard** | Authoritative for **what Stripe filed or will file** for the **platform** account and for **Connect** tax docs offered to connected users (UI varies by year — follow in-dashboard help). |
| **`ledgerEntries` / `payouts/final`** | Authoritative for **what we intended** to pay per contest; use for **internal** audit and **support** answers (“amount on line X”). |
| **Discrepancy** | **Finance** opens Stripe **ticket** or **Support** uses [weekly-contests-phase6-disputes-runbook.md](weekly-contests-phase6-disputes-runbook.md) — **not** a coding task in v1. |

External doc pointer (Stripe-maintained): **[Tax reporting](https://docs.stripe.com/connect/tax-reporting)** and Connect **1099** help — **bookmark** the current **Reporting** hub from the Dashboard footer.

---

## 5. Support scripts (tier 1 — tax questions)

Use **plain** language; **do not** promise a specific IRS outcome.

| User question | What to say (v1) |
|---------------|------------------|
| “Will I get a 1099 for my prize?” | “Prize payouts go through **Stripe**. Tax forms, if any, are handled according to **Stripe’s** and **IRS** rules for your account. Please check **Stripe’s emails** or your **Stripe Express** link from onboarding — we can’t see your full tax profile.” |
| “Why doesn’t my 1099 match the app?” | “The app shows **contest results** and **payout status**. **Official** tax forms come from **Stripe** / your bank timing may differ. I’m escalating to **finance** with your **uid** and **contest id**.” |
| “Can you send me a W-9?” | “We don’t collect tax forms in the app. **Stripe** collects what’s needed when you **complete prize setup**. If something failed, we can **send a fresh onboarding link** — I’ll verify your account state.” |
| “I’m international.” | “**v1** prizes are **USD** / US-flow oriented. I’m escalating — **do not** promise cross-border tax treatment.” |

**Escalate** any question about **penalties**, **amending returns**, or **legal classification** of contests **before** answering — Legal / Finance only.

---

## 6. Cross-links (acceptance)

- [x] **One addendum** under `docs/weekly-contests/` (this file).
- [x] Linked from **[stripe.md](../payments/stripe.md)** (Connect appendix).
- [x] Linked from **[weekly-contests-phase6-payouts-ux.md](weekly-contests-phase6-payouts-ux.md)** (Support playbook).
- [x] **[weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md)** Story **GL-A2** deliverable field.

---

## 7. Revision history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | *(fill)* | GL-A2 document-only v1 — thresholds deferred to Finance + Stripe Dashboard |
