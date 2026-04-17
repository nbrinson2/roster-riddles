# ADR: Phase 4 — Weekly contests (Story A0)

| Field | Value |
|-------|--------|
| **Status** | Accepted (engineering; PM may adjust copy, prize copy, and window labels) |
| **Date** | 2026-04-17 |
| **Scope lock (v1)** | **Bio Ball only** — contest scoring uses **`gameMode === "bio-ball"`** gameplay events in the contest window. Career Path and Nickname Streak contests are **out of scope** until a later ADR amendment. |
| **Depends on** | [gameplay-stats-phase2.md](gameplay-stats-phase2.md), [leaderboards-phase3-adr.md](leaderboards-phase3-adr.md) (tie-break precedent), [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) |

## Context

Phase 2 stores **append-only** `users/{uid}/gameplayEvents/{eventId}` and maintains **`users/{uid}/stats/summary`** with per-mode totals including **`totalsByMode["bio-ball"].wins`**. Phase 3 leaderboards use **all-time** wins; they do **not** implement weekly windows.

Weekly contests need:

- A **bounded time window** with clear boundaries.
- **Fair comparison** — a **mini-league** feel: similar **workload**, not “who grinds the most games in seven days.”
- **Join** semantics with a **rules snapshot** so disputes reference a versioned policy.
- **Post-close scoring** that ranks **entrants** only, using **authoritative** data (not client-supplied scores).
- **Immutable** published results after scoring completes.
- **Dry-run payouts** — numeric amounts only, **no Stripe**, no real-money movement.

This ADR narrows **product and technical** choices for the **first** weekly-contest slice: **Bio Ball** only.

## Decision summary

| Topic | Decision |
|--------|-----------|
| **Game mode in scope** | **`bio-ball` only** for Phase 4 v1. Events with any other `gameMode` are **ignored** for contest score and eligibility. |
| **Product shape** | **Fair mini-league:** each entrant is scored on at most **`leagueGamesN`** completed Bio Ball games (see [Mini-league scoring](#mini-league-scoring)), not raw “all wins in the window.” |
| **Default `leagueGamesN`** | **`10`** — product default on new contests; operators may set a different value per contest (e.g. smaller **N** in QA). |
| **Primary score (contest)** | **`wins`** among that entrant’s **league slate** — the first **`leagueGamesN`** qualifying events (see below), ordered by server **`createdAt`** ascending. Only **`result === "won"`** events increment wins. |
| **Authoritative scoring input** | **Replay / query** of **`users/{uid}/gameplayEvents/*`**: filter **`gameMode === "bio-ball"`**, **`createdAt`** ∈ **[windowStart, windowEnd)**, and **`createdAt >= entry.joinedAt`** (only games **after join** count — no retroactive credit). Sort by **`createdAt` asc**, take the **first `leagueGamesN`** events as the **slate**; **score** = count of slate events with **`result === "won"`**. **Do not** trust client-reported scores; **do not** use **`stats/summary`** alone for contest rank. |
| **Contest identity** | Firestore **`contests/{contestId}`** — `contestId` is opaque (e.g. generated id), not derived from week label alone (allows multiple contests per week in staging). |
| **Entries** | **One document per `(contestId, uid)`** — physical path **`contests/{contestId}/entries/{uid}`** (deterministic id). |
| **Status machine** | **`scheduled` → `open` → `scoring` → `paid` \| `cancelled`**. Optional failure path **`scoring` → `cancelled`** if scoring aborts after bounded retries (no partial winner publish). |
| **“Week” / window** | Instants **`windowStart`**, **`windowEnd`** (Firestore **`Timestamp`** or ISO in API, stored as Timestamp). Boundaries interpreted in **`America/New_York`** for **product copy** and **operator scheduling**; stored values are **absolute instants** (UTC-safe). Half-open interval **[windowStart, windowEnd)**. |
| **Tie-break** | Among entrants with a **full slate** (`N` qualifying games): **wins** descending, then **losses** in slate ascending (fewer losses is better), then **abandoned** in slate ascending, then **`uid` ascending**. **Partial slates** (`k < N` games): ranked **below** every full slate; sorted by **wins** desc, then **`gamesPlayed`** (`k`) desc, then **`uid` asc** (see [Mini-league scoring](#mini-league-scoring)). |
| **Dry-run payouts** | **`amountCents`** (integer), **`currency`** (e.g. **`FAKE_USD`** for staging), **`notRealMoney: true`**. No Stripe objects or payment intents. |
| **Money movement** | **None** in v1. **`paid`** means **dry-run payout lines finalized**, not funds transferred. |
| **Security** | Clients **cannot** write contest outcome, standings, or payouts. **Trusted server / batch job** only for mutations after creation. |

## Non-goals (v1)

| Topic | Stance |
|--------|--------|
| Stripe, payouts, KYC, tax | **Out of scope** — see [leaderboards-prize-verification-f3.md](leaderboards-prize-verification-f3.md) posture; contests add **numeric dry-run only**. |
| Career Path / Nickname Streak contests | **Deferred** — separate ADR when multi-mode contests ship. |
| Per-`league` (e.g. MLB) contest axis | **Deferred** — Bio Ball events may carry `league`; v1 scoring **does not** filter by league unless product amends this ADR. |
| Client-writable scores or leaderboards | **Forbidden** — same as Phase 2/3 trusted-writer model. |

---

## Status machine

```
                    ┌─────────────┐
                    │  scheduled  │
                    └──────┬──────┘
                           │ open for entries (automated or admin)
                           ▼
                    ┌─────────────┐
         ┌─────────│    open     │─────────┐
         │         └──────┬──────┘         │
         │ (cancel        │ window ends     │ (cancel before scoring completes)
         │  before        ▼                │
         │  scoring)  ┌─────────────┐     │
         │            │   scoring   │     │
         │            └──────┬──────┘     │
         │                   │ success   │
         │                   ▼           │
         │            ┌─────────────┐    │
         │            │    paid     │    │
         │            └─────────────┘    │
         │                   │           │
         └───────────────────┴───────────┴──► ┌─────────────┐
                                               │ cancelled │
                                               └─────────────┘
```

| Transition | When | Who / how |
|------------|------|-----------|
| `scheduled` → `open` | Contest accepts joins (on or after publish time if product adds one) | Trusted automation or admin-only path (implementation story). |
| `open` → `scoring` | **`now >= windowEnd`** and join closed; scoring job started | System (scheduler / trigger). May also allow **manual** close in staging. |
| `scoring` → `paid` | Standings + dry-run payout artifacts written successfully | Scoring job (idempotent commit). |
| `scoring` → `cancelled` | Irrecoverable scoring failure after retries, or **admin cancel** policy | System / admin; **no** winner publication. |
| `open` → `cancelled` | Product/admin cancels before results | Admin path; entries may remain for audit or be marked void per implementation. |
| `scheduled` → `cancelled` | Contest never opened | Admin or system. |

**`paid` semantics in v1:** “Dry-run payout rows are **final** and **not real money**.”

---

## Entities and Firestore layout

### `contests/{contestId}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | Yes | Document schema version (start at `1`). |
| `status` | `string` | Yes | `scheduled` \| `open` \| `scoring` \| `paid` \| `cancelled`. |
| `gameMode` | `string` | Yes | **Fixed `bio-ball`** for Phase 4 v1 (allows future contests collection to reuse shape). |
| `rulesVersion` | `number` or `string` | Yes | Monotonic or semver-like; copied to entries at join. |
| `windowStart` | `Timestamp` | Yes | Inclusive start of scoring window. |
| `windowEnd` | `Timestamp` | Yes | Exclusive end; scoring uses **[windowStart, windowEnd)**. |
| `leagueGamesN` | `number` (int) | Yes | **Mini-league length:** each entrant’s score is derived from at most this many **completed** Bio Ball games after join (see [Mini-league scoring](#mini-league-scoring)). **Product default: `10`** (set explicitly on each contest document; may differ for tests). |
| `title` | `string` | No | Display title (e.g. “Bio Ball mini-league — Week of Apr 14”). |
| `createdAt` | `Timestamp` | Yes | Server time at create. |
| `updatedAt` | `Timestamp` | Yes | Server time at last contest update. |
| `metadata` | `map` | No | Admin notes, feature flags, **no PII**. |

**Indexes (implementation story):** query by `status`, `windowStart`/`windowEnd`, `gameMode` as needed for list UIs.

### `contests/{contestId}/entries/{uid}`

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | Yes | Entry document schema (start at `1`). |
| `contestId` | `string` | Yes | Denormalized for queries (`contestId` == parent path). |
| `uid` | `string` | Yes | Firebase Auth uid (document id). |
| `rulesAcceptedVersion` | same as contest | Yes | **Snapshot** of `contests/{id}.rulesVersion` at join. |
| `joinedAt` | `Timestamp` | Yes | Server time when join committed. |
| `displayNameSnapshot` | `string` \| `null` | No | Optional display name from Auth at join for public standings (product policy). |
| `clientRequestId` | `string` | No | Idempotency key for join retries (optional). |

**Idempotency:** Join uses **deterministic doc id `uid`**. Retries **`set`** with merge or idempotent handler so **one** entry per user per contest.

**Eligibility:** Only while **`status === "open"`** and **`now < windowEnd`** (or stricter policy if product closes early). **Late join** after `windowEnd` is **rejected**.

### Immutable results (post-`scoring`)

Written only by **trusted** code after validation:

**Path (v1 recommendation):** `contests/{contestId}/results/final` — **single document** replacing on idempotent retry with same logical outcome, **or** versioned `results/{artifactId}` if audit needs multiple attempts (implementation choice; prefer **one** `final` doc for simplicity).

**`final` document (minimum):**

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `number` | e.g. `1`. |
| `computedAt` | `Timestamp` | When scoring finished. |
| `windowStart` / `windowEnd` | `Timestamp` | Copy from contest for audit. |
| `gameMode` | `string` | `bio-ball`. |
| `standings` | `array` | Ordered rows: `rank`, `uid`, `wins` (in league slate), `gamesPlayed` (≤ `leagueGamesN`), `losses`, `abandoned` (in slate), optional `displayName`, `tieBreakKey` (e.g. uid). |
| `tieBreakPolicy` | `string` | e.g. `mini_league_wins_desc_losses_asc_uid_asc`. |
| `leagueGamesN` | `number` | Copy from contest for audit. |
| `scoringJobId` | `string` | Idempotency / trace id. |
| `eventSource` | `string` | e.g. `gameplayEvents_first_n_bio_ball_after_join`. |

**Tie resolution audit:** Deterministic ordering per [Mini-league scoring](#mini-league-scoring); **`rank`** may be dense or competition-style per product as long as **`standings[]` order** is stable.

**Rules:** **No client write** to `results/*`.

### Dry-run payouts

**Path (v1):** `contests/{contestId}/payouts/dryRun` **or** embedded under `results/final` as `dryRunPayouts` (implementation story picks one; **single** artifact for “what would be paid” is enough).

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `number` | e.g. `1`. |
| `notRealMoney` | `boolean` | **Must be `true`** in v1. |
| `currency` | `string` | e.g. **`FAKE_USD`** (staging) or **`USD`** with `notRealMoney: true` — product chooses one convention and sticks to it. |
| `lines` | `array` | `{ place` or `rank`, `uid`, `amountCents`, optional `label` } e.g. “Winner gets **10000** cents” as **numbers only**. |
| `finalizedAt` | `Timestamp` | When dry-run was committed. |

**Zero-dollar / fake currency:** Staging may use **`amountCents: 0`** for all lines to emphasize test-only.

---

## Mini-league scoring

**Goal:** Rank entrants like a **short season with a fixed schedule length** — everyone is compared on **at most `leagueGamesN` games**, not unlimited volume in the window.

### Qualifying event

A gameplay event **`e`** counts toward the **slate** iff:

- **`e.gameMode === "bio-ball"`**
- **`windowStart <= e.createdAt < windowEnd`** (server **`createdAt`** on the event doc, Phase 2)
- **`e.createdAt >= entry.joinedAt`** for that user’s entry (games **before join** do not count)

Every event is one **completed** session: **`result`** ∈ `won` \| `lost` \| `abandoned` (Phase 2).

### League slate (per entrant)

1. Collect all qualifying events for **`uid`**, sorted by **`createdAt` ascending**.
2. Take the **first `leagueGamesN`** events — the **league slate** (may be **fewer than `N`** if not enough games occurred before `windowEnd`).
3. **Wins** = count of slate events with **`result === "won"`**; **losses** and **abandoned** are counts in the same slate for tie-breaks and transparency.

### Ranking order

1. **Tier A — Full slate:** `gamesPlayed === leagueGamesN`. Sort by **wins** descending, then **losses** ascending, then **abandoned** ascending, then **`uid` ascending**.
2. **Tier B — Partial slate:** `gamesPlayed < leagueGamesN`. All Tier B rows sort **after** Tier A. Sort by **wins** descending, then **`gamesPlayed`** descending (more games finished is a better tie-break among partials), then **`uid` ascending**.

**Rationale:** Same wins in a full **N**-game slate → better record (fewer losses) ranks higher. Partial players are not mixed above someone who completed the full **N** games.

### Copy for players (product)

Example: “Your contest rank uses your **first 10 Bio Ball games** (unless the contest says otherwise) played **after you join**, while the contest is open, up to the contest end time. Ties go to the better **win–loss** record in those games.” UI should show the contest’s actual **`leagueGamesN`** value.

---

## Window boundaries

- **Storage:** `windowStart` and `windowEnd` as absolute **Firestore `Timestamp`** values.
- **Operator UX:** Schedule contests using **`America/New_York`** for “week of …” copy; convert to UTC instants when writing documents.
- The window defines **when** games can count toward the slate; **`leagueGamesN`** defines **how many** games count per entrant.

---

## Scoring job (authoritative behavior)

1. **Precondition:** Contest `status === "scoring"` (set atomically when closing `open`).
2. **Input set:** Entries from **`contests/{contestId}/entries/*`** (each with **`joinedAt`**).
3. For each entry, **load** qualifying Bio Ball events for **`uid`** in **[windowStart, windowEnd)** with **`createdAt >= joinedAt`**, ordered by **`createdAt` asc**.
4. **Truncate** to the first **`leagueGamesN`** events; compute **wins**, **losses**, **abandoned** on that slate.
5. **Sort** all entrants per [Mini-league scoring](#mini-league-scoring) (Tier A then Tier B).
6. **Write** `results/final` (including **`leagueGamesN`**, per-row **wins** / **gamesPlayed** / **losses** / **abandoned**) and **`paid`-level dry-run** artifact; transition **`scoring` → `paid`**.
7. **Idempotency:** Same inputs → same standings; **`scoringJobId`** or transaction prevents double publish of conflicting winners.

**Indexing note:** Implementation may need **`gameMode` + `createdAt`** range queries per user (and join filter), or bounded reads — document query plan in the implementation story.

**Failure:** On repeated failure, transition to **`cancelled`** (or leave **`scoring`** with alert — product preference; default **`cancelled`** after max retries so users see a terminal state).

---

## Security posture

| Path | Client read | Client write |
|------|-------------|--------------|
| `contests/{id}` | Authenticated read of **non-sensitive** fields per product (may hide internal `metadata`). | **Denied** for `status`, `window*`, authoritative fields — **server/admin only**. |
| `contests/{id}/entries/{uid}` | User may read **own** entry; public read of others **optional** per product (leaderboard-style). | **Join** only via **trusted API** (`POST` Express or CF), not direct Firestore create. |
| `contests/{id}/results/*`, `payouts/*` | Read-only for clients if product wants transparency. | **Denied** for all clients. |

Align with [firestore.rules](../firestore.rules) updates in implementation stories.

---

## Relationship to Phase 3 leaderboards

- **All-time** Bio Ball boards remain **`GET /api/v1/leaderboards?scope=bio-ball`** (lifetime wins).
- **Weekly contests** are a **separate** product surface: **first-`N` games after join** within the window, not unlimited weekly volume and not the same ranking as all-time leaderboards.

---

## Sign-off

| Role | Name | Date | Notes |
|------|------|------|--------|
| Product | | | Bio-ball mini-league (`leagueGamesN`); dry-run money copy |
| Engineering | | | First-`N` events after join; immutable `results/final` |

---

## References

- [gameplay-stats-phase2.md](gameplay-stats-phase2.md) — event + aggregate schemas  
- [leaderboards-phase3-adr.md](leaderboards-phase3-adr.md) — tie-break; weekly deferred in Phase 3  
- [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — backlog and Story A0  
