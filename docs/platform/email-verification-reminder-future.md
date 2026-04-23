# Email verification — scheduled reminder (future implementation)

**Status:** Not implemented in this repository. The app already handles verification in the client ([`AuthService`](../../src/app/auth/auth.service.ts) `sendEmailVerification` / `resendEmailVerification`), a dedicated continue URL at [`/email-verified`](../../src/app/auth/email-verified-page/), post–sign-up UI in [`NavComponent`](../../src/app/nav/nav.component.ts), and profile resend in [`ProfileComponent`](../../src/app/nav/profile/profile.component.ts).

This document describes how to add an **optional server-side reminder** (e.g. weekly) for accounts that remain **unverified** after several days, without relying on the user opening the app.

---

## Goals

- Nudge **email/password** users who never completed verification (leaderboards and other flows may require `emailVerified`).
- **Throttle** reminders (per-user cooldown) to avoid spam and abuse.
- **Do not** implement until product/legal agree on copy, frequency, and unsubscribe expectations.

---

## High-level design

1. **Trigger:** [Cloud Scheduler](https://cloud.google.com/scheduler/docs) invokes an HTTPS endpoint on a fixed cadence (e.g. weekly).
2. **Runtime:** Gen2 **Cloud Function** (Python or Node) or a small **Cloud Run** job with the **Firebase Admin SDK** and a **transactional email** provider (e.g. [Resend](https://resend.com), SendGrid, or SES).
3. **Eligibility (suggested):**
   - Firebase Auth: `email_verified == false`, `email` present, **password** provider (skip pure Google/OAuth-only accounts).
   - Account **creation** time at least **N** days ago (e.g. `N = 3`).
   - Firestore `users/{uid}.lastEmailVerificationReminderAt` missing or older than **M** days (e.g. `M = 7`) so the same user is not emailed every run.
4. **Link:** Use Admin SDK **`generate_email_verification_link`** with the same **`ActionCodeSettings`** as the client: **`continueUrl`** must be the deployed app’s **`…/email-verified`** route (see `AuthService` / Firebase **Authorized domains**).
5. **After send:** `set` / `update` on **`users/{uid}`** with `lastEmailVerificationReminderAt: serverTimestamp` (merge) for cooldown. Optionally log structured metrics (count sent, skipped, errors) without PII.

---

## Security

- **Do not** expose the job URL without authentication. Prefer:
  - **OIDC** from Cloud Scheduler to Cloud Run / Functions **invoker** (recommended), or
  - A shared **secret header** (e.g. `X-Email-Reminder-Secret`) compared to a value stored in **Secret Manager** (acceptable if the URL is not guessable and HTTPS-only).
- **Secrets:** `RESEND_API_KEY` (or equivalent), `EMAIL_REMINDER_CRON_SECRET` (if using header auth), Firebase credentials via default **Application Default Credentials** on the function’s service account.
- **Least privilege:** Service account needs **Firebase Authentication Admin** (list users / generate links) and **Cloud Datastore User** (or Firestore) for `users/{uid}` updates—not broad project Owner.

---

## Consent and policy

- Align reminder **wording** with your privacy policy (why you store email, how often you contact users).
- Consider an **opt-out** stored on `users/{uid}` if you must support marketing-style rules; Firebase’s own verification email is transactional, but **repeated** reminders blur the line—get sign-off before shipping.

---

## Implementation checklist (when you pick this up)

1. Add a **Cloud Build** trigger (or extend [`cloudbuild.functions.yaml`](../cloudbuild.functions.yaml) pattern) deploying a new function from a small source directory (e.g. `email-verification-reminder/`).
2. Set environment variables / secrets (see “Goals” and “Security”).
3. Create the **Scheduler** job (POST, correct region, auth as above).
4. Verify **`AUTH_EMAIL_CONTINUE_URL`** matches production (no trailing slash), and **`/email-verified`** is allowed in Firebase Auth **Authorized domains**.
5. Dry-run in **staging** with a test project and test inboxes; monitor logs and Resend bounces.
6. Document runbook steps (who can deploy, how to disable the scheduler quickly).

---

## Related code (today)

| Area | Location |
|------|----------|
| Verification send + `ActionCodeSettings` | [`src/app/auth/auth.service.ts`](../../src/app/auth/auth.service.ts) |
| Post–verify landing + `applyActionCode` | [`src/app/auth/email-verified-page/`](../../src/app/auth/email-verified-page/) |
| Post–sign-up banner, resend cooldown | [`src/app/nav/nav.component.ts`](../../src/app/nav/nav.component.ts) |
| Profile resend + unverified banner | [`src/app/nav/profile/profile.component.ts`](../../src/app/nav/profile/profile.component.ts) |
| User doc mirror (`emailVerified`, optional future `lastEmailVerificationReminderAt`) | [`src/app/auth/user-bootstrap.service.ts`](../../src/app/auth/user-bootstrap.service.ts) |

---

## Prior art (removed from repo)

An earlier iteration added a Python Gen2 function under `email-verification-reminder/` and `cloudbuild.email-verification-reminder.yaml`. That code was **removed** in favor of this design note so operators can choose stack (Python vs Node), provider, and IAM without maintaining unused deploy paths in the main branch.
