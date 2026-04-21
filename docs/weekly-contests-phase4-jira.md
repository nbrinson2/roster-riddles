# Phase 4 — Weekly contests (Jira backlog)

**Scope:** Product-backed **weekly contests** with clear windows, join semantics, post-close scoring, and **dry-run payout lines** (numeric only — **no Stripe**, no real money movement).  
**Prerequisite:** Phase 2 gameplay stats (events + `users/{uid}/stats/summary`) stable; Phase 3 leaderboards patterns (trusted writers, batch jobs, structured logs) available as reference.

**Suggested labels:** `phase-4`, `contests`, `weekly`  
**Suggested fix version:** `Weekly contests v1 (dry-run)`

---

## Phase exit criteria (product)

| Criterion | Verification |
|-----------|----------------|
| **Full weekly cycle in staging** | Contest created → **scheduled** → **open** → entries → window closes → **scoring** → standings written → **paid** (dry-run amounts) or **cancelled** path tested. |
| **Fake currency or zero-dollar** | Entries and payout records use **test-only** currency labels or **$0** / notional amounts; no live payment rails. |
| **Immutable results** | After scoring completes, **final ranks** and tie resolution are stored in **append-only / non-client-writable** records. |
| **Idempotent join** | Same user joining the same contest repeatedly does **not** duplicate entries; rules snapshot is consistent with join time. |

**Story G2 — recording evidence:** Use the sign-off template in [weekly-contests-runbook-g2.md](weekly-contests-runbook-g2.md). A **PR comment** or **ticket** with contest ids, dates, and **paid** + **cancelled** path notes satisfies “evidence” for the exit table above.

---

## Epic A — Discovery & ADR (design gate)

### Story A0 — Weekly contests Phase 4: ADR (entities, lifecycle, scoring, payouts)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | ADR: contest window, status machine, entry idempotency, scoring source of truth, tie-breaks, dry-run payout shape, staging-only money semantics. |

**Description**

Lock **product rules** for v1: what “week” means (**timezone**, boundaries), which **stats/events** drive the score for the window (delta from Phase 2 aggregates vs event replay), **maximum entrants**, **late join** rules, **cancellation** policy, and how **ties** resolve (explicit ordered tie-break keys). Define **Firestore-first** entities: `contests/{contestId}`, entries keyed by **`contestId` + `uid`**, and **immutable** post-close artifacts (e.g. `contests/{id}/standings/final` or dedicated collection — to be fixed in ADR). Document **non-goals:** no Stripe, no tax/KYC, no withdrawal.

**Acceptance criteria**

- [x] **`docs/weekly-contests-phase4-adr.md`** merged with:
  - [x] **Status machine:** `scheduled` → `open` → `scoring` → `paid` \| `cancelled` (and `scoring` → `cancelled` on failure / admin cancel).
  - [x] **Contest document** minimum fields: `windowStart`, `windowEnd` (instants), `rulesVersion`, `status`, `createdAt`, `updatedAt`, optional `metadata` for admin.
  - [x] **Entry document:** idempotent key **`contestId` + `uid`**, `joinedAt`, **`rulesAcceptedVersion`** (snapshot), `displayNameSnapshot` or policy for public display.
  - [x] **Scoring:** authoritative inputs (event replay, **first `leagueGamesN` games after join** — mini-league), idempotent job, **immutable** final standings + tie resolution record.
  - [x] **Dry-run payouts:** numeric **`amountCents`** / **`currency`** / **`notRealMoney`** — **no** Stripe objects.
  - [x] **Security posture:** client cannot write contest outcomes or standings; trusted jobs/server only.
  - [x] **Scope:** **Bio Ball (`bio-ball`) only** for Phase 4 v1; other modes deferred in ADR.
- [ ] PM + engineering sign-off recorded in ADR table *(fill names/dates in [`weekly-contests-phase4-adr.md`](weekly-contests-phase4-adr.md))*.

**Dependencies**

- Phase 2 stats/event pipeline documented.

**Deliverable (merged)**

- **[`docs/weekly-contests-phase4-adr.md`](weekly-contests-phase4-adr.md)** — bio-ball-only **mini-league** (`leagueGamesN` games after join; **product default `10`**): lifecycle, `contests/{id}` + `entries/{uid}`, `results/final`, dry-run payouts, tie-break, security.

---

## Epic B — Data model & Firestore

### Story B1 — Schema: `contests/{contestId}`

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Implement Firestore contest documents: window, `rulesVersion`, `status`, indexes for list-by-status and list-by-window. |

**Description**

Authoritative **`contests/{id}`** documents with **typed** fields, validation on write (trusted admin path or controlled Cloud Function), and **read** patterns for client “upcoming / open / past” lists. Include **status transition** constraints (who can move which transition). Version **`rulesVersion`** so entries can snapshot accepted rules.

**Acceptance criteria**

- [x] Document shape and example JSON in `docs/` linked from ADR.
- [x] **`firestore.rules`** allow authenticated users **read** where product allows; **no** client writes to `status` or window fields unless explicitly designed (prefer server-only).
- [x] Composite indexes as needed for listing contests (document queries in story notes).

**Dependencies**

- Story A0.

**Deliverable (merged)**

- **[`docs/weekly-contests-schema-contests.md`](weekly-contests-schema-contests.md)** — field table, example JSON, query notes.
- **[`firestore.rules`](../firestore.rules)** — `contests/{contestId}` read if signed-in; no client writes; subpaths denied until B2+.
- **[`firestore.indexes.json`](../firestore.indexes.json)** — `status` + `windowStart` / `windowEnd` composite indexes.
- **[`src/app/shared/models/contest.model.ts`](../src/app/shared/models/contest.model.ts)** — `ContestDocument`, `ContestStatus`, schema version + defaults.

---

### Story B2 — Schema: entries `{contestId}` × `{uid}` (idempotent join)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Entry subcollection or composite-key collection: one row per `(contestId, uid)`, rules snapshot, join timestamps. |

**Description**

Choose **physical layout** (e.g. `contests/{contestId}/entries/{uid}` or `contestEntries/{contestId}_{uid}`) with **deterministic id** so retried joins upsert. Store **`rulesAcceptedVersion`** (and optional hash of rules text), **`joinedAt`**, **`clientRequestId`** optional for dedupe logging.

**Acceptance criteria**

- [x] **Idempotent join:** duplicate POSTs or retries create **one** entry; documented behavior for late join after `open` ends (reject with clear error).
- [x] Rules snapshot ties to **`rulesVersion`** active at join time (or explicit mismatch handling).
- [x] Indexes for “my entries” and admin queries if required.

**Dependencies**

- Stories A0, B1.

**Deliverable (merged)**

- **[`docs/weekly-contests-schema-entries.md`](weekly-contests-schema-entries.md)** — path `contests/{contestId}/entries/{uid}`, fields, idempotency, late-join policy pointer (API in C1).
- **[`firestore.rules`](../firestore.rules)** — read **own** entry doc only; **no** client writes.
- **[`firestore.indexes.json`](../firestore.indexes.json)** — collection group **`entries`**: `uid` + `joinedAt` + `__name__` (my-entries query).
- **[`src/app/shared/models/contest-entry.model.ts`](../src/app/shared/models/contest-entry.model.ts)** — `ContestEntryDocument`.

---

### Story B3 — Schema: immutable final standings & tie metadata

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Write-once records for final ranks, scores, tie-break keys, and job idempotency token. |

**Description**

After scoring, persist **immutable** artifacts (path per ADR), e.g. final ordered list with **`rank`**, **`score`**, **`tieBreakKey`**, **`uid`**, **`computedAt`**, **`scoringJobId`**. Prevent client updates via rules; server/job only. Support **re-run safety:** second run with same inputs yields same logical result or explicit noop.

**Acceptance criteria**

- [x] No client write access to standings documents.
- [x] **Idempotent scoring job:** safe retries; document `jobId` / monotonic `attempt` if needed.
- [x] Example payload in docs for QA comparison.

**Dependencies**

- Stories A0, B1, B2.

**Deliverable (merged)**

- **[`docs/weekly-contests-schema-results.md`](weekly-contests-schema-results.md)** — `results/final`, `payouts/dryRun`, standing rows, tie metadata, QA JSON.
- **[`firestore.rules`](../firestore.rules)** — `results/*`, `payouts/*` read if signed-in; no client writes.
- **[`src/app/shared/models/contest-results-final.model.ts`](../src/app/shared/models/contest-results-final.model.ts)** — `ContestFinalResultsDocument`, `ContestStandingRow`.
- **[`src/app/shared/models/contest-payouts-dry-run.model.ts`](../src/app/shared/models/contest-payouts-dry-run.model.ts)** — dry-run payout lines.

---

## Epic C — Join & rules UX (API + client)

### Story C1 — Join contest API (authenticated)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | `POST` (or equivalent) to join open contest; validates window + status; writes idempotent entry with rules snapshot. |

**Description**

Express (or Cloud Function) endpoint: verify Firebase **ID token**, load contest, reject if not `open` or outside policy, **`set`/`merge`** entry with **`rulesAcceptedVersion`**, return entry + contest summary. Structured logs: `component: contest_join`, `outcome`, `requestId`, **no** PII beyond uid already implied.

**Acceptance criteria**

- [x] Returns **400** with stable `error.code` for wrong status, closed window; idempotent duplicate → **200** (not 409).
- [x] Idempotent: same user+contest → **200** with **`idempotentReplay: true`** and entry payload.
- [x] Rate limit: per-uid fixed window (`CONTEST_JOIN_RATE_LIMIT_*`, `RATE_LIMITS_DISABLED`).

**Dependencies**

- Stories B1, B2.

**Deliverable (merged)**

- **[`docs/weekly-contests-api-c1.md`](weekly-contests-api-c1.md)** — contract, errors, env.
- **`POST /api/v1/contests/:contestId/join`** in [`index.js`](../index.js); [`server/contest-join.http.js`](../server/contest-join.http.js), [`server/contest-join-log.js`](../server/contest-join-log.js); [`contestJoinRateLimitHookMiddleware`](../server/rate-limit-hooks.middleware.js).

---

### Story C2 — Client: discover contests & join flow

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Minimal UI: list open/upcoming contest, detail with rules text for `rulesVersion`, join button, confirmation of rules acceptance. |

**Description**

Angular (or existing shell): read contests user can see, show **window** in user-local or stated timezone, block join when not `open`. Show **“Dry run — no real money”** copy where payouts are described.

**Acceptance criteria**

- [ ] User can complete join for staging contest end-to-end (manual QA).
- [x] Rules version shown matches what is stored on entry (join success + `entries/{uid}` listener; checkbox ties to `rulesVersion`).

**Dependencies**

- Story C1; contest list uses **Firestore signed-in reads** on `contests` (Story B1). REST list (D2) optional later.

**Deliverable (merged)**

- **[`src/app/nav/contests-panel/`](../src/app/nav/contests-panel/)** — list (open + scheduled Bio Ball), detail with rules narrative per `rulesVersion`, dry-run payout banner, accept checkbox, `POST /api/v1/contests/:contestId/join`, own-entry snapshot.
- **`environment.weeklyContestsUiEnabled`** — [`src/environment.ts`](../src/environment.ts); staging/prod via **`WEEKLY_CONTESTS_UI_ENABLED`** in [`scripts/generate-env-prod.mjs`](../scripts/generate-env-prod.mjs); stub [`src/environment.prod.ts`](../src/environment.prod.ts).
- **Nav** — event icon opens drawer ([`nav.component`](../src/app/nav/nav.component.ts)).

---

## Epic D — Lifecycle & operations

### Story D1 — Contest status transitions (server-enforced)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Implement allowed transitions; scheduled job or admin path to open, close, and trigger scoring; cancel path. |

**Description**

Define **who** moves `scheduled`→`open` (clock vs manual), `open`→`scoring` (close window), `scoring`→`paid`/`cancelled`. Implement **guards** so illegal skips are rejected. Log all transitions with actor (`system` vs `adminUid`).

**Acceptance criteria**

- [x] Matrix of allowed transitions in ADR or ops doc; code matches.
- [x] **No** client-direct status flips — Firestore rules deny client writes on `contests/*`; transitions via **`POST /api/internal/v1/contests/:contestId/transition`** (secret).

**Dependencies**

- Story B1.

**Deliverable (merged)**

- **[`docs/weekly-contests-ops-d1.md`](weekly-contests-ops-d1.md)** — transition matrix, endpoint, env, examples.
- **[`server/contest-transitions.js`](../server/contest-transitions.js)** — adjacency + guards (`open`→`scoring` / `windowEnd` + optional `force`).
- **[`server/contest-transition.http.js`](../server/contest-transition.http.js)**, **[`server/contest-transition-log.js`](../server/contest-transition-log.js)** — transactional update, structured logs.
- **[`index.js`](../index.js)** — `POST /api/internal/v1/contests/:contestId/transition`.
- **[`server/contest-transitions.test.js`](../server/contest-transitions.test.js)** — matrix + time guard unit tests.

---

### Story D2 — Read APIs: contest list & detail (public or authenticated per ADR)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | `GET` endpoints or Firestore queries (per ADR) for listing contests and reading `contestId` details safe for clients. |

**Description**

Expose minimal fields for UI; hide internal admin notes. Pagination if list grows.

**Acceptance criteria**

- [x] Document OpenAPI or markdown contract.
- [ ] Staging verified with C2 (manual QA).

**Dependencies**

- Story B1.

**Deliverable (merged)**

- **[`docs/weekly-contests-api-d2.md`](weekly-contests-api-d2.md)** — contract, query params, errors, rate limits.
- **`GET /api/v1/contests`**, **`GET /api/v1/contests/:contestId`** — [`index.js`](../index.js); [`server/contest-read.http.js`](../server/contest-read.http.js); [`server/contest-public.js`](../server/contest-public.js); [`server/contest-read-log.js`](../server/contest-read-log.js); [`contestReadRateLimitHookMiddleware`](../server/rate-limit-hooks.middleware.js).
- **[`server/contest-public.test.js`](../server/contest-public.test.js)** — projection tests.

---

## Epic E — Scoring job

### Story E1 — Close-window detector + enqueue scoring

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | When `windowEnd` passes, transition contest to `scoring` and trigger scoring job (HTTP hook, Pub/Sub, or Cloud Scheduler). |

**Description**

Reliable **at-least-once** trigger; dedupe so multiple schedulers don’t corrupt. Align with Cloud Run/Scheduler patterns used for leaderboard rebuild (E2-style secret optional).

**Acceptance criteria**

- [x] Missed trigger recovery documented (manual replay command).
- [x] Logs with `component: contest_scoring` (or similar) and `contestId`.

**Dependencies**

- Stories D1, B1.

**Deliverable (merged)**

- **[`docs/weekly-contests-ops-e1.md`](weekly-contests-ops-e1.md)** — hook contract, env, recovery, Scheduler example.
- **`POST /api/internal/v1/contests/close-due-windows`** — [`index.js`](../index.js); [`server/contest-close-due-windows.http.js`](../server/contest-close-due-windows.http.js); [`server/contest-scoring-log.js`](../server/contest-scoring-log.js).

---

### Story E2 — Scoring worker: compute ranks from stats/events for window

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | For entrants only, compute score from Phase 2 **events** or **aggregate diffs** per ADR; assign ranks with tie-break; write B3 artifacts. |

**Description**

Trusted code path using Admin SDK: query events in `[windowStart, windowEnd)` (or equivalent), or recompute from stats snapshots if ADR specifies. Handle **users with no activity** in window (rank at bottom or exclude — per ADR). Persist **immutable** standings + **tie resolution** blob.

**Acceptance criteria**

- [x] Deterministic ordering for ties (same as ADR).
- [x] **Idempotent** job: re-run does not duplicate rows or flip winners without explicit admin reset story.
- [x] Performance note: bounded reads; avoid full table scan if possible.

**Dependencies**

- Stories B3, E1, Phase 2 event indexes if querying events.

**Deliverable (merged)**

- **[`docs/weekly-contests-ops-e2.md`](weekly-contests-ops-e2.md)** — contract, E1 webhook wiring, index note.
- **`POST /api/internal/v1/contests/run-scoring`** — [`index.js`](../index.js); [`server/contest-scoring.http.js`](../server/contest-scoring.http.js); [`server/contest-scoring-job.js`](../server/contest-scoring-job.js); [`server/contest-scoring-core.js`](../server/contest-scoring-core.js); [`server/contest-internal-auth.js`](../server/contest-internal-auth.js).
- **[`server/contest-scoring-core.test.js`](../server/contest-scoring-core.test.js)** — tie/slate unit tests.
- **[`firestore.indexes.json`](../firestore.indexes.json)** — `gameplayEvents` composite for `gameMode` + `createdAt`.

---

### Story E3 — Tie resolution record (audit)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Store explicit tie-break rationale per rank bucket (e.g. secondary key, coin-flip forbidden unless ADR allows). |

**Description**

Human- and machine-readable structure so support can answer “why #2 and #3 tied.” Immutable after write.

**Acceptance criteria**

- [x] Documented in ADR + example JSON.
- [x] Referenced from final standings doc.

**Dependencies**

- Story E2.

**Deliverable (merged)**

- [`server/contest-scoring-tie-audit.js`](../server/contest-scoring-tie-audit.js) — build `tieResolution` for `results/final`.
- [`server/contest-scoring-tie-audit.test.js`](../server/contest-scoring-tie-audit.test.js) — unit tests.
- [`server/contest-scoring-job.js`](../server/contest-scoring-job.js) — writes structured `tieResolution`.
- [`docs/weekly-contests-schema-results.md`](weekly-contests-schema-results.md), [`docs/weekly-contests-phase4-adr.md`](weekly-contests-phase4-adr.md) — schema + ADR cross-links.
- [`src/app/shared/models/contest-results-final.model.ts`](../src/app/shared/models/contest-results-final.model.ts) — TypeScript types.

---

## Epic F — Dry-run payouts (no Stripe)

### Story F1 — Payout lines: “winner gets $X” as numbers only

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | After `scoring`, compute notional payout rows: place → `amountCents`, `currency` / fake currency; store server-side; no Stripe calls. |

**Description**

Data model e.g. `contests/{id}/payouts/dryRun` or embedded array with **`schemaVersion`**. Support **zero-dollar** and **fake currency** modes for staging. Transition contest to **`paid`** when dry-run records are finalized (meaning “payout *lines* recorded,” not money sent).

**Acceptance criteria**

- [x] **No** Stripe SDK usage; grep/CI guard optional.
- [x] Clear UI/copy: **not real money**.
- [x] **`paid`** status means “dry-run payout artifact committed,” documented in ADR.

**Dependencies**

- Stories E2, D1.

---

### Story F2 — Admin or script: override / cancel dry-run (optional)

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Minimal tool to mark contest `cancelled` or re-open scoring with audit (only if ADR allows). |

**Description**

Optional for staging chaos; can be **curl + secret** internal endpoint. If out of scope, replace with **manual Firestore** procedure in runbook (document only).

**Acceptance criteria**

- [x] Either implemented with auth **or** explicitly deferred with **runbook** steps.

**Dependencies**

- Story D1.

**Deliverable (merged)**

- **[`docs/weekly-contests-ops-f2.md`](weekly-contests-ops-f2.md)** — `paid` → `cancelled` \| `scoring` with **`force: true`**, secret auth, optional `reason`, artifact deletes; curl examples + manual Firestore fallback.
- **[`server/contest-transitions.js`](../server/contest-transitions.js)** — `paid` edges; **`override_requires_force`** without `force`.
- **[`server/contest-transition.http.js`](../server/contest-transition.http.js)** — transactional delete of **`results/final`** and **`payouts/dryRun`** on F2 transitions.

---

## Epic G — QA, staging cycle, exit gate

### Story G1 — Staging seed: fake contest + entrants

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Script or doc: seed `contests/{id}`, test users join, events in window for predictable ranks. |

**Description**

Repeatable checklist similar to leaderboard G1: known UIDs, expected ranks after scoring, dry-run payout numbers.

**Acceptance criteria**

- [x] `docs/` checklist + optional `npm run` script stub referenced.
- [x] **Fake currency** or **$0** called out in seed data.

**Dependencies**

- Stories C1, E2, F1.

**Deliverable (merged)**

- **[`docs/weekly-contests-staging-seed-g1.md`](weekly-contests-staging-seed-g1.md)** — checklist, env, post-seed lifecycle pointers.
- **[`docs/fixtures/weekly-contest-staging.example.json`](fixtures/weekly-contest-staging.example.json)** — example contest + entrants + **`slate`** + **`expectedAfterScoring`** (**FAKE_USD** / **`dryRunWinnerAmountCents`**).
- **[`scripts/seed-weekly-contest-staging.mjs`](../scripts/seed-weekly-contest-staging.mjs)** — `npm run seed:weekly-contest-staging` (optional **`--dry-run`**).

---

### Story G2 — End-to-end weekly cycle in staging

| Field | Value |
|-------|--------|
| **Type** | Story |
| **Summary** | Demo path: contest lifecycle completes; standings immutable; dry-run payout visible; sign-off. |

**Description**

Runbook: who runs triggers, how to verify logs, how to reset for another week (new `contestId`).

**Acceptance criteria**

- [x] **Exit criteria** table in this doc marked complete with evidence (screenshots optional; PR comment acceptable).
- [x] **`paid`** and **`cancelled`** paths both exercised at least once across staging runs (can be two different contests).

**Dependencies**

- Stories G1, F1, E2, D1, C2.

**Deliverable (merged)**

- **[`docs/weekly-contests-runbook-g2.md`](weekly-contests-runbook-g2.md)** — staging E2E steps (**paid** path), **`cancelled`** path options, log checks, reset guidance, PR/ticket sign-off template.

---

## Suggested Jira hierarchy (quick reference)

| Epic | Stories |
|------|---------|
| **A — ADR** | A0 |
| **B — Data model** | B1, B2, B3 |
| **C — Join & UX** | C1, C2 |
| **D — Lifecycle** | D1, D2 |
| **E — Scoring** | E1, E2, E3 |
| **F — Dry-run payouts** | F1, F2 (optional) |
| **G — QA** | G1, G2 |

---

## Notes for Jira fields

- **Story points:** Estimate after A0.  
- **Spikes:** If event replay vs aggregate diff is uncertain, add a **time-boxed spike** before E2.  
- **Compliance:** Even with no money, avoid storing unnecessary PII in contest artifacts; align with existing privacy posture.
