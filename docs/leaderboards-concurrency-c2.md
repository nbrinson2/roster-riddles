# Leaderboards — concurrency & load (Story C2)

**Status:** Implemented (emulator load script + documented limits)  
**Depends on:** [leaderboards-trusted-writer-c1.md](leaderboards-trusted-writer-c1.md) (Story C1)

## What we verify

The authoritative leaderboard inputs live in **`users/{uid}/stats/summary`**, updated inside **`transactionalAppendEventAndUpdateStats`** (one gameplay event → one transaction that appends the event and merges stats). Story C2 checks behavior under **concurrent** writes:

| Check | How |
|--------|-----|
| **No negative totals** | After load, assert `gamesPlayed`, `wins`, `losses`, `abandoned` are finite and **≥ 0**, and `gamesPlayed === wins + losses + abandoned`. |
| **No lost updates** | For **N** successful distinct-event writes (each unique `clientSessionId`), final **`totals.wins`** and **`totals.gamesPlayed`** equal the count of successful applies (all **`won`** in the script). |
| **Error budget** | Optional env **`LOAD_MAX_FAILURE_RATE`** (default **0**): share of transaction attempts that may fail; useful only if you intentionally stress beyond emulator limits. |

The script prints a **JSON artifact** to stdout (suitable for CI logs or attaching to a ticket).

## How to run

From the repo root (uses the **Firestore emulator**, same pattern as `npm run test:stats-emulator`):

```bash
npm run test:stats-concurrency
```

Optional environment variables:

| Variable | Default | Meaning |
|----------|---------|---------|
| `LOAD_PARALLEL` | `32` | Target concurrent **new** events **per phase** (capped at 500 in script). |
| `LOAD_USERS` | `2` | Users used in phase 2 (each gets `ceil(LOAD_PARALLEL / LOAD_USERS)` parallel wins). |
| `LOAD_MAX_FAILURE_RATE` | `0` | Max allowed fraction of failed transaction attempts across both phases. |

Example with a higher fan-out:

```bash
LOAD_PARALLEL=64 LOAD_USERS=4 npm run test:stats-concurrency
```

## Phases (script behavior)

1. **Single user, high contention:** One `uid` receives **`LOAD_PARALLEL`** concurrent **`won`** events with distinct session ids. Exercises **retries** on the **same** `stats/summary` document.
2. **Multi-user:** Several users each receive parallel wins on **their own** stats docs (fewer cross-conflicts on a single shard).

## “Hot shard” and scaling notes

| Topic | Note |
|--------|------|
| **Writes** | Hot spot is **per user** — `stats/summary` for a single `uid` under bursty concurrent sessions. There is **no** single global Firestore document for **writes** in the event pipeline. |
| **Reads (B2)** | A **precomputed global** leaderboard is **one document per board** for **reads** only (`leaderboards/snapshots/boards/global`). That path is **not** exercised by this write-load script; contention there is **read** traffic + **batch** writes from a job, not per-gameplay. |
| **Sharding** | If one user could generate **very high** concurrent session completions, Firestore transaction **latency and retries** can grow. Mitigations: rate-limit per user at API, queue events, or accept higher tail latency — **not** required for typical mobile/web usage. |

## Known limits / follow-ups

- **Emulator ≠ production:** The Firestore **emulator** validates **correctness** of the merge and transaction pattern; it does **not** prove production RPS. For production SLOs, run a similar pattern against **staging** with realistic auth and **lower** concurrency, or use **k6**/Locust against the HTTP API with real ID tokens.
- **k6 not bundled:** This repo uses a **Node** parallel script to avoid new dependencies; teams can mirror the same event shape in k6 if they need HTTP-level load tests.

## Test run artifact (example)

Successful run output is one JSON object. Shape (values vary by machine):

```json
{
  "story": "C2",
  "schema": "stats-concurrency-load-test/1",
  "firestoreEmulatorHost": "127.0.0.1:9450",
  "durationMsTotal": 850,
  "loadParallel": 32,
  "loadUsers": 2,
  "maxFailureRate": 0,
  "failureRate": 0,
  "totalAttempts": 64,
  "totalFailures": 0,
  "phases": [
    {
      "phase": "single_user_parallel_wins",
      "users": 1,
      "parallel": 32,
      "failures": 0,
      "attempts": 32,
      "durationMs": 420,
      "errorSamples": []
    },
    {
      "phase": "multi_user_parallel_wins",
      "users": 2,
      "parallel": 32,
      "failures": 0,
      "attempts": 32,
      "durationMs": 380,
      "errorSamples": []
    }
  ],
  "notes": [
    "Contention is per uid on users/{uid}/stats/summary (not a single global write shard).",
    "Precomputed global leaderboard reads (B2) are separate; write path stays per-user."
  ]
}
```

Redirect to a log file if needed: `npm run test:stats-concurrency 2>&1 | tee /tmp/c2-stats.log` (local `*.log` files are gitignored).

## References

- `scripts/stats-concurrency-load-test.mjs`
- `server/stats-aggregate.js` — `transactionalAppendEventAndUpdateStats`
- [leaderboards-phase3-jira.md](leaderboards-phase3-jira.md) — Story C2
