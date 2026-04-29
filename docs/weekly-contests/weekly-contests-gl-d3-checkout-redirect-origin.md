# Story GL-D3 — Checkout redirect origin (`CONTESTS_CHECKOUT_APP_ORIGIN`)

**Story:** **GL-D3** in [weekly-contests-production-go-live-jira.md](weekly-contests-production-go-live-jira.md) (Epic **GL-D** — Production server runtime).

**Purpose:** Set **`CONTESTS_CHECKOUT_APP_ORIGIN`** on the **Express / Cloud Run** service to the **canonical public HTTPS origin** where users load the Angular app — so Stripe Checkout **success** and **cancel** redirects return to your SPA (and Phase 6 Connect **Account Link** return/refresh URLs resolve correctly).

## Rules

| Rule | Detail |
|------|--------|
| **Shape** | **Scheme + host** only, e.g. **`https://rosterriddles.com`** or **`https://www.example.com`**. |
| **No trailing slash** | Server strips a trailing `/` before building URLs ([`contest-checkout.http.js`](../../server/contests/contest-checkout.http.js)). |
| **Must match the real SPA** | Same origin users use in the browser for Bio Ball / contests — otherwise redirects land on the wrong host or path. Align with **[GL-B1](weekly-contests-gl-b1-phase5-staging-evidence.md)** stable SPA URL for staging. |

## What the server builds

Checkout session **`success_url`** / **`cancel_url`** use **`buildStripeCheckoutReturnUrl`**:

- Path: **`/bio-ball/mlb`** with query **`contestId`**, **`checkout=success`** or **`checkout=cancel`**.

Example success URL:

`https://<origin>/bio-ball/mlb?contestId=<id>&checkout=success`

Phase 6 Connect onboarding uses the same **`CONTESTS_CHECKOUT_APP_ORIGIN`** for return/refresh URLs ([`stripe-connect-onboarding.http.js`](../../server/payments/stripe-connect-onboarding.http.js)).

## Runtime configuration

| Surface | Notes |
|---------|--------|
| **Cloud Run** | Set **`CONTESTS_CHECKOUT_APP_ORIGIN`** as an environment variable (value is the URL string — not a secret). Configure in console, Terraform, or **add** to your deploy pipeline **without** clearing it to empty. |
| **`cloudbuild.yaml`** | Deploy step currently updates **`CONTESTS_PAYMENTS_ENABLED`** only — **checkout origin is not** set by this repo’s default YAML; set **`CONTESTS_CHECKOUT_APP_ORIGIN`** on the service separately so prod keeps the canonical URL across deploys. |

## Misconfiguration

| Symptom | Likely cause |
|---------|----------------|
| **503** `server_misconfigured` on **`POST …/checkout-session`** with **`checkout_origin_missing`** | **`CONTESTS_CHECKOUT_APP_ORIGIN`** unset or whitespace-only |
| Redirect to wrong host / mixed content | Origin **`http://`** in prod where the site is **`https://`**, or typo vs real DNS |

## Verification (acceptance)

1. **`GET /health`** includes **`contestsCheckoutAppOriginConfigured":true`** once the var is set (boolean only — Story GL-D1 / GL-D3).
2. **Paid join:** Complete a test Checkout in **test** or **live** mode; browser returns to **`/bio-ball/mlb?...&checkout=success`** on the **same** host as the SPA; **cancel** returns with **`checkout=cancel`**. No cross-origin oddities.

## References

- [`server/contests/contest-checkout.http.js`](../../server/contests/contest-checkout.http.js) — `buildStripeCheckoutReturnUrl`, session creation
- [`docs/payments/stripe.md`](../payments/stripe.md)
- [`docs/weekly-contests/weekly-contests-api-phase5.md`](weekly-contests-api-phase5.md)
