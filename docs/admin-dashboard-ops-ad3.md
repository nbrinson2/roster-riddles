# Admin custom claim — grant / revoke (Story AD-3)

**Status:** Implemented (runbook + script)  
**Depends on:** [admin-dashboard-security.md](admin-dashboard-security.md) (AD-1), `GET /api/v1/me` **`isAdmin`** (AD-2)

## Purpose

Operators with a **Firebase service account** for the right project can grant or revoke the **`admin: true`** custom claim used by the API ([`server/auth-claims.js`](../server/auth-claims.js)) and exposed as **`isAdmin`** on **`GET /api/v1/me`**.

**This script only changes Auth custom claims.** It does not deploy code or rotate API secrets.

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| **Target project** | Use credentials for **staging** (`roster-riddles-staging`) or **production** (`roster-riddles-457600` per [environment-matrix.md](environment-matrix.md)) — **never** run staging keys against prod. |
| **Service account** | JSON key with permission to manage users (typically **Firebase Authentication Admin** / project-level). Store under **`secrets/`** (gitignored). |
| **Env** | `GOOGLE_APPLICATION_CREDENTIALS=/path/to/key.json` **or** `FIREBASE_SERVICE_ACCOUNT_JSON=<inline JSON>` — same pattern as Express ([`.env.example`](../.env.example)). |

---

## Script (recommended)

From the repo root:

```bash
export GOOGLE_APPLICATION_CREDENTIALS=./secrets/your-adminsdk.json

# Grant admin UI privilege (custom claim admin: true)
node scripts/set-admin-claim.mjs YOUR_FIREBASE_UID --grant

# Revoke (sets admin: false; see server isAdmin check)
node scripts/set-admin-claim.mjs YOUR_FIREBASE_UID --revoke

# Print what would happen (no Firebase calls)
node scripts/set-admin-claim.mjs YOUR_FIREBASE_UID --grant --dry-run
```

NPM shortcut:

```bash
npm run admin:set-claim -- YOUR_FIREBASE_UID --grant
```

Exit codes: **0** success or dry-run; **1** usage/validation; **2** Firebase init or Auth API error.

Structured success line includes **`customClaims`** from **`getUser`** for verification.

---

## Verify after grant (staging or prod)

1. Sign in as that user in the app (or obtain a fresh **ID token**).
2. Force-refresh the token if needed: **`user.getIdToken(true)`** in devtools / app code, or **sign out and sign in** ([admin-dashboard-security.md](admin-dashboard-security.md) — token latency).
3. Call the API:

```bash
curl -sS -H "Authorization: Bearer $ID_TOKEN" "https://<api-host>/api/v1/me"
```

Expect **`"isAdmin": true`** after **`--grant`**, **`"isAdmin": false`** after **`--revoke`**.

---

## Staging vs production

| Tier | Firebase project (typical) | Notes |
|------|----------------------------|--------|
| **Staging** | `roster-riddles-staging` | Safe for test accounts; use **staging** service account only. |
| **Production** | Production project in [environment-matrix.md](environment-matrix.md) | Minimal operators; document **who** was granted access and **ticket** reference. **Break-glass** discipline. |

Always confirm **`project_id`** inside the service account JSON matches the environment you intend.

---

## Revocation and sessions

- Setting **`admin: false`** stops **new** ID tokens from carrying admin (after refresh).  
- If your threat model requires **immediate** revocation, also **disable** the user in Firebase Auth or force password reset / session revoke per [Firebase Auth docs](https://firebase.google.com/docs/auth/admin/manage-sessions) — out of scope for this script, but called out per Story AD-3.

---

## Alternatives (no repo script)

- **Firebase Admin SDK** one-off in Node REPL with the same `setCustomUserClaims` call.  
- **Cloud Function** or internal admin tool that calls Admin SDK (audit logging recommended for prod).

---

## References

- [Firebase custom claims](https://firebase.google.com/docs/auth/admin/custom-claims)
- Script: [`scripts/set-admin-claim.mjs`](../scripts/set-admin-claim.mjs)
- Backlog: [admin-dashboard-jira-backlog.md](admin-dashboard-jira-backlog.md) — Story AD-3
