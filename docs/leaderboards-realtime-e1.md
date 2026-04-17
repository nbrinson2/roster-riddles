# Leaderboards — real-time refresh (Story E1, optional v1)

**Status:** Implemented (docs + optional client behavior)  
**Depends on:** [leaderboards-phase3-adr.md](leaderboards-phase3-adr.md) (Story A0), [leaderboards-schema-precomputed.md](leaderboards-schema-precomputed.md) (B2), [leaderboards-api-d1.md](leaderboards-api-d1.md) (D1), [leaderboards-indexes-pagination.md](leaderboards-indexes-pagination.md) (B3)

## Goal

Give product a **documented choice** between:

1. **Push-style freshness** — Firestore `onSnapshot` on a **single small document** per board (B2 path).
2. **Pull-style freshness** — **Short polling** the trusted HTTP API (D1 path).

Clients **do not** run collection-group leaderboard queries directly: rules deny untrusted reads on `users/*/stats/summary`, and a broad query would be expensive and index-heavy (B1/B3). Real-time behavior therefore targets either **one doc** (B2) or **the API** (D1).

## Option A — Firestore snapshot listener (B2)

### Query / path

- **Document reference:** `leaderboards/snapshots/boards/{boardId}` where `boardId ∈ { global, bio-ball, career-path, nickname-streak }`.
- **Listener:** `onSnapshot` on that **one** document (modular API: `doc(db, 'leaderboards', 'snapshots', 'boards', boardId)` — **not** a slash string; odd segment counts are invalid for `doc()`).
- **Composite indexes:** **None** for this pattern — it is a **direct document get/listen**, not a compound query.

### Rules

Public read is allowlisted for those four `boardId` values; client writes are denied. See [`firestore.rules`](../firestore.rules).

### UI behavior

- **Throttle:** Firestore delivers updates when the document changes; avoid extra work in the listener (no per-field micro-animations). Debounce only if you add heavy derived UI later.
- **Pagination:** The B2 doc holds a **fixed top-K** array. The UI treats the board as **one page** (no “load more” for B2-only mode).
- **Index / deploy lag:** First deploy of rules or a new path does not require a **composite** index for this listener; if reads fail with `permission-denied`, fix rules. If a **named database** is used, ensure the client’s `firestoreDatabaseId` matches (see `src/environment.ts`).

### Cost (reads)

Rough model (Firestore billing: document reads; listener receives a read on attach and one read per committed change):

| Symbol | Meaning |
|--------|---------|
| \(U\) | Monthly active users (open app at least once). |
| \(V\) | Fraction of MAU who **open** the leaderboard panel in a month (0–1). |
| \(B\) | Average **boards** viewed per panel open (1–4). |
| \(R\) | Listener **reconnects** per panel session (cold start, tab background, network) — use **1–3** if unknown. |

**Initial attach reads (per month, order of magnitude):**

\[
\text{attach reads} \approx U \times V \times B \times R
\]

Each **snapshot job** that updates a doc causes **one read per active listener** on that doc. If the job refreshes **four** boards every **15 minutes**:

\[
\text{update reads/month} \approx (\text{listeners on that doc}) \times (\text{writes to doc per month})
\]

Listeners scale with **concurrent** opens, not MAU — cap concurrent sessions in stress tests. For **small MAU** (e.g. &lt; 5k) and **few** concurrent listeners, B2 + listener is usually **cents/month** on reads; validate against current [Firestore pricing](https://firebase.google.com/pricing) for your project.

## Option B — Short poll on HTTP API (D1)

### Request

- `GET /api/v1/leaderboards?scope=…&pageSize=…` — see [leaderboards-api-d1.md](leaderboards-api-d1.md).

### Indexes

The **server** uses Admin SDK + collection-group queries; composite indexes are listed in `firestore.indexes.json` (B3). The **browser** does not run those queries.

### UI behavior

- **Throttle:** Use an interval **≥ 30–60 s** for polling in production unless product explicitly wants faster refresh (cost + server load). Implemented via `leaderboardPollIntervalMs` in `src/environment.ts` (`0` = off).
- **Pagination:** If the user has loaded **additional pages** (`nextPageToken` set), the optional poller **does not** overwrite merged pages — polling is skipped until the user is back on the **first page only** (avoids clobbering “load more” state).

### Cost

- **Firestore:** Charged to the **backend** project on each API request (query reads + minimal overhead). Scales with **poll frequency × concurrent users** calling the API.
- **Hosting / API:** Extra HTTP requests; keep intervals conservative.

Rough **HTTP GETs per month** if every leaderboard viewer polls every \(T\) seconds while the panel is open:

\[
\text{GETs} \approx U \times V \times (\text{average open duration in s}) / T
\]

Compare to B2 listener: polling shifts cost toward **HTTP + server Firestore reads**; B2 listener shifts toward **client Firestore reads** on **small documents**.

## Configuration (Angular)

| `environment` field | Purpose |
|---------------------|--------|
| `leaderboardUseFirestoreSnapshot` | `true` → B2 `onSnapshot` on `leaderboards/snapshots/boards/{scope}`; `false` → D1 HTTP (default). |
| `leaderboardPollIntervalMs` | D1 only; `> 0` enables periodic refresh (ms); `0` = off (default). |

## Troubleshooting: “No data” but Firestore has stats

- **Symptom:** Empty leaderboard while **`users/{uid}/stats/summary`** has wins.
- **Cause:** **`leaderboardUseFirestoreSnapshot: true`** reads only **`leaderboards/snapshots/boards/{boardId}`**. Those precomputed docs are filled by a **batch job**, not by gameplay. If the job has not written a doc (or the path is wrong), the UI is empty.
- **Fix for dev:** Set **`leaderboardUseFirestoreSnapshot: false`** so the panel uses **`GET /api/v1/leaderboards`**, which queries **`stats/summary`** via the trusted API (see [leaderboards-api-d1.md](leaderboards-api-d1.md)). Ensure Express is running (`proxy.conf.json` → API).

## References

- [leaderboards-schema-precomputed.md](leaderboards-schema-precomputed.md) — B2 document shape.
- [leaderboards-api-d1.md](leaderboards-api-d1.md) — D1 contract.
- [leaderboards-phase3-jira.md](leaderboards-phase3-jira.md) — Story E1 acceptance.
