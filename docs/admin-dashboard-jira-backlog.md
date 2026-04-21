# Admin dashboard (nav icon + right drawer) — Jira backlog

**Suggested labels:** `admin`, `nav`, `phase-next`  
**Suggested epic name:** Admin dashboard shell (production-ready gating)

**Context (current codebase):** Top nav uses `mat-sidenav` with mutually exclusive “views” (`viewMenu`, `viewProfile`, `viewRoster`, `viewLeaderboard`, `viewContests`, …) in [`src/app/nav/nav.component.html`](../src/app/nav/nav.component.html). Profile and logout live in **`icons-right-container`** (right side of the bar). The profile drawer uses **`MatDrawerPosition.END`** (`position="end"`) — **right-side** overlay. `GET /api/v1/me` returns **`isAdmin`** from ID token custom claim **`admin: true`** ([`index.js`](../index.js), [`server/require-auth.js`](../server/require-auth.js), AD-2). Operators grant/revoke via [admin-dashboard-ops-ad3.md](admin-dashboard-ops-ad3.md) (AD-3).

---

## Epic AD — Admin dashboard entry (icon + drawer shell)

**Goal:** For **production** (and staging), users who are **explicitly granted admin** see an **admin icon** in the **right** icon cluster (recommended: immediately **left of the profile icon** within **`icons-right-container`**). Clicking it opens the **right** drawer (`MatDrawerPosition.END`, `position="end"`) with an **admin dashboard** shell (placeholder content + room for future operator tools) — **same side** as the profile / login-end drawer, not the left “info / leaderboard / contests” drawer.

**Non-goals (v1):** Implementing full operator workflows (contest CRUD UI, user impersonation, etc.). Those ship as follow-up stories once the shell and **authorization contract** exist.

**Security principle:** **UI gating is UX only.** Every privileged action continues to require **server-side** checks (existing internal secrets, Admin SDK, Firestore rules). The dashboard must not expose secrets or bypass APIs.

**Design (Story AD-1):** [admin-dashboard-security.md](admin-dashboard-security.md) — custom claim shape, token refresh, threat model.

---

### Story AD-1 — Design: admin identity & token contract

| Field | Value |
|-------|--------|
| **Type** | Story / Spike |
| **Summary** | Decide and document how “admin” is represented (Firebase custom claims vs Firestore allowlist) and how the client learns `isAdmin` without trusting localStorage alone. |

**Description**

- **Recommended default:** Firebase Auth **custom claim** on the ID token, e.g. **`{ "admin": true }`** (boolean). Operators grant/revoke via **Admin SDK** (script, Cloud Function, or support tool) — **not** by client writes.
- Document that users must **refresh ID token** (or re-login) after claim changes so the Angular app sees updated claims (or rely exclusively on **`GET /api/v1/me`** which verifies a fresh token per request).
- Define **staging** vs **production** process: who may grant claims, audit expectation, and that **test accounts** in staging may carry `admin: true` for QA.

**Acceptance criteria**

- [x] Short design note added under **`docs/`** — **[`admin-dashboard-security.md`](admin-dashboard-security.md)** — covering: claim shape, refresh behavior, threat model (“client `isAdmin` is not authorization for mutations”).
- [x] Linked from this backlog; implementation stories AD-2–AD-4 reference it from **`admin-dashboard-security.md`** (forward references table).

**Dependencies**

- None (blocks AD-2).

**Deliverable (merged)**

- **[`docs/admin-dashboard-security.md`](admin-dashboard-security.md)**

---

### Story AD-2 — Backend: expose `isAdmin` on `GET /api/v1/me`

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Extend authenticated “who am I” so the SPA can show the admin icon only for real admins, using server-verified ID token claims. |

**Description**

- Follow claim shape and threat model in **[`admin-dashboard-security.md`](admin-dashboard-security.md)**.
- In [`server/require-auth.js`](../server/require-auth.js) (or solely inside the `/api/v1/me` handler), after `verifyIdToken`, read **custom claims** from the decoded token (e.g. `decoded.admin === true`).
- Extend JSON response of `GET /api/v1/me` with **`isAdmin: boolean`** (default **`false`** if claim absent).
- Do **not** log emails/uid on success for this field beyond existing patterns; optional structured log line with **`outcome`** for debugging misconfiguration only.
- Add **`server/*.test.js`** coverage if feasible (mock decoded token with/without claim), or document manual verification.

**Acceptance criteria**

- [x] Response shape documented (OpenAPI-style table in `docs/` or comment in `index.js` pointing to doc).
- [x] User **without** claim receives **`isAdmin: false`**.
- [x] User **with** `admin: true` claim receives **`isAdmin: true`**.
- [x] No breaking change for existing clients that ignore unknown fields.

**Dependencies**

- AD-1.

**Deliverable (merged)**

- **[`server/auth-claims.js`](../server/auth-claims.js)** — `isAdminFromDecodedToken` (unit-tested).
- **[`server/require-auth.js`](../server/require-auth.js)** — sets **`req.user.isAdmin`** for all bearer-authenticated routes.
- **[`index.js`](../index.js)** — **`GET /api/v1/me`** returns **`isAdmin`**.
- **[`docs/admin-dashboard-security.md`](admin-dashboard-security.md)** — response field table.

---

### Story AD-3 — Operations: grant / revoke admin claim (staging & prod)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Document (and optionally script) how to set **`admin: true`** on specific Firebase Auth UIDs for QA and production support. |

**Description**

- Align with **[`admin-dashboard-security.md`](admin-dashboard-security.md)** (staging vs prod, token refresh after claim change).
- Provide a **one-off Node script** *or* **`firebase auth:export` / Admin SDK** cookbook that operators run with a **service account** (never commit keys).
- Steps: install nothing new if possible; reuse repo’s `firebase-admin` pattern from [`server/firebase-admin-init.js`](../server/firebase-admin-init.js).
- Call out **latency**: user may need to refresh token or sign out/in before **`GET /api/v1/me`** reflects the claim.

**Acceptance criteria**

- [x] Runbook section in **`docs/`** with copy-paste commands.
- [x] Staging verification steps: grant claim → call **`GET /api/v1/me`** with Bearer token → **`isAdmin: true`**.
- [x] Explicit warning: revoking access requires removing claim **and** invalidating sessions if your threat model requires it.

**Dependencies**

- AD-2 (to verify end-to-end).

**Deliverable (merged)**

- **[`docs/admin-dashboard-ops-ad3.md`](admin-dashboard-ops-ad3.md)** — staging vs prod, verification curl, session revocation note.
- **[`scripts/set-admin-claim.mjs`](../scripts/set-admin-claim.mjs)** — `npm run admin:set-claim -- <uid> --grant|--revoke [--dry-run]`.

---

### Story AD-4 — Angular: consume `isAdmin` + build-time feature flag

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Wire the SPA to server-truth `isAdmin` and add **`ADMIN_DASHBOARD_UI_ENABLED`** (or similar) so production can ship with the feature off until ready. |

**Description**

- Follow **client trust boundaries** in **[`admin-dashboard-security.md`](admin-dashboard-security.md)** (no localStorage as source of truth; optional token decode for UX only).
- Add **`adminDashboardUiEnabled`** (boolean) to generated environments via [`scripts/generate-env-prod.mjs`](../scripts/generate-env-prod.mjs) and [`Dockerfile`](../Dockerfile) build-arg pattern — mirror **`WEEKLY_CONTESTS_UI_ENABLED`** / **`LEADERBOARDS_UI_ENABLED`** ([`.env.example`](../.env.example)).
- On session start / after login, ensure **`GET /api/v1/me`** (or existing auth bootstrap) is used to populate **`isAdmin`** (e.g. extend [`AuthService`](../src/app/auth/auth.service.ts) or a small **`AdminCapabilityService`**).
- Re-fetch or re-call when ID token is refreshed if the app already has a refresh pipeline; otherwise document limitation + “refresh page after claim grant.”

**Acceptance criteria**

- [ ] When **`adminDashboardUiEnabled`** is **false**, **no** admin UI appears regardless of claim.
- [ ] When **true** and **`isAdmin`** is **false**, **no** admin icon.
- [ ] When **true** and **`isAdmin`** is **true**, admin affordance is available (icon — Story AD-5).
- [ ] Default for local dev documented (e.g. off unless `.env` enables).

**Dependencies**

- AD-2.

---

### Story AD-5 — Nav UI: admin icon on the right + open right drawer

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Add Material icon in the **right** icon cluster; open sidenav **`end`** (right) with **`viewAdmin`**, consistent with the profile drawer — not the left drawer used for info / leaderboard / contests. |

**Description**

- In [`nav.component.html`](../src/app/nav/nav.component.html), within **`icons-right-container`**, insert an admin control **between** difficulty (if any) / logout block and **profile** — recommended order: **`[logout] [admin?] [profile]`** so the admin icon sits **immediately left of profile** on the **right** side of the top bar.
- Use **`material-symbols-outlined`** glyph e.g. **`admin_panel_settings`**, **`shield`**, or **`settings`** — pick one and keep consistent.
- Mirror **accessibility** patterns from leaderboard/contests icons: **`role="button"`**, **`tabindex="0"`**, **`aria-label="Open admin dashboard"`**, **`Enter` / `Space`** handlers.
- In [`nav.component.ts`](../src/app/nav/nav.component.ts): add **`viewAdmin`**, **`openAdminDashboard()`** — set **`matDrawerPosition = END`** (same as **`openProfileMenu`**), turn off **`viewMenu`**, **`viewProfile`**, **`viewRoster`**, **`viewLeaderboard`**, **`viewContests`**, open drawer. Do **not** use **`START`** for admin (that is the **left** drawer).
- Ensure **logged-out** users never see the icon; **logged-in** only when **`adminDashboardUiEnabled && isAdmin`**.

**Acceptance criteria**

- [ ] Admin icon **only** when feature flag on **and** user is admin **and** logged in.
- [ ] Clicking admin opens the **right** drawer (`end`) with admin content region (Story AD-6).
- [ ] Opening profile / info / other panels **clears** `viewAdmin` (mutual exclusion consistent with existing `openMenu` / `openProfileMenu` patterns — update each method as needed).
- [ ] SCSS: align with [`nav.component.scss`](../src/app/nav/nav.component.scss) (spacing, hit target, contrast).

**Dependencies**

- AD-4.

---

### Story AD-6 — `admin-dashboard-panel` component (shell)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | New drawer content: **Admin dashboard** placeholder with clear sections for future tools and links to existing **runbooks** (weekly contests, etc.). |

**Description**

- Create **`admin-dashboard-panel`** component (module registration consistent with **`leaderboard-panel`**, **`contests-panel`**).
- Render inside **`mat-sidenav`** with **`*ngIf="viewAdmin && adminDashboardUiEnabled"`** (and `loggedIn` if required). With **`matDrawerPosition.END`**, the panel appears in the **right** drawer (same physical side as profile content).
- v1 content ideas: title “Admin”, short disclaimer (“Destructive actions use server APIs; this panel is navigational”), links to **`docs/`** paths as **external** documentation (or static text URLs to your internal wiki).
- Do **not** embed **secrets** or call **internal** endpoints with operator secrets from the browser.

**Acceptance criteria**

- [ ] Empty / loading states: N/A for static shell; no flash of content for non-admin (guarded by parent `ngIf`).
- [ ] Styling consistent with app nav panels (fonts, dark theme if applicable).
- [ ] Unit test optional (smoke render); at minimum **no** console errors when opening drawer.

**Dependencies**

- AD-5.

---

### Story AD-7 — QA, accessibility review, and release checklist

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Sign-off for staging and production rollout of the admin shell. |

**Description**

- **Keyboard:** Tab order reaches admin control when visible; **Space/Enter** opens drawer.
- **Screen reader:** `aria-label` accurate; drawer title if using `aria-labelledby`.
- **Regression:** Non-admin users never see icon; feature flag off hides for everyone.
- **Production:** Deploy order — enable **AD-2** backend first, then Angular build with **`ADMIN_DASHBOARD_UI_ENABLED=true`** only when ready; grant claims to **minimal** operator set.

**Acceptance criteria**

- [ ] Checklist completed in PR or ticket (staging + prod smoke).
- [ ] Rollback plan: disable feature flag; claims can remain harmless if UI hidden.

**Dependencies**

- AD-3, AD-6.

---

## Suggested Jira hierarchy (quick reference)

| Epic | Stories |
|------|---------|
| **AD — Admin dashboard** | AD-1, AD-2, AD-3, AD-4, AD-5, AD-6, AD-7 |

## Optional follow-ups (separate epics)

- **Admin → Weekly contests:** deep links from dashboard to internal **read-only** contest list API (`GET /api/v1/contests`) with redacted fields — still no client writes.
- **Audit logging:** `component: admin_dashboard` structured line when panel opens (uid only, no PII).
- **Route-based admin:** `/admin` lazy-loaded module behind `AuthGuard` + server `isAdmin` — only if product wants URL-deep linking.
