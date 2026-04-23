# Roadmap: active contest leaderboards in the leaderboard panel

**Status:** Planning (not implemented)  
**Goal:** Surface **live** weekly-contest standings (while a contest is **`open`**) inside the nav **leaderboard panel**, alongside today’s **all-time** boards.

**Context today**

- **Leaderboard panel** (`src/app/nav/leaderboard-panel/`): all-time wins only — scopes `global`, `bio-ball`, `career-path`, `nickname-streak`; data from Firestore snapshots `leaderboards/snapshots/boards/{scope}` or HTTP `/api/v1/leaderboards` (see `docs/leaderboards/`).
- **Weekly contests** (`docs/weekly-contests/weekly-contests-phase4-adr.md`): mini-league score is derived from **`users/{uid}/gameplayEvents`**, not from `stats/summary`. Immutable **`contests/{contestId}/results/final`** is written only after the **E2** scoring job (`server/contests/contest-scoring-job.js`).
- **Active** contests (`status: open`) have **no** `results/final` yet. A “live contest leaderboard” must therefore **recompute** the same slate + ordering rules as scoring (or maintain a **materialized** cache — see Phase 4).

---

## Phase 0 — Product and UX lock-in

- **Define “active”:** e.g. `status === 'open'` only. Decide whether **`scoring`** shows anything (e.g. frozen “last computed” copy) or nothing until **`paid`**.
- **Scope v1:** Phase 4 v1 contests are **Bio Ball** slate only; align the UI so you do not imply career-path / nickname contest boards until those product rules exist.
- **UX in `leaderboard-panel`:** e.g. a top-level segment **“All-time”** vs **“Weekly contest”**, plus a **contest picker** (title + window end). Reuse ADR copy: first **`leagueGamesN`** Bio Ball games **after join**, within **`[windowStart, windowEnd)`**.
- **Listing policy:** Match global leaderboard behavior (e.g. verified-email requirement, display names) so policy hints stay consistent with `docs/leaderboards/` and Story F2 patterns.

---

## Phase 1 — Authoritative server API (live standings)

- **New route (example):** `GET /api/v1/contests/:contestId/leaderboard` (or `…/live-standings`), read-only.
- **Preconditions:** Contest exists and is **`open`** (and optionally `now < windowEnd` if product wants “only while window open”).
- **Response:** Rows aligned with `results/final` standing shape where possible: `rank`, `uid`, `wins`, `gamesPlayed`, `losses`, `abandoned`, `tier`, `displayName` (from entry snapshot), plus **meta**: `leagueGamesN`, `windowStart` / `windowEnd`, server **`computedAt`**, `tieBreakPolicy` for transparency.
- **Implementation:** Reuse the same pipeline as scoring: **`loadQualifyingSlate`**, **`tallySlate`**, tier + **`compareStandingRows`** / **`assignDenseRanks`** from `server/contests/` (see `contest-scoring-job.js`, `contest-scoring-core.js`). **Refactor** into a shared module so **live** and **E2 final** cannot drift.
- **Auth:** Prefer Firebase Auth on the route; decide if unauthenticated clients may read standings (likely yes for engagement, with rate limits).
- **Limits:** Cap work per request (entrant count, timeouts); add **rate limiting** analogous to `server/leaderboards/leaderboards.http.js`.

**References:** `docs/weekly-contests/weekly-contests-phase4-adr.md`, `docs/weekly-contests/weekly-contests-schema-results.md`, `server/contests/contest-scoring-job.js`.

---

## Phase 2 — Performance, caching, and correctness

- **Cost:** Per-request, per-entrant reads of `gameplayEvents` can be expensive. Add a **short TTL server cache** (in-memory or Redis) keyed by `(contestId, entriesFingerprint)` or time-bucketed invalidation.
- **Tests:** Golden fixtures (small event + entry sets) asserting **live API ordering** matches **post-scoring** ordering for the same frozen inputs. Add to `npm run test:server`.
- **Edge cases:** No entries; one entrant; partial slates; ties; boundary `createdAt` vs `windowEnd` (half-open interval per ADR).

---

## Phase 3 — Angular: leaderboard panel integration

- **Contest list:** Source `contestId` from existing weekly-contest UI/services where possible; if needed, add a minimal **`GET /api/v1/contests?status=open&gameMode=bio-ball`** (or reuse an existing list endpoint) with safe public fields only.
- **State:** Toggle all-time vs contest; loading / error / empty; optional **poll** (e.g. 30s) when the contest tab is active (WebSockets optional later).
- **Table:** Contest-specific columns (wins, games played, losses, abandoned, tier); keep the current table for all-time scopes.
- **Feature flag:** e.g. env-driven flag so backend can ship before UI, or UI before full cache tuning.

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
