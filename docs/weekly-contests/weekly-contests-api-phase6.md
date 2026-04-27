# Weekly contests API — Phase 6 (payouts / Connect)

**Status:** Stories **P6-B2** (Connect onboarding URL), **P6-B3** (`account.updated` webhook → `users/{uid}`), **P6-G1** (admin read payout status), and **P6-G2** (admin hold / resume / retry) implemented.  
**Related:** [weekly-contests-phase6-payouts-adr.md](weekly-contests-phase6-payouts-adr.md), [weekly-contests-schema-users-payouts.md](weekly-contests-schema-users-payouts.md) (P6-C1), [stripe.md](../payments/stripe.md) (Connect appendix), [weekly-contests-phase6-payouts-ux.md](weekly-contests-phase6-payouts-ux.md)

---

## `POST /api/v1/me/stripe/connect/onboarding`

Returns a **Stripe-hosted Account Link** URL so the signed-in user can complete or refresh **Stripe Connect Express** onboarding for contest payouts. The server creates a connected account (`acct_…`) when needed, stores **`stripeConnectAccountId`** (and related fields) on **`users/{uid}`** via Admin SDK, and reuses the same account on later calls.

| | |
|---|--------|
| **Auth** | Firebase ID token (`Authorization: Bearer`). |
| **Rate limit** | Per **uid**, fixed window — env `STRIPE_CONNECT_ONBOARDING_RATE_LIMIT_*` (see below). |
| **Feature flag** | Same as paid checkout: requires **`CONTESTS_PAYMENTS_ENABLED=true`**, **`STRIPE_SECRET_KEY`**, and **`CONTESTS_CHECKOUT_APP_ORIGIN`** for `return_url` / `refresh_url`. |

### Request

- **Body (JSON, optional):**

| Field | Type | Description |
|-------|------|-------------|
| `forceAccountUpdate` | boolean | When the Connect profile is **already complete**, set `true` to obtain an **`account_update`** link (e.g. bank / tax changes). Omit or `false` when not complete, or when requesting first-time onboarding. |

### Success — `200 OK`

```json
{
  "schemaVersion": 1,
  "url": "https://connect.stripe.com/setup/s/…"
}
```

- **`url`** — one-time hosted URL; redirect the browser here (same-tab redirect is typical).

### Errors

| HTTP | `error.code` | When |
|------|----------------|------|
| **401** | `unauthenticated` | Missing or invalid Firebase token. |
| **403** | `email_not_verified` | Verified email required (same policy as contest checkout unless `CONTESTS_REQUIRE_EMAIL_VERIFIED=false`). |
| **403** | `stripe_connect_forbidden` | Stored `acct_…` metadata does not match this user (operator / data issue). |
| **400** | `validation_error` | Invalid JSON body (unknown keys or wrong types). |
| **409** | `connect_already_complete` | Onboarding is already complete and **`forceAccountUpdate`** was not `true`. |
| **429** | `rate_limited` | Too many requests; may include `retryAfterSec`. |
| **502** | `stripe_connect_failed` | Stripe API error (create account, retrieve, or account link). |
| **503** | `contest_payments_disabled` | `CONTESTS_PAYMENTS_ENABLED` is not `true`. |
| **503** | `stripe_not_configured` | No usable `STRIPE_SECRET_KEY` (same shape as Phase 5 checkout). |
| **503** | `server_misconfigured` | Firestore unavailable, or **`CONTESTS_CHECKOUT_APP_ORIGIN`** unset. |

### Redirect URLs (server-built)

- **`return_url`:** `/account/payout-setup?payout_setup=success`
- **`refresh_url`:** `/account/payout-setup?payout_setup=refresh`

Base origin from **`CONTESTS_CHECKOUT_APP_ORIGIN`** (no trailing slash), aligned with [weekly-contests-phase6-payouts-ux.md](weekly-contests-phase6-payouts-ux.md) query params.

### Rate limit environment variables

| Variable | Default | Meaning |
|----------|---------|--------|
| `STRIPE_CONNECT_ONBOARDING_RATE_LIMIT_WINDOW_MS` | `60000` | Fixed window length (ms). |
| `STRIPE_CONNECT_ONBOARDING_RATE_LIMIT_MAX` | `15` | Max requests per uid per window. |

Global disable: `RATE_LIMITS_DISABLED=true` (same as other Express rate limits).

### Firestore

Connect payout snapshot fields on **`users/{uid}`** are **not client-writable** — see `firestore.rules` (P6-B2 / P6-B3) and the field reference [weekly-contests-schema-users-payouts.md](weekly-contests-schema-users-payouts.md).

### Webhooks (P6-B3)

Stripe **`account.updated`** for connected accounts is handled on the same endpoint as Phase 5 — **`POST /api/v1/webhooks/stripe`** — when **`CONTESTS_PAYMENTS_ENABLED=true`**. Idempotency uses **`processedStripeEvents/{event.id}`** (shared collection). Event list and outcomes: [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md) (Phase 6 Connect section).

---

## Admin read — payout status (Story P6-G1)

**Auth:** Firebase ID token + **`admin: true`** custom claim (same as other **`/api/v1/admin/*`** routes). **Rate limit:** contest-read hook.

**PII:** Responses omit Auth email. **`stripeConnectAccountId`** is never returned raw — use **`stripeConnectAccountIdMasked`** (prefix + last 4). Transfer / charge ids on ledger lines are masked the same way.

### `GET /api/v1/admin/contests/:contestId/payout-status`

Contest-level snapshot: **`contests.status`**, optional **`prizePayoutStatus`**, **`payouts/dryRun`** (numeric lines), **`payouts/final`** execution lines with **masked** `tr_…` ids.

| HTTP | `error.code` | When |
|------|----------------|------|
| **400** | `validation_error` | Bad `contestId` path segment. |
| **404** | `contest_not_found` | No `contests/{contestId}` doc. |
| **429** | `rate_limited` | Too many reads. |

### `GET /api/v1/admin/contests/:contestId/users/:targetUid/payout-status`

Answers **“was user `targetUid` paid a prize for contest `contestId`?”** from **`prize.prizePaidOutViaStripeTransfer`** plus human-readable **`supportOneLiner`**. Includes **`entries/{targetUid}`** payment status (entry fee / free entry), matching **`payouts/dryRun`** line, masked **`payouts/final`** line for that uid, **Connect** mirror fields (masked account id), and **`recentLedgerLinesForContest`** (`ledgerEntries` filtered to this contest, newest first; uses existing **`uid` + `createdAt`** index).

| HTTP | `error.code` | When |
|------|----------------|------|
| **400** | `validation_error` | Bad path params. |
| **404** | `contest_not_found` | Contest missing (`targetUid` need not have an entry doc). |
| **429** | `rate_limited` | Too many reads. |

**Implementation:** [`server/admin/admin-payouts.http.js`](../../server/admin/admin-payouts.http.js), [`server/admin/admin-payouts.http.test.js`](../../server/admin/admin-payouts.http.test.js), routes in [`index.js`](../../index.js).

---

## Admin mutations — hold / resume / retry (Story P6-G2)

**Auth:** Firebase ID token + **`admin: true`**. **Rate limit:** contest-read hook.

**Contest fields:** **`payoutHoldReason`**, **`heldByAdminUid`**, **`heldAt`** (Timestamp) are set on **hold** and cleared on **resume**. **`prizePayoutStatus`** becomes **`held`** / **`scheduled`** per [ADR `prizePayoutStatus` table](weekly-contests-phase6-payouts-adr.md#contest-level-prize-payout-status-prizepayoutstatus). Prize **execute** (`POST …/payout-execute` and internal execute) returns **`409`** with **`payout_held`** while held.

**Audit:** each mutation appends **`ledgerEntries/{id}`** with **`lineType: other`**, **`amountCents: 0`**, **`source: admin_adjustment`**, **`metadata.action`**, and the authenticated admin’s **`uid`** on the ledger row (see ADR).

### `POST /api/v1/admin/contests/:contestId/payout-hold`

| Field | Type | Required |
|-------|------|----------|
| `force` | literal **`true`** | Yes |
| `reason` | string (4–500 chars) | Yes |

### `POST /api/v1/admin/contests/:contestId/payout-resume`

| Field | Type | Required |
|-------|------|----------|
| `force` | literal **`true`** | Yes |
| `reason` | string (≤500) | No |

### `POST /api/v1/admin/contests/:contestId/payout-retry-failed`

Requires **`CONTESTS_PAYMENTS_ENABLED=true`** and Stripe (same as payout execute). Retries only **`payouts/final`** lines with **`status: failed`**, **`amountCents > 0`**, and **no** `stripeTransferId`, using the same Stripe **idempotency key** as initial execute. Optional **`rank`** / **`uid`** restrict to one line.

| Field | Type | Required |
|-------|------|----------|
| `force` | literal **`true`** | Yes |
| `reason` | string (4–500 chars) | Yes |
| `rank` | positive int | No |
| `uid` | string | No |

**Implementation:** [`server/contests/contest-payout-admin-actions.job.js`](../../server/contests/contest-payout-admin-actions.job.js), [`contest-payout-admin-actions.job.test.js`](../../server/contests/contest-payout-admin-actions.job.test.js), POST handlers in [`server/admin/admin-payouts.http.js`](../../server/admin/admin-payouts.http.js), [`contest-payout-execute.job.js`](../../server/contests/contest-payout-execute.job.js) (hold gate + **`prizePayoutStatus`** on execute commit).

---

## References

- Phase 5 payments API: [weekly-contests-api-phase5.md](weekly-contests-api-phase5.md)
- Webhooks (Connect additions in P6-B3): [weekly-contests-phase5-webhooks.md](weekly-contests-phase5-webhooks.md)
