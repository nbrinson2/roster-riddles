# Phase 6 — Payouts: product copy & UX spec (winner onboarding + status)

**Status:** Draft (product copy — engineering + **product owner** sign-off before shipping UI)  
**Implements:** [weekly-contests-phase6-payouts-jira.md](weekly-contests-phase6-payouts-jira.md) Story **P6-A2**  
**Depends on:** [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md) (P6-A1), [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md) (entry semantics)

---

## Goals

- Winners understand **what to do next** (e.g. complete Stripe Connect) **without** opening Stripe Dashboard themselves.
- The app surfaces **only** prize-relevant status that is **safe for the client** (see [PII & client data boundaries](#pii--client-data-boundaries)).
- **Support** can answer common questions using **Firestore field names** documented below, before escalating to finance / Stripe.

---

## PII & client data boundaries

| Data | Client (SPA) | Rationale |
|------|----------------|-----------|
| **Contest title, `status`, `prizePayoutStatus`** (when added per ADR) | OK to show | Public / semi-public contest context. |
| **User’s own** Connect onboarding state (e.g. `needsAction`, `complete`) | OK when derived from **server API** that strips Stripe internals | Never expose full `acct_…` in UI unless product explicitly wants “last 4 of account id” style — **default: do not show** `acct_`. |
| **Winner prize row** for **current user** only: `amountCents`, `rank`, contest id | OK from **server-shaped DTO** | Same sensitivity as “you won $X” in email. |
| **Other users’** emails, bank last4, tax IDs, Stripe **full** account ids | **Do not** expose | Use existing display rules for names where needed ([leaderboards-duplicate-accounts-f2.md](../leaderboards/leaderboards-duplicate-accounts-f2.md) for verified-email policy if you mirror standings). |
| **Raw `ledgerEntries`** | **Never** client-readable | [weekly-contests-phase5-ledger-schema.md](weekly-contests-phase5-ledger-schema.md) — support uses admin tools / BigQuery later. |

**Copy rule:** Prefer **“Your prize”**, **“Prize setup”**, **“We’re processing your payout”** — avoid **“Stripe account”** in user-facing primary copy unless A/B testing shows clarity wins; optional secondary text: “We partner with Stripe to send your prize.”

---

## Surfaces (where UX appears)

| Surface | When shown | Primary job |
|---------|------------|-------------|
| **Contest detail** (weekly contest drawer or detail route) | User is an **entrant** and contest is **`paid`** (or has prize workflow) | Explain **contest-level** `prizePayoutStatus` + CTA if user must complete onboarding. |
| **Profile / Account — “Prizes & payouts”** (or subsection under Profile) | Any signed-in user who may receive prizes | **Global** Connect onboarding + link to Stripe refresh if requirements change. |
| **Post–Connect return** (dedicated route, e.g. `/account/payout-setup?from=stripe`) | After Stripe-hosted onboarding redirect | Confirm success, soft-pedal errors, link back to contest. |
| **Toast / banner (global)** | Optional: one-time after return from Stripe | Reinforce “We’re verifying your details” without blocking entire app. |

Implementation may merge **contest detail** + **profile** into v1 if scope is tight; this doc still lists both so copy is reusable.

---

## User-visible states (v1 matrix)

Engineering maps **server fields** → one of these **UX buckets**. Names are **product-facing buckets**, not Firestore literals.

| UX bucket | Typical server signals (illustrative — finalize in P6-B/C) | User should feel |
|-----------|--------------------------------------------------------------|--------------------|
| **A — Not applicable** | User did not win prize money (`dryRun` line `amountCents === 0` for their rank) or contest not `paid` | Neutral; no prize module. |
| **B — Prize pending setup** | User has **non-zero** prize line + Connect **not** ready (`detailsSubmitted === false` or `charges_enabled === false`) | “Action required” — **one clear CTA**: “Set up prize payouts”. |
| **C — Under review** | Connect submitted; Stripe **`requirements.currently_due`** non-empty or account `pending` | Reassurance; **no** second full onboarding unless refresh link required. |
| **D — Payout processing** | `prizePayoutStatus` in `scheduled` / `in_progress` + user line not terminal | Patience; set expectation **1–5 business days** (product to pick honest range). |
| **E — Paid** | Execution line / webhook says **succeeded** for user’s transfer | Celebration; where to see bank deposit (generic: “Funds sent to your linked account”). |
| **F — Held / needs support** | `prizePayoutStatus === held` or user line `failed` with retry exhausted | Calm; **Contact support** with **no blame** language. |
| **G — Failed recoverable** | Stripe error classified as **user-fixable** (e.g. bank rejected) | Clear next steps + CTA to update payout details in Stripe-hosted flow. |

---

## Copy blocks (English — v1 defaults)

Tone: **short**, **plain**, **no legalese** in primary text; link **Rules / FAQ** for policy.

### B — Prize pending setup (banner on contest)

- **Title:** `Set up your prize payout`
- **Body:** `You won a prize in this contest. To receive it, complete a one-time secure setup with our payments partner.`
- **Primary CTA:** `Continue`
- **Secondary:** `Not now` (dismisses banner until next session or 24h — product choice)

### C — Under review

- **Title:** `We’re reviewing your payout details`
- **Body:** `Thanks — we received your information. This usually takes a short time. We’ll email you when it’s done.`
- **Primary CTA:** `Back to contest` / `OK`

### D — Processing

- **Title:** `Your prize is on the way`
- **Body:** `We’re sending your payout. This can take a few business days depending on your bank.`
- **CTA:** none or `Dismiss`

### E — Paid

- **Title:** `Prize sent`
- **Body:** `Your prize payout has been sent. It may take a little time to appear in your bank account.`
- **CTA:** `Done`

### F — Held / support

- **Title:** `We need a quick hand to finish your payout`
- **Body:** `Something paused your prize payout. Our support team can help — you don’t need to do anything right now unless we email you.`
- **Primary CTA:** `Contact support` (mailto or in-app form)

### G — Failed (recoverable)

- **Title:** `Update your payout details`
- **Body:** `Your bank or card issuer couldn’t accept the transfer. Update your details to try again.`
- **Primary CTA:** `Update details` (re-open Account Link / Stripe refresh — P6-B2)

---

## Stripe Connect return URL UX (deep link)

**Assumption:** Server creates Account Link with `return_url` and `refresh_url` pointing to the SPA (see [stripe.md](../payments/stripe.md) patterns for Checkout — same discipline).

| Query / fragment (example) | Meaning | UI |
|----------------------------|---------|-----|
| `?payout_setup=success` | Stripe reports return after successful flow | Show **E** micro-state or **C** if webhooks lag — prefer **optimistic “Thanks”** + poll server once. |
| `?payout_setup=refresh` | User hit **refresh** link or session expired | Show short message: “That link expired. Tap below to continue.” + **Primary CTA** to request a **new** link (server call). |
| `?payout_setup=cancel` | User closed Stripe tab (if detectable) or explicit cancel | Non-judgmental: “You can finish setup anytime from your profile.” |

**Do not** put Stripe **secrets** or **PII** in query strings.

---

## Optional transactional email (product)

If product enables email (Firebase Extension, SendGrid, etc.), keep **parity** with in-app states **B–G**.

| Trigger | Subject (example) | Body one-liner |
|---------|-------------------|----------------|
| Won prize, needs Connect | `Roster Riddles: claim your contest prize` | `Complete a short secure setup so we can send your prize.` |
| Payout sent | `Your contest prize is on the way` | `We’ve sent your payout; bank timing may vary.` |
| Action required (held) | `We need help finishing your prize payout` | `Reply to this email or open the app — our team can assist.` |

**Unsubscribe:** Only if these are marketing; transactional may be exempt — **Legal** decides.

---

## Support playbook (no Stripe Dashboard required for tier 1)

**Tier 1** may read (via **admin** or support tooling — not end-user Firestore console for production):

| Question | Fields to check | What to say (script) |
|----------|-----------------|----------------------|
| “Did I win money?” | User’s row in `payouts/dryRun.lines` for `contestId` | “You placed **rank X**. Your line shows **$Y.YY** intended prize, or **$0** if no prize for that rank.” |
| “Why no payout yet?” | `contests.prizePayoutStatus`, user Connect summary | “The contest shows **processing / on hold**. If you haven’t finished **one-time setup**, open the app → **Profile → Prizes**.” |
| “Is it stuck?” | `prizePayoutStatus === held` or execution doc `failed` | “I see a **pause** on our side. I’m escalating to **payouts** — you’ll get an update by **[SLA]**.” |

**Escalate to Stripe / finance** when: reversal, dispute, wrong amount, or ledger mismatch — [Phase 6 ADR](weekly-contests-phase6-payouts-adr.md) void / correction section; disputes / chargebacks: [weekly-contests-phase6-disputes-runbook.md](weekly-contests-phase6-disputes-runbook.md) (P6-F2).

---

## Accessibility & i18n

- **Focus order:** After Connect redirect, focus moves to **H1** “Thanks” or status message (WCAG 2.4.3).
- **Color:** Do not rely on green/red alone for state — include **icon + text**.
- **i18n:** Externalize strings; **dates** and **currency** use `Intl` with **USD** for v1.

---

## Product owner sign-off

| Item | Owner | Status | Date |
|------|--------|--------|------|
| Copy tone (friendly vs formal) | Product | Pending | |
| Business-day SLA in copy | Product | Pending | |
| Show “Stripe” by name Y/N | Product | Pending | |
| Email triggers Y/N | Product | Pending | |

---

## References

- [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md) — includes **Stripe Connect (Express)** model (P6-B1)  
- [product-roadmap-contests-and-payments.md](../product/product-roadmap-contests-and-payments.md) — Phase 6  
- [leaderboards-duplicate-accounts-f2.md](../leaderboards/leaderboards-duplicate-accounts-f2.md) — verified email policy (optional for prizes)  
