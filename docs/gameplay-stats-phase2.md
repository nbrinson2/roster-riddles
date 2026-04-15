# Gameplay stats (Phase 2) — event & aggregate schemas

**Status:** Accepted (Story 1 — design + ADR)  
**Scope:** Instrumentation for per-user gameplay statistics. Implementation (API, rules, clients) is tracked separately.

## Context

- Firestore database: production uses the **named** database `roster-riddles` (see `getConfiguredFirestore()` / `environment.firestoreDatabaseId`).
- User-scoped data already lives under `users/{uid}` (see `firestore.rules`).
- Shipped games use the route prefixes and `GameType` enum in `src/app/game/shared/constants/game.constants.ts`.

## Decision summary

| Topic | Decision |
|--------|-----------|
| Event collection | **`users/{uid}/gameplayEvents/{eventId}`** — natural isolation, matches existing user subtree, simplifies rules. |
| Aggregate document | **`users/{uid}/stats`** — single document per user for fast profile reads. |
| Client writes to events | **Denied** — events (and aggregates) are written only via **trusted code** (Express Admin SDK and/or Cloud Functions). Clients call an authenticated API. |
| Timestamps | **Server-authoritative** `createdAt` on the event at write time; optional **`clientOccurredAt`** for debugging and ordering; see [Timestamp policy](#timestamp-policy). |

---

## 1. `gameMode` and routing alignment

`gameMode` MUST use the same string values as **`GameType`** (these match URL segments under `src/app/app-routing.module.ts`):

| `gameMode` value | Route pattern | Primary component |
|------------------|---------------|-------------------|
| `bio-ball` | `bio-ball/:league` | `BioBallComponent` |
| `career-path` | `career-path/:league` | `CareerPathComponent` |
| `nickname-streak` | `nickname-streak/:league` | `NicknameStreakComponent` |

**League:** persist optional **`league`** (string, e.g. `mlb`) copied from the `:league` route param so stats can be split or filtered later without inferring from `gameMode` alone.

**Legacy / aliases:** There are **no** legacy `gameMode` strings in production data at Phase 2 design time. If historical backfill uses older labels, map them in the migration script into the table above and record the mapping in the backfill runbook (do not overload `gameMode` at write time).

---

## 2. Event document: `users/{uid}/gameplayEvents/{eventId}`

### 2.1 Immutability

- Events are **append-only**: **no updates or deletes** from clients.
- Trusted backends may use Admin SDK for corrections in exceptional cases (documented out-of-band); normal path is insert-once.

### 2.2 Identifier: `eventId`

- **Implemented (Express):** deterministic document id: **`SHA-256(uid + U+001E + clientSessionId)`** in **hex** (64 characters). Retries with the same `clientSessionId` read the same document and receive **`200`** with `idempotentReplay: true` and the stored `event` echo (first write wins).
- **Dedupe:** **`clientSessionId`** is the idempotency key per user. Uniqueness is effectively **`(uid, clientSessionId)`** via the hash id.
- **Backfill:** Imported events should use **deterministic** `eventId`s when possible (e.g. hash of source row + source system) so reruns are idempotent; otherwise rely on a separate **`importBatchId`** field and skip-if-seen logic in the script.

### 2.3 Required fields (payload + stored document)

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `number` (int) | Schema version for this document shape (start at `1`). |
| `gameMode` | `string` | One of: `bio-ball`, `career-path`, `nickname-streak`. |
| `result` | `string` | `won` \| `lost` \| `abandoned`. |
| `durationMs` | `number` (int, ≥ 0) | Wall-clock play duration for this session/round in milliseconds. |
| `mistakeCount` | `number` (int, ≥ 0) | Primary “wrong step” count (e.g. incorrect guesses); see [Per-mode interpretation](#per-mode-interpretation). |
| `clientSessionId` | `string` | Opaque id from the client for deduplication (UUID v4 recommended). |

### 2.4 Optional fields

| Field | Type | Description |
|-------|------|-------------|
| `league` | `string` | Route `league` param (e.g. `mlb`). |
| `difficulty` | `string` | Aligns with UI: `easy` \| `hard` \| `n/a` (see `Difficulty` in `difficulty-toggle.component.ts`). |
| `clientOccurredAt` | `Timestamp` | Client clock when the round completed (for debugging; not authoritative for security). |
| `appVersion` | `string` | Optional app/build identifier (e.g. from `environment` or CI). |
| `deployment` | `string` | Optional: `development` \| `staging` \| `production` (align with `DeploymentEnvironment` / build). |
| `modeMetrics` | `map` | Optional per-mode bag for fields that do not fit a single global schema (keep small; prefer stable keys per `gameMode`). |

### 2.5 Server / trusted fields (set only by backend)

| Field | Type | Description |
|-------|------|-------------|
| `createdAt` | `Timestamp` | **Server timestamp** at commit time (`FieldValue.serverTimestamp()`). **Authoritative** ordering and “when we recorded this event.” |
| `uid` | `string` | Redundant copy of path `uid` for queries exports (optional but useful). |

### 2.6 Timestamp policy

- **`createdAt` (required):** **Server-authoritative.** Set only in trusted code. Used for streak ordering, “last played,” and audit.
- **`clientOccurredAt` (optional):** Client-supplied instant when the user finished (or last meaningful action). The API MAY reject values outside **reasonable bounds** relative to server time (e.g. skew > 24h or negative duration) to limit bad clocks; bounds are enforced in validation, not in Firestore rules alone.
- **Spot-checks and reconciliation** should prefer **`createdAt`** unless product explicitly requires client time for a metric.

### 2.7 Trusted write API (Express)

| | |
|---|---|
| **Endpoint** | `POST /api/v1/me/gameplay-events` |
| **Auth** | `Authorization: Bearer <Firebase ID token>` (same pattern as `GET /api/v1/me`) |
| **Implementation** | `server/gameplay-events.js` — validates with **Zod**, writes with **Admin SDK** to `users/{uid}/gameplayEvents/{eventId}` |
| **Firestore DB** | Server uses **`FIRESTORE_DATABASE_ID`** (omit or `(default)` for staging; production often `roster-riddles`) so it matches the Angular `firestoreDatabaseId`. |

---

## 3. Per-mode interpretation (non-normative)

Implementations should set **`mistakeCount`** consistently per mode:

- **Bio Ball / Nickname Streak:** typically number of **incorrect guesses** before win/loss/abandon.
- **Career Path:** typically number of **wrong selections** or branches taken that count against the player (match whatever the UI considers a “mistake”).

Use **`modeMetrics`** only when a future metric cannot be expressed as a single integer (document keys in the API or client implementation notes).

---

## 4. Aggregate document: `users/{uid}/stats`

Single document, updated **only by trusted code** after validating events (transaction or deterministic recompute).

| Field | Type | Description |
|-------|------|-------------|
| `aggregateVersion` | `number` (int) | Bump when the aggregate schema or recomputation logic changes. |
| `updatedAt` | `Timestamp` | Last time aggregates were written. |
| `lastPlayedAt` | `Timestamp` | Last completed recorded game (`createdAt` of latest counted event, or equivalent). |
| `totals` | `map` | Example keys: `gamesPlayed`, `wins`, `losses`, `abandoned` (all non-negative integers). May be split by `gameMode` later, e.g. `totalsByMode`. |
| `streaks` | `map` | At minimum: `currentWinStreak`, `bestWinStreak` (definitions: consecutive `result: won` in `createdAt` order). |
| `bests` | `map` | At minimum: `fastestWinMs` (min `durationMs` where `result == won`), `fewestMistakesWin` (min `mistakeCount` where `result == won`). Can be scoped by `gameMode` in a nested structure if needed. |

**Reads:** authenticated user may **read** their own `stats`; **writes** from the client are **denied** (see future rules change).

---

## 5. Security model (reference for rules + Express owners)

- **Clients** do not write directly to `gameplayEvents` or `stats` in the target design; they use **HTTPS + Firebase Auth** to the Express API (or Callable Functions), which uses the **Admin SDK**.
- **`firestore.rules`:** tighten `users/{userId}` so subcollections `gameplayEvents` and document `stats` are not writable by end users once the API is live (exact rule text is a follow-on story).

---

## 6. Review sign-off

| Role | Owner | Status |
|------|--------|--------|
| Firestore rules | *TBD — team* | Pending review |
| Express / API | *TBD — team* | Pending review |

*Update this table when reviewers acknowledge the design.*

---

## References

- `src/app/app-routing.module.ts` — route prefixes.
- `src/app/game/shared/constants/game.constants.ts` — `GameType`.
- `src/app/nav/difficulty-toggle/difficulty-toggle.component.ts` — `Difficulty`.
- `firestore.rules` — current `users/{userId}` match.
