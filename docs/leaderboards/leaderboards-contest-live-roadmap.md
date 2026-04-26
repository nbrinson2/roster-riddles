# Roadmap: active contest leaderboards in the leaderboard panel

**Status:** Phases 0–2 shipped (UX, live HTTP, in-process cache + parity tests); Phases 3–5 (Angular table wiring, optional materialized doc, ops polish) remain.  
**Goal:** Surface **live** weekly-contest standings (while a contest is **`open`**) inside the nav **leaderboard panel**, alongside today’s **all-time** boards.

**Context today**

- **Leaderboard panel** (`src/app/nav/leaderboard-panel/`): **All-time** — scopes `global`, `bio-ball`, `career-path`, `nickname-streak`; data from Firestore snapshots `leaderboards/snapshots/boards/{scope}` or HTTP `/api/v1/leaderboards` (see `docs/leaderboards/`). **Weekly contest** (Phase 0) — segment + open-contest picker + ADR copy + placeholder for live rows; contest list from client Firestore (`status === 'open'`, Bio Ball only). Build flags: `weeklyContestsUiEnabled` **and** `leaderboardContestTabEnabled` (`LEADERBOARD_CONTEST_TAB_ENABLED` at bundle generation). **Live rows:** `GET /api/v1/contests/:contestId/leaderboard` (Phase 1) — wire in Angular per Phase 3.
- **Weekly contests** (`docs/weekly-contests/weekly-contests-phase4-adr.md`): mini-league score is derived from **`users/{uid}/gameplayEvents`**, not from `stats/summary`. Immutable **`contests/{contestId}/results/final`** is written only after the **E2** scoring job (`server/contests/contest-scoring-job.js`).
- **Active** contests (`status: open`) have **no** `results/final` yet. A “live contest leaderboard” must therefore **recompute** the same slate + ordering rules as scoring (or maintain a **materialized** cache — see Phase 4).

---

## Phase 0 — Product and UX lock-in

**Shipped (Angular):** `leaderboard-panel` exposes **All-time** vs **Weekly contest** (when `environment.weeklyContestsUiEnabled && environment.leaderboardContestTabEnabled`). Weekly tab lists **`open`** contests only (Firestore query + Bio Ball filter); **`scoring`** / **`paid`** / **`scheduled`** are not listed (no frozen “last computed” copy in this panel until product asks for it). Scope copy states **Bio Ball v1** only for the contest path; all-time scopes unchanged. **Contest picker:** title + window end. **ADR helper copy** for the selected contest: first **`leagueGamesN`** Bio Ball games after join, within **`[windowStart, windowEnd)`**; placeholder states live rows are **not** wired yet (Phase 1). **Listing policy:** same Story F2 verified-email hint as all-time when the all-time source has set it. **Rollout:** `LEADERBOARD_CONTEST_TAB_ENABLED=false` at build hides only this tab (contests drawer still follows `WEEKLY_CONTESTS_UI_ENABLED`). See `scripts/generate-env-prod.mjs`.

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

- **Contest list:** Phase 0 uses **Firestore** for open contests (works signed-out for `open` docs per rules). Revisit **authenticated** `GET /api/v1/contests` (or a narrowed query param) if the product wants one source of truth with server rate limits.
- **State:** Toggle, picker, loading / error / empty are in place; add optional **poll** (e.g. 30s) when the contest tab is active once live data exists (WebSockets optional later).
- **Table:** Contest-specific columns (wins, games played, losses, abandoned, tier); keep the current table for all-time scopes.
- **Feature flag:** `leaderboardContestTabEnabled` / **`LEADERBOARD_CONTEST_TAB_ENABLED`** (build-time) augments **`WEEKLY_CONTESTS_UI_ENABLED`** for this tab only.

**References:** `src/app/nav/leaderboard-panel/leaderboard-panel.component.ts`, `src/app/shared/services/weekly-contest-slate.service.ts` (and contests panel as applicable).

---

## Phase 4 — (Optional) Materialized “live” document

If API cost or latency is too high at scale:

- On qualifying **`gameplayEvents`** writes for users entered in **`open`** contests, a **Cloud Function** (or trusted worker) updates **`contests/{contestId}/liveStandings`** (or a paginated subcollection) with a **read-only public projection**.
- **Tighten `firestore.rules`** if clients read this path directly; prefer keeping **HTTP** as the only client surface if rules would otherwise widen too much.
- **Lifecycle:** Stop updating (or delete) live artifacts when the contest leaves **`open`**, to avoid conflicting with **`results/final`**.

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

1. Extract / share **live standings computation** with the scoring job.  
2. Implement **`GET /api/v1/contests/:contestId/leaderboard`** + server tests.  
3. Wire **leaderboard panel** (mode switch, contest picker, polling).  
4. Add **cache + rate limits** + runbook + feature flag rollout.  
5. (Later) **Materialized live doc** if metrics require it.

---

## Related docs

- `docs/weekly-contests/weekly-contests-phase4-adr.md` — mini-league rules  
- `docs/weekly-contests/weekly-contests-schema-results.md` — `results/final` shape  
- `docs/leaderboards/leaderboards-phase3-adr.md` — global leaderboard vs stats  
- `docs/leaderboards/leaderboards-api-d1.md` — existing leaderboard HTTP (if present)
