# Phase 3 — Leaderboards (Jira backlog)

**Prerequisite:** Phase 2 gameplay stats (events + `users/{uid}/stats/summary`) shipped or stable enough to derive scores. This document breaks work into **epics** and **detailed stories** suitable for copy-paste into Jira.

**Suggested labels:** `phase-3`, `leaderboards`  
**Suggested fix version:** `Leaderboards v1`

---

## Phase exit criteria (product)

| Criterion | Verification |
|-----------|----------------|
| Leaderboard **correct** for a **test cohort** | Known UIDs + seeded scores; manual + automated comparison vs source of truth. |
| **Stable under concurrent writes** | Load test or chaos-lite: many simultaneous score updates; no torn reads beyond documented semantics; aggregates remain consistent. |
| **Scope** delivered | At least one slice of: **global** / **weekly** / **per-game-mode** (exact mix agreed per Story 0). |
| **Refresh model** decided | Document whether **real-time** (client subscribes / poll) vs **batch** (scheduled recomputation) for v1. |

---

## Epic A — Discovery & ADR (design gate)

### Story A0 — Leaderboards Phase 3: scope & scoring ADR

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Decide v1 leaderboard dimensions, score definition, and refresh strategy (ADR). |

**Description**

Product and engineering agree on **what “score” means** per game mode (reuse Phase 2 aggregates vs new derived metric), which **dimensions** ship in v1 (global / weekly / per-mode — not necessarily all), **timezone** for “week,” and whether v1 uses **query-time** leaderboards vs **precomputed** documents. Capture **anti-abuse** non-goals vs must-haves for launch.

**Deliverable (merged)**

- **[`docs/leaderboards-phase3-adr.md`](leaderboards-phase3-adr.md)** — ADR with score (**`wins`** from `stats/summary`), dimensions (**global + per-mode all-time**; **weekly deferred**), refresh (**precomputed top-K + scheduled batch** preferred; collection-group alternative for small MAU), cost posture, anti-abuse P0/P1, tie-breaks, and sign-off table.

**Acceptance criteria**

- [x] Written ADR in repo (`docs/leaderboards-phase3-adr.md`) covering:
  - [x] **Score:** **`wins`** from Phase 2 aggregate (`totals` / `totalsByMode`); source `users/{uid}/stats/summary`.
  - [x] **Dimensions:** v1 = **global all-time** + **per-game-mode all-time**; **weekly out of scope** for v1; **league** axis deferred.
  - [x] **Refresh:** **Batch/snapshot** default for precomputed boards; staleness and optional “updated at” UX; collection-group query path for dev/small scale.
  - [x] **Cost posture:** **Precomputed top-K** + scheduler preferred; **collection-group + pagination** as alternative; migration path described.
  - [x] **Anti-abuse:** **P0** rate limits; **P1** verified email for listing; duplicate/prize verification deferred.
- [ ] Engineering sign-off; PM sign-off on user-visible behavior and staleness *(checkboxes in ADR)*.

**Dependencies**

- Phase 2 event/aggregate semantics documented (`docs/gameplay-stats-phase2.md`).

---

## Epic B — Data model & Firestore layout

### Story B1 — Firestore schema for leaderboard entries (query path)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Define collection paths, document shape, and fields for sortable leaderboard rows (query-time design). |

**Description**

Specify documents that support **composite queries** (e.g. `weekId + score DESC`) or sharded buckets if avoiding hot documents. Include `uid`, `displayName` snapshot or lookup strategy, `gameMode`, `weekId` / `period`, `score`, `rank` (if denormalized), `updatedAt`. Align with security rules (no client writes to authoritative scores).

**Acceptance criteria**

- [x] Schema diagram + example document JSON in `docs/`.
- [x] Rules impact listed (new paths read/write matrix).
- [x] No PII beyond what product approves (e.g. optional display name only).

**Deliverable:** [`docs/leaderboards-schema-query-path.md`](leaderboards-schema-query-path.md), [`firestore.indexes.json`](../firestore.indexes.json) (collection-group indexes), [`src/app/shared/models/leaderboard-query.model.ts`](../src/app/shared/models/leaderboard-query.model.ts).

**Dependencies**

- Story A0.

---

### Story B2 — Firestore schema for precomputed leaderboards (batch path)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Define precomputed leaderboard documents (optional v1 path) for cheap reads at scale. |

**Description**

If ADR chooses **scheduled recomputation**, define snapshot documents (v1: **`leaderboards/snapshots/boards/{boardId}`**), fixed-size **`entries`** arrays, **`generatedAt`**, **`schemaVersion`**, **`tieBreakPolicy`**. **Hybrid with B1:** same scores from `users/{uid}/stats/summary`; B1 = query-time collection-group reads; B2 = scheduled **full `set()`** replace (no client partial merge in v1).

**Acceptance criteria**

- [x] Document shape + max size considerations (1 MiB limit).
- [x] Idempotent job behavior (same input → same output; safe retries).

**Dependencies**

- Story A0; mutually exclusive implementation with B1 for the same dimension or hybrid clearly described (see deliverable doc).

**Deliverable:** [`docs/leaderboards-schema-precomputed.md`](leaderboards-schema-precomputed.md), [`src/app/shared/models/leaderboard-snapshot.model.ts`](../src/app/shared/models/leaderboard-snapshot.model.ts), [`firestore.rules`](../firestore.rules) (`leaderboards/snapshots/boards/*` read/write matrix).

---

### Story B3 — Composite indexes & pagination spec

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | List required Firestore composite indexes; document pagination contract (cursors, page size caps). |

**Description**

For each query pattern (weekly + mode + score sort, etc.), specify **collection group vs collection**, **equality filters**, **orderBy**, and deploy **`firestore.indexes.json`**. Define **max page size** (e.g. ≤ 50) and **cursor** fields to cap reads and cost.

**Acceptance criteria**

- [x] `firestore.indexes.json` entries (or explicit “none yet” with rationale).
- [x] README or doc: how to deploy indexes in staging/prod.
- [x] Client/server contract: `startAfter`, `limit`, stable ordering when scores tie (secondary sort key, e.g. `uid` or `updatedAt`).

**Dependencies**

- Story B1 (and B2 if applicable).

**Deliverable:** [`docs/leaderboards-indexes-pagination.md`](leaderboards-indexes-pagination.md), [`firestore.indexes.json`](../firestore.indexes.json), [`src/app/shared/models/leaderboard-query.model.ts`](../src/app/shared/models/leaderboard-query.model.ts) (`LEADERBOARD_*_PAGE_SIZE`), cross-links from B1 + [firestore-rules-deploy.md](firestore-rules-deploy.md) (indexes §).

---

## Epic C — Write path & concurrency

### Story C1 — Authoritative score updates (trusted writer)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Implement server-side (or CF) updates to leaderboard-eligible state from Phase 2 events or aggregates. |

**Description**

Single pipeline: on relevant gameplay outcome, update per-user leaderboard inputs or denormalized leaderboard rows. Use **transactions** or **idempotent** writes where two requests could race (same uid, same period).

**Acceptance criteria**

- [x] Writes go through **Admin SDK** or secured Cloud Function — not client-direct to authoritative fields.
- [x] Documented idempotency for retries (same event/session as Phase 2).
- [x] Unit tests for merge rules (e.g. max score vs last score).

**Dependencies**

- Phase 2 event ingestion; Story A0 scoring rules.

**Deliverable:** [`docs/leaderboards-trusted-writer-c1.md`](leaderboards-trusted-writer-c1.md) (trusted path + idempotency + merge semantics), [`server/stats-aggregate.js`](../server/stats-aggregate.js) (JSDoc cross-links), [`server/stats-aggregate.test.js`](../server/stats-aggregate.test.js) (`leaderboard score fields` tests).

---

### Story C2 — Concurrency & load test

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Verify leaderboard updates under concurrent writes; document limits. |

**Description**

Scripted or k6-style test: N parallel users updating scores for the same period; assert **no negative scores**, **no lost updates** per chosen semantics (last-write vs max), and **Firestore error rate** within SLO. Capture **hot shard** risk if one doc per global board.

**Acceptance criteria**

- [ ] Test run artifact (log or CI job) attached to ticket.
- [ ] Known issues / follow-ups documented (e.g. sharding needed at X RPS).

**Dependencies**

- Story C1.

---

## Epic D — Read path & API

### Story D1 — HTTP API: fetch leaderboard page

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | `GET` leaderboard slice with scope (global / weekly / mode), pagination, optional auth. |

**Description**

Express (or BFF) routes return JSON: rows with rank, score, uid/displayName per product rules. Public vs authenticated: decide if full list is public. Enforce **pagination** server-side.

**Acceptance criteria**

- [x] OpenAPI or README examples for query params (`scope`, `week`, `gameMode`, `pageSize`, `cursor`).
- [x] Rate limiting hooks (see Epic F) callable from middleware.
- [x] Structured logging: `requestId`, scope, latency, row count (Story 9 pattern).

**Dependencies**

- Stories B1–B3, C1.

**Deliverable:** [`docs/leaderboards-api-d1.md`](leaderboards-api-d1.md), [`server/leaderboards.http.js`](../server/leaderboards.http.js), [`server/leaderboard-query.js`](../server/leaderboard-query.js), [`server/leaderboard-log.js`](../server/leaderboard-log.js), [`server/rate-limit-hooks.middleware.js`](../server/rate-limit-hooks.middleware.js), route in [`index.js`](../index.js).

**Notes (v1):** Per-mode boards use **`scope`** (`bio-ball`, etc.); there is no separate **`gameMode`** query param. **`week`** returns 400 (weekly out of scope). Leaderboard **`GET`** is **public** (no Bearer required); **`displayName`** from Auth when resolvable.

---

### Story D2 — Angular UI: leaderboard surface

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Minimal UI: tabs or filters for scope; infinite scroll or paged list; loading/error states. |

**Description**

Consume D1; show staleness if batch refresh; respect a11y and mobile layout.

**Acceptance criteria**

- [x] E2E or manual test checklist for one staging build.
- [x] Empty state and “week resets” copy reviewed by PM.

**Dependencies**

- Story D1.

**Deliverable:** [`leaderboard-panel`](../src/app/nav/leaderboard-panel/) + [`nav`](../src/app/nav/) toolbar icons; manual steps in [leaderboards-api-d1.md](leaderboards-api-d1.md) § Angular UI. **PM:** Weekly copy N/A for v1 (subtitle: “All-time wins (v1)”).

---

## Epic E — Refresh cadence

### Story E1 — Real-time path (optional v1)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | If ADR selects real-time: Firestore snapshot listener or short poll on leaderboard collection/query. |

**Description**

Subscribe to query results or precomputed doc; throttle UI updates; handle index lag after first deploy.

**Acceptance criteria**

- [x] Documented listener query + index dependencies.
- [x] Cost estimate for expected MAU.

**Dependencies**

- B3, D2.

**Deliverable (merged)**

- **[`docs/leaderboards-realtime-e1.md`](leaderboards-realtime-e1.md)** — B2 single-doc `onSnapshot` (no composite index), D1 short-poll, throttle / pagination notes, rough MAU cost formulas.
- **Optional client wiring:** `leaderboardUseFirestoreSnapshot` and `leaderboardPollIntervalMs` in [`src/environment.ts`](../src/environment.ts); [`leaderboard-panel`](../src/app/nav/leaderboard-panel/) implements both paths.

---

### Story E2 — Batch / scheduled refresh (optional v1)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | If ADR selects batch: Cloud Scheduler + job to rebuild `leaderboards/*` docs. |

**Description**

Job reads source of truth (aggregates or events sample), writes precomputed docs, sets `generatedAt`. Alert on job failure.

**Acceptance criteria**

- [x] Scheduler YAML or console screenshot for staging.
- [x] Logs/metrics for job duration and failure (align Story 9).
- [x] “Data as of” timestamp exposed to API/UI.

**Dependencies**

- Story B2, C1.

**Deliverable (merged)**

- **[`docs/leaderboards-batch-e2.md`](leaderboards-batch-e2.md)** — batch job, `POST /api/internal/v1/leaderboard-snapshots/rebuild`, Cloud Scheduler `gcloud` example + console steps, env `LEADERBOARD_SNAPSHOT_CRON_SECRET`, `npm run rebuild:leaderboard-snapshots`.
- **Code:** [`server/leaderboard-snapshot-job.js`](../server/leaderboard-snapshot-job.js), [`server/leaderboards-snapshot-rebuild.http.js`](../server/leaderboards-snapshot-rebuild.http.js), [`server/leaderboard-snapshot-log.js`](../server/leaderboard-snapshot-log.js); **`GET /api/v1/leaderboards`** returns **`snapshotGeneratedAt`**; leaderboard panel shows “Data as of” from API or snapshot doc.

---

## Epic F — Anti-abuse & trust

### Story F1 — Rate limits (API + optionally Firestore rules)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Apply rate limits to leaderboard-related **writes** and sensitive **reads** (per IP / per uid). |

**Description**

Express middleware or API Gateway; thresholds for `POST` score paths and aggressive `GET` pagination. Return **429** with retry-after where appropriate.

**Acceptance criteria**

- [x] Limits documented; staging test proves 429 path.
- [x] No secrets in error bodies/logs.

**Dependencies**

- Story D1.

**Deliverable (merged)**

- **[`docs/leaderboards-rate-limits-f1.md`](leaderboards-rate-limits-f1.md)** — defaults, env vars, staging `curl` loop for 429, Firestore rules note.
- **Code:** [`server/rate-limit-hooks.middleware.js`](../server/rate-limit-hooks.middleware.js), [`server/in-memory-rate-limit.js`](../server/in-memory-rate-limit.js), [`server/client-ip.js`](../server/client-ip.js); `GET /api/v1/leaderboards` + `POST /api/v1/me/gameplay-events` wired; [`firestore.rules`](../firestore.rules) comment (rules do not implement RPS).

---

### Story F2 — Duplicate account friction (design + minimal impl)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Document and implement **one** friction lever for v1 (e.g. email verified required to appear on board). |

**Description**

Product picks minimum bar: verified email, captcha on signup, or “shadow” period — engineering implements the smallest slice that fits ADR.

**Acceptance criteria**

- [x] Rule enforced in API or Auth trigger; documented in user-facing FAQ if needed.
- [x] Test accounts bypass documented for QA only.

**Dependencies**

- Story A0.

**Deliverable (merged)**

- **[`docs/leaderboards-duplicate-accounts-f2.md`](leaderboards-duplicate-accounts-f2.md)** — design, FAQ line, QA env `LEADERBOARD_REQUIRE_EMAIL_VERIFIED=false`.
- **Code:** [`server/leaderboard-email-verified.js`](../server/leaderboard-email-verified.js); [`server/auth-display-names.js`](../server/auth-display-names.js) (`fetchAuthFieldsForUids`); [`GET /api/v1/leaderboards`](../server/leaderboards.http.js) + snapshot job filter; response **`listingPolicy`**; leaderboard panel hint.

---

### Story F3 — Prize / verification gate (optional)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | If prizes exist: verification step before claiming (manual review flag or form). |

**Description**

Out of scope for many v1s; story exists so Jira tracks explicit deferral or thin implementation.

**Acceptance criteria**

- [x] Either “deferred” with ADR note or minimal flow with owner.

**Dependencies**

- Story A0.

**Deliverable (merged)**

- **Deferred path:** ADR anti-abuse table updated + **[`docs/leaderboards-prize-verification-f3.md`](leaderboards-prize-verification-f3.md)** — v1 scope, future claim/review shape, owners, “what not to do.”

---

## Epic G — QA, cohort test & exit gate

### Story G1 — Test cohort: seed + correctness checklist

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Fixed set of UIDs and expected ranks/scores; automated or spreadsheet reconciliation. |

**Description**

Seed data in staging; run reconciliation script or export; compare to leaderboard API output for global / weekly / mode as shipped.

**Acceptance criteria**

- [ ] Signed checklist: “leaderboard correct for test cohort.”
- [ ] Known edge cases listed (ties, week boundary, timezone).

**Dependencies**

- D1, C1, and chosen E1/E2.

---

### Story G2 — Operational runbook

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Runbook: index deploy, cache bust, job replay, disable leaderboards flag. |

**Description**

On-call steps; link to Cloud Logging filters; feature flag to hide UI/API if needed.

**Acceptance criteria**

- [ ] `docs/leaderboards-runbook.md` merged.

**Dependencies**

- Stories B3, E2 (if batch).

---

## Suggested Jira hierarchy (quick reference)

| Epic | Stories |
|------|---------|
| **A — Discovery** | A0 |
| **B — Data model** | B1, B2, B3 |
| **C — Writes** | C1, C2 |
| **D — Read/API/UI** | D1, D2 |
| **E — Refresh** | E1, E2 (pick per ADR) |
| **F — Anti-abuse** | F1, F2, F3 |
| **G — QA & ops** | G1, G2 |

---

## Notes for Jira fields

- **Story points:** Engineering estimates per story after ADR (A0).  
- **Priority:** A0 → B* → C1 → D1 → G1 on critical path.  
- **Links:** Blocks / relates to Phase 2 epic “Gameplay stats Phase 2” if tracked.
