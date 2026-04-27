# Weekly contests — admin capabilities & roadmap

**Audience:** Operators, on-call engineers, and product owners planning contest tooling.  
**Related:** [admin-dashboard-security.md](admin-dashboard-security.md) (identity & admin API table), [weekly-contests-runbook-g2.md](weekly-contests-runbook-g2.md) (staging lifecycle), [weekly-contests-ops-d1.md](weekly-contests-ops-d1.md) / [weekly-contests-ops-e1.md](weekly-contests-ops-e1.md) / [weekly-contests-ops-e2.md](weekly-contests-ops-e2.md) (transitions & jobs).

---

## Security model (short)

- **Client `isAdmin` + admin drawer** are **UX only**. Every sensitive action is enforced on the **server** (`verifyIdToken`, `requireAdmin`, Admin SDK, Firestore rules).
- **Browser admin APIs** use **`Authorization: Bearer <Firebase ID token>`** and the **`admin: true`** custom claim — **not** `CONTESTS_OPERATOR_SECRET`.
- **Operator-secret** routes stay for **cron, curl, and automation**; they must **not** be called from the Angular app. See [Threat model](admin-dashboard-security.md#threat-model-and-boundaries).

---

## Current capabilities

### 1. Browser admin API (`/api/v1/admin/*`)

Documented in [Admin API — weekly contests (browser)](admin-dashboard-security.md#admin-api--weekly-contests-browser) and [Admin users](admin-dashboard-security.md) (same file — user routes).

| Method | Path | Purpose |
|--------|------|---------|
| `GET` | `/api/v1/admin/contests` | List Bio Ball contests (all statuses), sorted, `limit` capped. |
| `POST` | `/api/v1/admin/contests` | Create `contests/{contestId}` (server id optional). |
| `POST` | `/api/v1/admin/contests/:contestId/transition` | Transition toward `open` \| `scoring` \| `paid` \| `cancelled` with optional `force` / `reason`. |
| `POST` | `/api/v1/admin/contests/:contestId/run-scoring` | Run E2 scoring for a contest in **`scoring`** (may advance to **`paid`**). |
| `POST` | `/api/v1/admin/contests/:contestId/payout-execute` | Phase 6 — run prize **Stripe Transfers** + **`payouts/final`** for a **`paid`** contest (same engine as internal execute; see [weekly-contests-phase6-ops.md](weekly-contests-phase6-ops.md)). |
| `POST` | `/api/v1/admin/contests/:contestId/void-after-prize` | Phase 6 P6-F1 — **reverse** succeeded prize Transfers, append **`prize_transfer_reversal`** ledger lines, audit, then **`paid`→`cancelled`** + artifact deletes ([weekly-contests-ops-p6-f1-void-prize.md](weekly-contests-ops-p6-f1-void-prize.md)). |
| `GET` | `/api/v1/admin/contests/:contestId/payout-status` | Phase 6 P6-G1 — contest payout artifacts + masked transfer ids ([weekly-contests-api-phase6.md](weekly-contests-api-phase6.md)). |
| `GET` | `/api/v1/admin/contests/:contestId/users/:targetUid/payout-status` | Phase 6 P6-G1 — “was this user paid?” for that contest + Connect + ledger ([weekly-contests-api-phase6.md](weekly-contests-api-phase6.md)). |
| `GET` | `/api/v1/admin/users/admins` | List users with `admin` claim. |
| `GET` | `/api/v1/admin/users/:targetUid` | Read Auth user + `admin` claim. |
| `PATCH` | `/api/v1/admin/users/:targetUid/admin-claim` | Grant or revoke **`admin`** (cannot target your own uid). |

Implementation pointers: [`server/admin-contests.http.js`](../server/admin-contests.http.js), [`server/admin-users.http.js`](../server/admin-users.http.js), [`server/require-admin.js`](../server/require-admin.js), [`index.js`](../index.js).

### 2. Admin dashboard UI (Angular)

When **`ADMIN_DASHBOARD_UI_ENABLED`** is on and the user has **`isAdmin`** from **`GET /api/v1/me`**, the **right-hand** admin drawer includes:

| Section | What admins can do |
|---------|---------------------|
| **Weekly contests** (`app-admin-weekly-contests-widget`) | **Create** a contest (scheduled or open, windows, `leagueGamesN`, rules version, optional display economics). **List** contests. **Change status** via transition form. **Run scoring job** when status is **`scoring`**. |
| **Admin users** (`app-admin-user-claims-widget`) | **Grant/revoke** `admin` on **other** users (not self-service lockout). |
| **Docs in repo** | Static pointers to markdown paths in the clone — not served by the app. |

There is **no** general-purpose **edit (PATCH) contest** in the admin UI today; fixing fields after create typically requires a **controlled** Firestore/Admin operation or a future API (see roadmap below).

### 3. Operator / automation (not the SPA)

These use **`CONTESTS_OPERATOR_SECRET`** (or related internal auth) and are intended for **Cloud Scheduler**, **curl**, or **runbooks** — **never** embed secrets in the browser.

| Capability | Typical doc |
|------------|-------------|
| Transition contest (same rules as admin transition, different auth) | [weekly-contests-ops-d1.md](weekly-contests-ops-d1.md) |
| **Close due windows** (batch `open` → `scoring` when time is up) | [weekly-contests-ops-e1.md](weekly-contests-ops-e1.md) |
| **Run scoring** (internal batch path) | [weekly-contests-ops-e2.md](weekly-contests-ops-e2.md), [weekly-contests-runbook-g2.md](weekly-contests-runbook-g2.md) |

Admins who only use the **web dashboard** still rely on **automation or manual internal calls** for **E1 close-due-windows** unless they run curl against the API with a secret (per runbook).

---

## Roadmap & operational considerations

The items below are **not** all committed work; they capture **high-leverage** follow-ups discussed for operator experience and safety.

### A. Batch “close due windows” (E1) from a trusted UI

- **Today:** `POST /api/internal/v1/contests/close-due-windows` is an **operator-secret** route; production usage is usually **scheduled jobs**.
- **Idea:** A **staging-only** or **heavily audited** control to trigger the same behavior without raw curl — reduces toil for QA.
- **Caution:** In **production**, prefer **Scheduler** + logs; any UI trigger needs **audit**, **idempotency** clarity, and **least privilege**.

### B. Edit contest metadata after create (PATCH / admin form)

- **Today:** Create covers initial fields; there is no first-class **admin PATCH contest** documented for arbitrary updates.
- **Idea:** Allow vetted edits (**title**, **display** prize/fee, **window** corrections) through **Admin SDK** + validation shared with create.
- **Caution:** Changing **`window*`** or **`rulesVersion`** after entries exist has **product implications**; coordinate with rules/ADR before exposing wide edits.

### C. Read-only operational context

- **Idea:** **Entry counts**, “joinable now” derived state, **copy contest id**, links to **supporting docs** or Firestore console paths — all **read-only**, no new trust boundary.
- **Value:** Faster support without opening production Firestore for every ticket.

### D. Scoring / published results hygiene

- **Idea:** Controlled **re-run scoring**, **void** flows, or **manual remediation** when jobs fail or data was wrong.
- **Caution:** Published **final** results are treated as **immutable** for players ([weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md)). Any override path needs **explicit product + legal/ops design**, **audit trail**, and **idempotent** server behavior — not a casual dashboard button.

### E. Observability in the admin UI

- **Idea:** Surface **last scoring job id**, **transition history** snippets, or **error messages** returned by APIs (where persisted) so operators see **why** a contest is stuck in **`scoring`** without digging only in logs.
- **Value:** Shortens incident time; implementation depends on what the backend already stores on `contests` or in logs.

### F. Outside the admin panel (still operator-relevant)

These usually stay in **deploy/runbook** processes rather than the nav drawer:

- **Rules HTML / assets** under `assets/contests/` (player-facing copy).
- **Build flags** (e.g. `WEEKLY_CONTESTS_UI_ENABLED`, `ADMIN_DASHBOARD_UI_ENABLED`).
- **Firestore rules / composite indexes** deployment.
- **Grant/revoke admin** via script** when API self-lockout must be avoided — [admin-dashboard-ops-ad3.md](admin-dashboard-ops-ad3.md).

---

## Player-facing QA (non-admin)

For **smoke-testing the contests drawer** as a player (strip → join, paid → payout details), use [weekly-contests-ui-walkthrough-check.md](weekly-contests-ui-walkthrough-check.md).

---

## See also

| Topic | Document |
|-------|----------|
| Admin identity & API tables | [admin-dashboard-security.md](admin-dashboard-security.md) |
| Grant/revoke `admin` claim (CLI) | [admin-dashboard-ops-ad3.md](admin-dashboard-ops-ad3.md) |
| Contest schema | [weekly-contests-schema-contests.md](weekly-contests-schema-contests.md) |
| Results & payout artifacts | [weekly-contests-schema-results.md](weekly-contests-schema-results.md) |
