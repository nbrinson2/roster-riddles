# Leaderboards — authoritative score updates (Story C1, trusted writer)

**Status:** Implemented (same pipeline as Phase 2 gameplay stats)  
**Depends on:** [leaderboards-phase3-adr.md](leaderboards-phase3-adr.md) (Story A0), [gameplay-stats-phase2.md](../platform/gameplay-stats-phase2.md), [leaderboards-schema-query-path.md](leaderboards-schema-query-path.md)

## Summary

Leaderboard **scores** in v1 are **`wins`** derived from the **same** authoritative aggregate as the profile: **`users/{uid}/stats/summary`**. There is **no separate client-writable leaderboard collection**. Updates run only in **trusted code** using the **Firebase Admin SDK**.

## Write path (single pipeline)

| Step | What happens |
|------|----------------|
| 1 | Authenticated client **`POST /api/v1/me/gameplay-events`** with a validated body (`server/gameplay/gameplay-events.js`). |
| 2 | Server computes **`eventId = SHA-256(uid ‖ clientSessionId)`** — deterministic per user + session. |
| 3 | **`transactionalAppendEventAndUpdateStats`** (`server/lib/stats-aggregate.js`) runs a **Firestore transaction**: |
|  | • If **`gameplayEvents/{eventId}`** already exists → **no stats change**; response **`idempotentReplay: true`**. |
|  | • Else → **`set`** the event with server **`createdAt`**, and **`set`** **`stats/summary`** from **`applyEventToStatsTree`**. |

Firestore **security rules** deny client **`create`/`update`/`delete`** on `gameplayEvents` and `stats` (see `firestore.rules`). Only the **Admin SDK** (Express, jobs, Cloud Functions) bypasses rules for these writes.

## What counts as “score” for leaderboards

| Board | Updated fields (on each **new** accepted `won` event) |
|-------|--------------------------------------------------------|
| Global | **`totals.wins`** += 1 |
| Per-mode | **`totalsByMode[gameMode].wins`** += 1 for the event’s **`gameMode`** |

**Loss** and **abandoned** increment **`gamesPlayed`** and the appropriate outcome bucket; they do **not** increment **`wins`**. See ADR for tie-break and query/snapshot semantics.

## Idempotency and retries

| Mechanism | Behavior |
|-----------|----------|
| **Same `clientSessionId`** | Same **`eventId`** → transaction sees existing event → **stats are not applied again**; HTTP **200** with stored event. |
| **Network retry** | Safe: duplicate POSTs collapse to a single append + single aggregate update. |
| **Different `clientSessionId`** | New event → new **`eventId`** → **another** stats update (intended for distinct sessions). |

This matches Phase 2 event semantics; reconciliation scripts replay events in order — see `docs/platform/stats-reconciliation.md` / `scripts/verify-stats-reconciliation.mjs`.

## Merge semantics (not “max score”)

Aggregate merge is **incremental**: each accepted event applies **once** via **`applyEventToStatsTree`**. Leaderboard **`wins`** are a **running count** of **`result === 'won'`** events, not a “max” of a client-supplied score.

Other fields use **min/max** where appropriate (e.g. **`bests.fastestWinMs`** uses **minimum** duration among wins — “best” = fastest). That does **not** affect **`wins`** used for rankings.

## Code map

| Artifact | Role |
|----------|------|
| `server/gameplay/gameplay-events.js` | HTTP validation, **`computeGameplayEventId`**, calls transaction |
| `server/lib/stats-aggregate.js` | **`transactionalAppendEventAndUpdateStats`**, **`applyEventToStatsTree`**, **`buildStatsFirestoreDocument`** |
| `server/lib/admin-firestore.js` | Admin Firestore with **`FIRESTORE_DATABASE_ID`** |
| `server/lib/stats-aggregate.test.js` | Unit tests for merge rules, including leaderboard **`wins`** |

## Future work (out of C1)

- **Scheduled snapshot jobs** (Story B2) **read** `stats/summary` and **write** `leaderboards/snapshots/boards/*` — separate writers; still Admin-only.
- **Cloud Function** duplicate of the HTTP path is optional if product moves ingestion off Express.

## References

- `firestore.rules` — client write matrix for `stats` / `gameplayEvents`
- [leaderboards-phase3-jira.md](leaderboards-phase3-jira.md) — Story C1
