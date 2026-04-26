# Roadmap: active contest leaderboards in the leaderboard panel

**Status:** Phases 0–3 shipped (UX, live HTTP + cache, Angular weekly standings table + poll); Phases 4–5 remain optional / ops polish.  
**Goal:** Surface **live** weekly-contest standings (while a contest is **`open`**) inside the nav **leaderboard panel**, alongside today’s **all-time** boards.

**Context today**

- **Leaderboard panel** (`src/app/nav/leaderboard-panel/`): **All-time** — scopes `global`, `bio-ball`, `career-path`, `nickname-streak`; data from Firestore snapshots `leaderboards/snapshots/boards/{scope}` or HTTP `/api/v1/leaderboards` (see `docs/leaderboards/`). **Weekly contest** — Firestore open-contest picker + ADR copy + **HTTP live standings table** (`GET /api/v1/contests/:contestId/leaderboard`) with optional **`contestLiveLeaderboardPollIntervalMs`** (`CONTEST_LIVE_LEADERBOARD_POLL_MS` at build, default 30s). Build flags: `weeklyContestsUiEnabled` **and** `leaderboardContestTabEnabled`.
- **Weekly contests** (`docs/weekly-contests/weekly-contests-phase4-adr.md`): mini-league score is derived from **`users/{uid}/gameplayEvents`**, not from `stats/summary`. Immutable **`contests/{contestId}/results/final`** is written only after the **E2** scoring job (`server/contests/contest-scoring-job.js`).
- **Active** contests (`status: open`) have **no** `results/final` yet. A “live contest leaderboard” must therefore **recompute** the same slate + ordering rules as scoring (or maintain a **materialized** cache — see Phase 4).

---

## Phase 0 — Product and UX lock-in

**Shipped (Angular):** `leaderboard-panel` exposes **All-time** vs **Weekly contest** (when `environment.weeklyContestsUiEnabled && environment.leaderboardContestTabEnabled`). Weekly tab lists **`open`** contests only (Firestore query + Bio Ball filter); **`scoring`** / **`paid`** / **`scheduled`** are not listed (no frozen “last computed” copy in this panel until product asks for it). Scope copy states **Bio Ball v1** only for the contest path; all-time scopes unchanged. **Contest picker:** title + window end. **ADR helper copy** for the selected contest: first **`leagueGamesN`** Bio Ball games after join, within **`[windowStart, windowEnd)`**. **Listing policy:** same Story F2 verified-email hint as all-time when the all-time source has set it. **Rollout:** `LEADERBOARD_CONTEST_TAB_ENABLED=false` at build hides only this tab (contests drawer still follows `WEEKLY_CONTESTS_UI_ENABLED`). See `scripts/generate-env-prod.mjs`.

---

## Phase 1 — Authoritative server API (live standings)

**Shipped**

- **Route:** `GET /api/v1/contests/:contestId/leaderboard` — public, read-only. Registered **before** `GET /api/v1/contests/:contestId` in `index.js`.
- **Preconditions:** Contest exists; **`status === 'open'`**; **`gameMode === 'bio-ball'`**. No `now < windowEnd` gate (join window edge cases handled by contest lifecycle).
- **Response:** `standings[]` matches `results/final` row shape; **meta:** `leagueGamesN`, `windowStart` / `windowEnd` (ISO), **`computedAt`** (ISO wall clock), **`tieBreakPolicy`**, **`eventSource`**, `entrantsConsidered`, **`entrantsCapped`** (500-entrant read cap).
- **Implementation:** `server/contests/contest-standings-compute.js` — **`loadQualifyingSlate`** (exported) + **`computeStandingsForEntryDocs`** shared with **`contest-scoring-job.js`** (E2).
- **Auth:** None (engagement); **IP rate limit** via `contestLiveStandingsRateLimitHookMiddleware` (`CONTEST_LIVE_STANDINGS_RATE_LIMIT_*`).
- **Docs:** [weekly-contests-api-contest-live-leaderboard.md](../weekly-contests/weekly-contests-api-contest-live-leaderboard.md)

**References:** `docs/weekly-contests/weekly-contests-phase4-adr.md`, `docs/weekly-contests/weekly-contests-schema-results.md`, `server/contests/contest-scoring-job.js`.

---

## Phase 2 — Performance, caching, and correctness

**Shipped**

- **Cache:** In-process **TTL** map (`server/contests/contest-live-leaderboard-cache.js`) keyed by SHA-256 of `contestId`, window bounds, `leagueGamesN`, `contests.updatedAt` (when set), entrant-cap flag, and sorted **`entries/{uid}`** `joinedAt` millis — recomputes after new joins or contest edits. **`CONTEST_LIVE_LEADERBOARD_CACHE_TTL_MS`** (default **30000**; **`0` = off**), **`CONTEST_LIVE_LEADERBOARD_CACHE_MAX_KEYS`** (default **250** eviction of oldest).
- **Response:** `cache.hit` boolean; cache hits reuse stored **`computedAt`** and log `outcome: ok_cache_hit`.
- **Tests:** `contest-live-leaderboard-cache.test.js` (fingerprint stability, TTL, eviction); `contest-standings-compute.test.js` extended with empty slate, single entrant, **uid tie-break** golden order, and **deterministic repeat** (E2 / live parity on frozen inputs). Half-open `windowEnd` is enforced by Firestore query shape (see `loadQualifyingSlate` comment).

---

## Phase 3 — Angular: leaderboard panel integration

**Shipped**

- **Contest list:** Still **Firestore** for open contests (anonymous-friendly per rules). Optional later: authenticated list for rate-limit alignment only.
- **State:** Weekly tab loads standings when the selected contest changes (and on first open-contest snapshot). **Poll:** `environment.contestLiveLeaderboardPollIntervalMs` — **`CONTEST_LIVE_LEADERBOARD_POLL_MS`** in `generate-env-prod.mjs` (default **30000** when unset; **`0`** / off / false / none disables).
- **Table:** Columns **#**, **Player**, **W**, **GP**, **L**, **Ab**, **Tier**; “Standings as of …” from API `computedAt`. All-time table unchanged.
- **Feature flag:** unchanged — `leaderboardContestTabEnabled` + `weeklyContestsUiEnabled`.

**References:** `src/app/nav/leaderboard-panel/leaderboard-panel.component.ts`, `docs/weekly-contests/weekly-contests-api-contest-live-leaderboard.md`.

---

## Phase 4 — (Optional) Materialized “live” document

If API cost or latency is too high at scale:

- On qualifying **`gameplayEvents`** writes for users entered in **`open`** contests, a **Cloud Function** (or trusted worker) may update **`contests/{contestId}/liveStandings/{docId}`** (or a paginated subcollection) with a **read-only public projection** — **not** implemented in-repo yet.
- **`firestore.rules`:** explicit **`liveStandings/{docId}`** match with **`allow read, write: if false`** — clients must use **`GET /api/v1/contests/:contestId/leaderboard`** (rate limits, cache, single policy surface). Do not widen to signed-in reads without product + security review.
- **Lifecycle (implemented):** `deleteContestLiveStandingsSubtree` in `server/contests/contest-live-standings-artifacts.js` runs after any transition **`open` → not `open`** via `runContestStatusTransition`, and after **E1** `open` → `scoring` in `contest-close-due-windows.http.js`, so materialized rows cannot linger past **`results/final`**.

---

## Phase 5 — Docs, ops, rollout

- **Docs:** This file + short API note under `docs/weekly-contests/` (contract, rate limits, cache).
- **Runbook:** Staging verification — open contest + synthetic events; compare live response to a **closed** clone run through E2 for parity.
- **Monitoring:** Structured logs per request: `contestId`, duration, entrant count; alert on p95 latency or error rate.

---

## Dependencies and risks

| Risk | Mitigation |
|------|------------|
| Rank logic **drifts** from E2 scoring | Single shared ranking module; golden tests |
| **Firestore rules** if exposing raw `entries` / events to clients | Prefer HTTP aggregation; or dedicated projection docs + strict reads |
| **`leaderboardUseFirestoreSnapshot`** vs HTTP for all-time | Contest path is **always** HTTP (or a dedicated snapshot path later), not `boards/{scope}` |
| Multi-open contests per `gameMode` | Join rules already constrain “one open per game type” (`server/contests/contest-blocking-entry.js`) — align picker UX |

---

## Suggested implementation order

1. ~~Extract / share **live standings computation** with the scoring job.~~  
2. ~~Implement **`GET /api/v1/contests/:contestId/leaderboard`** + server tests.~~  
3. ~~Wire **leaderboard panel** (mode switch, contest picker, polling).~~  
4. ~~Add **in-process cache** + rate limits; ops/runbook as needed.~~  
5. (Later) **Materialized live doc** if metrics require it.

---

## Related docs

- `docs/weekly-contests/weekly-contests-phase4-adr.md` — mini-league rules  
- `docs/weekly-contests/weekly-contests-schema-results.md` — `results/final` shape  
- `docs/leaderboards/leaderboards-phase3-adr.md` — global leaderboard vs stats  
- `docs/leaderboards/leaderboards-api-d1.md` — existing leaderboard HTTP (if present)
