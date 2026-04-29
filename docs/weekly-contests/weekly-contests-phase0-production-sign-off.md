# Phase 0 — Production sign-off (paid entry + prizes)

**Story:** GL-A1 ([weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md))  
**Purpose:** Single **record** that **product**, **engineering**, and **legal/compliance** have aligned published contest rules, fees, refunds, prize eligibility, and jurisdictional posture **before** Stripe **live** keys and real-money prize rails — satisfying Phase 0 gates in:

- [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md) § Phase 0  
- [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md) § Phase 0 — Legal / product gate  

**Status:** Template — **do not** treat as approved until all required signatures and dates are filled.

**Related:** [product-roadmap-contests-and-payments.md](../product/product-roadmap-contests-and-payments.md) § Phase 0, [stripe.md](../payments/stripe.md), in-app printable rules [`src/assets/contests/weekly-contests-rules.html`](../../src/assets/contests/weekly-contests-rules.html) (linked from contests UI via `CONTEST_FULL_RULES_HREF`).

---

## 1. Scope acknowledged

| Topic | Included in this sign-off |
|-------|---------------------------|
| **Paid entry** | Contest entry fees via Stripe Checkout; webhook-authoritative `paymentStatus`; Phase 5 ledger semantics |
| **Prizes** | Outbound prize transfers via Stripe Connect (Express) per Phase 6 ADR |
| **Published surfaces** | Printable weekly contest rules asset above; contest cards / Bio Ball strip copy; hero/disclaimer text tied to `simulatedContestsUiEnabled` vs live builds |

**Out of scope here (track separately):** operational runbooks, Stripe Dashboard configuration, tax automation ([Story GL-A2](weekly-contests-production-go-live-jira.md#story-gl-a2--tax--1099--winner-reporting-posture-document-only-v1)), engineering-only staging QA ([Epic GL-B](weekly-contests-production-go-live-jira.md#epic-gl-b--staging-proof-before-prod-keys)).

---

## 2. Pre-sign-off checklist (evidence)

Reviewers confirm the following **before** signing:

| # | Item | Owner | Evidence / link | Done |
|---|------|--------|-----------------|------|
| C1 | **Jurisdictions** — Where entrants may play and receive prizes is documented (e.g. US-only or listed regions). | Legal + Product | *(link or appendix)* | ☐ |
| C2 | **Skill vs sweepstakes / gambling** — Product/legal classification for Bio Ball weekly contests is documented; marketing matches. | Legal | *(memo or ticket)* | ☐ |
| C3 | **Terms of Service & Privacy Policy** — Published URLs apply to contest participants; contest-specific terms incorporated by reference where required. | Legal | *(URLs + version/date)* | ☐ |
| C4 | **Contest rules** — [`weekly-contests-rules.html`](../../src/assets/contests/weekly-contests-rules.html) (or successor) matches counsel-approved text for fees, slate, scoring, ties, voids. | Product + Legal | *(diff review or PDF hash)* | ☐ |
| C5 | **Refund & cancellation policy** — Aligns with Phase 5 webhook/refund hooks and operator process ([phase5 entry-fees ADR](weekly-contests-phase5-entry-fees-adr.md#refunds)). | Legal + Product | *(section in ToS or rules)* | ☐ |
| C6 | **Prize eligibility** — Age, account verification, Connect onboarding, and exclusion cases match [Phase 6 payouts ADR](weekly-contests-phase6-payouts-adr.md) and [payouts UX](weekly-contests-phase6-payouts-ux.md). | Product + Legal | *(summary)* | ☐ |
| C7 | **Express Connect** — Legal acceptance of Stripe Express program terms for winners (per Phase 6 ADR). | Legal | *(confirm)* | ☐ |
| C8 | **Engineering alignment** — Server enforcement (fees, metadata, idempotency) matches what legal believes we promise; no silent client trust for money. | Engineering | *(link to ADR + key API names)* | ☐ |

---

## 3. Role sign-off (required)

Sign only when **Section 2** is complete to your satisfaction for your domain.

| Role | Name | Date (ISO) | Signature / initials | Notes |
|------|------|------------|----------------------|-------|
| **Product** | | | | Confirms user-facing copy, cohorts, and fee/prize mechanics match intent |
| **Engineering** | | | | Confirms implementation matches ADRs and no PAN/full card storage ([stripe.md](../payments/stripe.md)) |
| **Legal / Compliance** | | | | Confirms C1–C7 for target jurisdictions before live Stripe |

**Optional — Finance / Tax** (recommended before large prizes):

| Role | Name | Date (ISO) | Notes |
|------|------|------------|-------|
| **Finance / Tax** | | | Threshold posture per Phase 6 Phase 0 gate; may defer detail to [GL-A2](weekly-contests-production-go-live-jira.md#story-gl-a2--tax--1099--winner-reporting-posture-document-only-v1) |

---

## 4. Waiver / deferral register

Any Phase 0 item **not** fully satisfied before live keys must be listed here with an owner — **no blank waivers**.

| Item ID | Gap | Risk summary | Mitigation | Owner | Approved by (role) | Date |
|---------|-----|--------------|------------|-------|-------------------|------|
| *(none)* | | | | | | |

---

## 5. Engineering activation note (after signatures)

**Do not** enable Stripe **live** secret keys, production **`CONTESTS_PAYMENTS_ENABLED`**, or live Connect settlement until:

1. Required rows in **Section 3** are filled, **and**  
2. **Section 4** is empty **or** every row has **Approved by** + **Date**.

Follow [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md) for build flags and runtime env.

---

## 6. Revision history

| Version | Date | Change |
|---------|------|--------|
| 1.0 | *(fill)* | Initial Phase 0 production sign-off template (Story GL-A1) |
