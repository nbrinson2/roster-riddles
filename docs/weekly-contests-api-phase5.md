# Weekly contests API — Phase 5 (payments)

**Status:** Stories P5-D1 (`checkout-session`), P5-D2 (Angular Checkout redirect + confirming UI) implemented; webhook business logic in P5-E.  
**Related:** [weekly-contests-phase5-entry-fees-adr.md](weekly-contests-phase5-entry-fees-adr.md), [stripe.md](stripe.md)

---

## `POST /api/v1/contests/:contestId/checkout-session`

Creates a **Stripe Checkout Session** (`mode: payment`) so the caller can redirect the user to Stripe to pay the contest **entry fee**. **Does not** create a Firestore entry — that happens after a **verified webhook** (P5-E). **Do not** treat the client return URL as proof of payment.

| | |
|---|--------|
| **Auth** | Firebase ID token (`Authorization: Bearer`). |
| **Rate limit** | Same as `POST .../join` — per **uid**, fixed window ([weekly-contests-api-c1.md](weekly-contests-api-c1.md)). |
| **Feature flag** | Requires `CONTESTS_PAYMENTS_ENABLED=true` and `STRIPE_SECRET_KEY`; requires `CONTESTS_CHECKOUT_APP_ORIGIN` for success/cancel URLs. |

### Request

- **Path:** `contestId` — same charset rules as join ([weekly-contests-api-c1.md](weekly-contests-api-c1.md)).
- **Body (JSON, optional):**

| Field | Type | Description |
|-------|------|-------------|
| `clientRequestId` | string | Optional support / logging id (8–200 chars). |

### Success — `200 OK`

```json
{
  "schemaVersion": 1,
  "url": "https://checkout.stripe.com/c/pay/cs_test_...",
  "sessionId": "cs_test_..."
}
```

- **`url`** — redirect the browser here (or open in same tab).
- **`sessionId`** — Stripe Checkout Session id (`cs_...`).

### Errors

| HTTP | `error.code` | When |
|------|----------------|------|
| **401** | `unauthenticated` | Missing or invalid Firebase token. |
| **400** | `validation_error` | Bad `contestId` or JSON body. |
| **400** | `contest_not_open` | Contest `status !== open`. |
| **400** | `wrong_game_mode` | Not bio-ball. |
| **400** | `contest_no_entry_fee` | `entryFeeCents` is 0 or absent — use **free** join (`POST .../join`). |
| **400** | `join_window_closed` | Now outside `[windowStart, windowEnd)`. |
| **404** | `contest_not_found` | No `contests/{contestId}` document. |
| **409** | `already_entered` | Entry exists with paid / pending / free / refunded state, or legacy join row; retry only allowed when `paymentStatus === failed`. |
| **409** | `already_in_open_contest` | User has an entry in another **open** contest with the same `gameMode` (same rule as join). |
| **429** | `rate_limited` | Too many requests; may include `retryAfterSec`. |
| **502** | `stripe_checkout_failed` | Stripe API error creating the session. |
| **503** | `contest_payments_disabled` | `CONTESTS_PAYMENTS_ENABLED` is not `true`. |
| **503** | `stripe_not_configured` | No `STRIPE_SECRET_KEY` while payments expect Stripe. |
| **503** | `server_misconfigured` | Firestore unavailable, or **`CONTESTS_CHECKOUT_APP_ORIGIN`** unset. |

### Redirect URLs (server-built)

Success and cancel URLs point at:

`/bio-ball/mlb?contestId=<id>&checkout=success|cancel`

Base origin from **`CONTESTS_CHECKOUT_APP_ORIGIN`** (no trailing slash), e.g. `http://localhost:4300` for `ng serve` behind the usual proxy.

---

## Angular client (Story P5-D2)

- **Feature flag:** `environment.contestsPaymentsEnabled` — set at build from **`CONTESTS_PAYMENTS_ENABLED`** (same meaning as Express; see `scripts/generate-env-prod.mjs`). Local dev: set `contestsPaymentsEnabled: true` in `src/environment.ts` when testing paid entry.
- **Paid path:** contests with `entryFeeCents > 0` show **Pay & enter**, call `POST .../checkout-session`, then **`window.location.href = session.url`** (full redirect to Stripe).
- **Return URL:** server sends users to `/bio-ball/mlb?checkout=success|cancel&contestId=…`; the contests panel strips query params and, on success, shows **Confirming payment…** until Firestore `entries/{uid}.paymentStatus === paid` (written by webhook P5-E).
- **`stripePublishableKey`:** not required for Checkout redirect (no Stripe.js on the client). Optional for future Elements.

---

## References

- `server/contests/contest-checkout.http.js` — handler  
- [weekly-contests-schema-entries.md](weekly-contests-schema-entries.md) — `paymentStatus`, Stripe ids on entry (webhook writes)
