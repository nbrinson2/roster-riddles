# Admin dashboard — identity, token contract, and threat model (Story AD-1)

**Status:** Design locked for implementation (AD-2+)  
**Related:** [admin-dashboard-jira-backlog.md](admin-dashboard-jira-backlog.md) — Epic AD

## Goal

Define how the product knows a signed-in user is an **admin** for **UI purposes** (show icon, open dashboard shell), without treating the browser as a security boundary for **privileged actions**.

---

## Decision: Firebase Auth custom claim (canonical)

| Approach | Verdict |
|----------|---------|
| **Custom claim on the ID token** (recommended) | **Yes.** Use a boolean claim, e.g. **`admin: true`**, set only via **Firebase Admin SDK** (backend script, Cloud Function, or trusted operator tooling). The claim is part of the signed JWT; **`verifyIdToken`** on the server yields the same truth the UI will eventually mirror via **`GET /api/v1/me`** (Story AD-2). |
| **Firestore allowlist** (e.g. `admins/{uid}`) | **Optional supplement** for audit listings or “who is admin” consoles, **not** the primary gate for “show admin icon” unless every request re-reads Firestore (extra latency). If used, **do not** expose client write access; resolve via **Admin SDK** or security rules with extreme care. |
| **Client-only flags** (localStorage, env, hardcoded UIDs) | **Do not use** for real gating — trivially forgeable. |

**Claim shape (v1):**

```json
{ "admin": true }
```

Omit the key or set **`admin: false`** for non-admins. Use a **boolean** only; avoid stringly-typed roles until multiple roles are required.

---

## How the client learns `isAdmin` (without trusting localStorage)

1. **Preferred:** **`GET /api/v1/me`** with **`Authorization: Bearer <Firebase ID token>`** returns **`isAdmin: boolean`** derived from **`verifyIdToken`** custom claims (Story AD-2). The SPA treats this as the **source of truth** for showing the admin affordance when combined with a **build-time feature flag** (Story AD-4).

2. **Optional optimization:** Decode the ID token in Angular **only** for UX (e.g. avoid a flash) — still **reconcile** with **`GET /api/v1/me`** on load; **never** trust decoded JWT alone for any mutation.

3. **Never** persist `isAdmin` in **localStorage/sessionStorage** as authoritative; session storage may cache **only** as a non-authoritative hint cleared on logout.

---

## Token refresh and claim latency

Custom claims are embedded in the **ID token** at issue time. After an operator sets or removes **`admin`**:

- The user’s **current** ID token may be **stale** until:
  - **`getIdToken(true)`** (force refresh), or
  - **Sign-out / sign-in**, or
  - Natural expiry and refresh (timing-dependent).

**Product expectation:** After grant/revoke, admins should **refresh the session** (or wait for refresh) before **`GET /api/v1/me`** reflects the new value. See [admin-dashboard-ops-ad3.md](admin-dashboard-ops-ad3.md).

---

## Threat model and boundaries

| Topic | Rule |
|-------|------|
| **What `isAdmin` in the SPA means** | **Navigation only** — whether to show the admin icon and dashboard shell. It is **not** authorization to perform sensitive operations. |
| **Privileged APIs** | Continue to use **server-side** enforcement: **`CONTESTS_OPERATOR_SECRET`**, Firebase **Admin SDK**, **Firestore rules** denying client writes on protected paths, etc. |
| **Future admin UI actions** | Any button in the dashboard that triggers work must call **normal authenticated APIs** that **re-check** identity/roles on the server, or **dedicated** admin endpoints that validate claims server-side — **never** embed secrets in the client. |
| **Token theft** | If an attacker obtains a valid ID token with **`admin: true`**, they get the same UI an admin gets; mitigate with **short-lived tokens**, **HTTPS**, **secure** cookie/session practices if applicable, and **minimal** admin principals. Revocation = remove claim + consider session invalidation per org policy. |

---

## Staging vs production (process, not keys)

| Environment | Notes |
|---------------|--------|
| **Staging** | Test accounts may carry **`admin: true`** for QA. Use **non-production** Firebase project; restrict who can grant claims (same discipline as prod, smaller blast radius). |
| **Production** | Grant **`admin: true`** only to **named operators**; prefer **break-glass** documentation (who approved, ticket link). Revoke when access ends. |

No PII or secrets belong in this document; **UIDs** in runbooks should be **redacted** in public copies.

---

## `GET /api/v1/me` (Story AD-2)

**Auth:** `Authorization: Bearer <Firebase ID token>` (same as other protected routes).

**Success — 200**

| Field | Type | Description |
|-------|------|-------------|
| `uid` | `string` | Firebase Auth uid |
| `email` | `string \| null` | Email if present |
| `emailVerified` | `boolean` | Email verification flag |
| `isAdmin` | `boolean` | **`true`** iff ID token includes custom claim **`admin: true`**; otherwise **`false`**. Omitted never — always boolean. |

**Errors:** Same as other bearer-protected routes (`401` invalid/missing token, `503` if Admin SDK not configured).

Implementation: [`server/require-auth.js`](../server/require-auth.js), [`server/auth-claims.js`](../server/auth-claims.js), route in [`index.js`](../index.js).

---

## Implementation pointers (forward references)

| Story | Topic |
|-------|--------|
| AD-2 | **Done** — **`isAdmin`** on **`GET /api/v1/me`** (see above). |
| AD-3 | **Done** — [admin-dashboard-ops-ad3.md](admin-dashboard-ops-ad3.md) (`scripts/set-admin-claim.mjs`, verify with **`GET /api/v1/me`**). |
| AD-4 | Feature flag **`adminDashboardUiEnabled`** AND server **`isAdmin`** before showing UI. |

---

## References

- Operations (grant/revoke): [admin-dashboard-ops-ad3.md](admin-dashboard-ops-ad3.md)
- Firebase: [Custom claims](https://firebase.google.com/docs/auth/admin/custom-claims) (official)
- Backlog: [admin-dashboard-jira-backlog.md](admin-dashboard-jira-backlog.md)
