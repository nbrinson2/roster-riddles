# ADR: Phase 3 — Leaderboards v1 (Story A0)

| Field | Value |
|-------|--------|
| **Status** | Accepted (engineering defaults; PM may adjust “weekly” timing and copy) |
| **Date** | 2026-04-15 |
| **Depends on** | [gameplay-stats-phase2.md](gameplay-stats-phase2.md) — events + `users/{uid}/stats/summary` |

## Context

Phase 2 records **gameplay events** and maintains a **per-user aggregate** (`stats/summary`) with global and per-`gameMode` totals, streaks, and bests. Phase 3 needs **leader-visible rankings** without contradicting that source of truth.

Constraints:

- Firestore does not support efficient “top users by field” across **all** users without **collection-group indexes**, **pagination**, or **precomputed** leaderboard documents.
- **Weekly** rankings require **time-bounded** win counts; lifetime aggregates alone are insufficient without extra fields or jobs that scan events.
- **Anti-abuse** must be proportionate for v1 (no prize logic is assumed unless product adds it later).

## Decision summary

| Topic | Decision |
|--------|-----------|
| **Primary score (v1)** | **`wins`** (integer) — same meaning as Phase 2 aggregate **`totals.wins`** (global) and **`totalsByMode[gameMode].wins`** (per mode). |
| **Data source** | **Authoritative:** `users/{uid}/stats/summary` (and the same transactional pipeline that updates it from `gameplayEvents`). **Do not** invent a parallel client-written score. |
| **Dimensions in v1** | **All-time global** (one ranking) + **all-time per game mode** (three rankings: `bio-ball`, `career-path`, `nickname-streak`). **League (e.g. MLB)** is **not** a separate leaderboard axis in v1; optional filter in a later iteration using `league` on events if needed. |
| **Weekly boards** | **Out of scope for Leaderboards v1.** Implement in a follow-up (see [Weekly rankings (future)](#weekly-rankings-future)). |
| **“Week” definition (reserved)** | When weekly ships, use **week boundaries in `America/New_York`**, week labels as ISO week or `YYYY-Www` in product copy (TBD with PM). |
| **Refresh / UX** | **Near–real-time user expectation** is met by **server-driven materialized leaderboards** or **short-interval batch refresh**, not by clients scanning all users. **v1 default:** **precomputed top-K** leaderboard snapshots (see [Cost posture](#cost-posture)), rebuilt on a **schedule**; UI shows **“Updated at …”** from snapshot metadata. **Optional (Story E1):** Firestore `onSnapshot` on one snapshot doc per board and/or HTTP short-poll — see [leaderboards-realtime-e1.md](leaderboards-realtime-e1.md). |
| **Cost posture** | **Preferred for production scale:** **precomputed** docs at **`leaderboards/snapshots/boards/{boardId}`** (see [leaderboards-schema-precomputed.md](leaderboards-schema-precomputed.md)) updated by **Cloud Scheduler + Cloud Function** (or equivalent job runner), **cap K** (e.g. top **100–500**). **Dev/staging alternative:** **collection-group query** on `stats` + `orderBy` + pagination for quick demos — must have composite indexes and explicit read budgets. |
| **Migration path** | Start with **precomputed top-K + 5–15 min cadence** (tunable). If MAU stays small, **collection-group** reads may suffice temporarily; ADR allows either path in implementation stories as long as indexes and costs are documented. |
| **Anti-abuse** | See [Anti-abuse](#anti-abuse). |

## Score definition

| Scope | Formula | Source field(s) |
|--------|---------|-------------------|
| **Global all-time** | `score = totals.wins` | `users/{uid}/stats/summary` |
| **Per-mode all-time** | `score = totalsByMode[gameMode].wins` (missing mode ⇒ `0`) | same document |

**Ties:** Sort descending by `score`, then stable secondary key (**`uid` ascending**) so ordering is deterministic without arbitrary “first wins.”

**Not used for v1 leaderboard sort:** `losses`, `abandoned`, `streaks`, `bests` — may inform badges or future seasons; out of scope for v1 ranking key.

**Per-mode note:** `nickname-streak` emits many **`won`** events per streak session (per-guess wins); **`wins`** in aggregate counts each such event — leaderboard “wins” matches that product behavior.

## Dimensions (v1)

| Board | Included in v1 |
|--------|----------------|
| All modes combined (global) | Yes |
| `bio-ball` | Yes |
| `career-path` | Yes |
| `nickname-streak` | Yes |
| Weekly / rolling window | **No** (see below) |
| Per-`league` (e.g. MLB vs NFL) | **No** (defer; data exists on events for later) |

## Weekly rankings (future)

Weekly boards require one of:

1. **Rolling counters** on the user aggregate (e.g. `winsWeekOf[weekId]`) updated in the same trusted write path as stats, or  
2. **Scheduled aggregation** over `gameplayEvents` with `createdAt` in `[weekStart, weekEnd)` (higher read cost; acceptable for batch jobs).

**Recommendation when picked up:** (1) for consistent O(1) reads at leaderboard time; document schema in a Phase 3.1 ADR amendment.

## Cost posture

### Option A — Precomputed top-K (preferred at scale)

- **Writes:** Job or trigger aggregates **top K** rows into a small set of documents (global + 3 modes).
- **Reads:** Clients fetch **O(1)** docs; pagination = “next page” only if product adds slice endpoints later.
- **Staleness:** Equal to job cadence (e.g. **5–15 minutes** initial default; **1 hour** acceptable for low-priority envs).

### Option B — Collection-group query on `stats`

- **Query:** `collectionGroup('stats')` + `orderBy` wins + `orderBy(documentId())` with composite index (no bare `documentId == 'summary'` filter on collection groups; v1 only has `summary` under each `stats`).
- **Reads:** Proportional to **limit**; still expensive if misused without caps.
- **Use when:** Staging smoke tests or very small user base; document **max `limit`** (e.g. 50) in API.

**v1 implementation story should pick A or B per environment**; production should default to **A** unless MAU is tiny.

## Refresh cadence (v1)

| Layer | Behavior |
|--------|-----------|
| **Underlying stats** | Updated on each accepted gameplay event (Phase 2) — already **near-real-time** per user. |
| **Leaderboard snapshot** | **Batch refresh** on a schedule for Option A; **on each API request** for Option B (with strict `limit`). |
| **UI** | Show **`updatedAt`** (or equivalent) from snapshot metadata so users understand staleness. |

**Real-time push** (Firestore listener on a leaderboard doc) is **optional** in v1 if the snapshot doc is small; not required for MVP.

## Anti-abuse

| Measure | Priority | v1 stance |
|---------|----------|-----------|
| **API rate limits** (GET leaderboard, POST events) | **P0** | Required on public/costly paths; align with Express middleware / gateway (see Phase 3 Epic F). |
| **Duplicate accounts** | **P1** | No fingerprinting in v1; document follow-up. Optional: **one account per email** is already enforced by normal Auth usage. |
| **Verified email to appear on board** | **P1** (product) | **Implemented (Story F2):** only users with **`emailVerified === true`** appear in **`GET /api/v1/leaderboards`** and snapshot rebuilds unless **`LEADERBOARD_REQUIRE_EMAIL_VERIFIED=false`** (QA). See [leaderboards-duplicate-accounts-f2.md](leaderboards-duplicate-accounts-f2.md). |
| **Prize / KYC verification** | **Deferred** | Out of scope until contests exist; track in backlog. |

## Consequences

- Implementation stories (B–G) can assume **wins-based** rankings and **global + three modes** for v1.
- **Weekly** work is explicitly **not** blocked on v1 shipping; it needs a **schema/job** follow-up.
- Reconciliation tests can compare leaderboard rows to **`stats/summary`** for the same `uid` (plus tie-break rules).

## Alternatives considered

1. **Score = Elo or composite (wins − losses)** — Rejected for v1 to avoid redefining fairness; can revisit with PM.
2. **Only global board** — Rejected; per-mode boards are low extra cost once pipeline exists.
3. **409 / real-time strict ordering** — Leaderboards are **eventually consistent** with snapshot lag; acceptable for v1.

## References

- Phase 2: [gameplay-stats-phase2.md](gameplay-stats-phase2.md)
- Query-path schema (Story B1): [leaderboards-schema-query-path.md](leaderboards-schema-query-path.md)
- Aggregate logic: `server/stats-aggregate.js`
- Jira-style backlog: [leaderboards-phase3-jira.md](leaderboards-phase3-jira.md)

## Sign-off

| Role | Name | Date | Approved |
|------|------|------|----------|
| Engineering | | | [ ] |
| Product / PM | | | [ ] |

*Check when reviewed; engineering defaults above unblock implementation if PM is unavailable.*
