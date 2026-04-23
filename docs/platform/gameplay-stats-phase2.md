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
| **Implementation** | `server/gameplay/gameplay-events.js` — validates with **Zod**, writes with **Admin SDK** to `users/{uid}/gameplayEvents/{eventId}` |
| **Firestore DB** | Server uses **`FIRESTORE_DATABASE_ID`** (omit or `(default)` for staging; production often `roster-riddles`) so it matches the Angular `firestoreDatabaseId`. **Cloud Run / Docker:** bake or set this env var at runtime — if unset, Admin SDK uses **`(default)`** while the client may use **`roster-riddles`**, causing failed writes or data in the wrong database. See [Troubleshooting: POST /gameplay-events 500](#troubleshooting-post-gameplay-events-500). |
| **Angular client (Story 5)** | `GameplayTelemetryService` — `POST` on win/loss from `CommonGameService`, `abandoned` when navigating away while `PLAYING`; gated by `featureFlags.gameplayTelemetry` and `environment.sendGameplayEvents`. |
| **Profile UI (Story 6)** | `ProfileComponent` reads `users/{uid}/stats/summary` via Firestore client (`docData`) for spot-checks vs console. |

---

## 3. Per-mode interpretation (non-normative)

Implementations should set **`mistakeCount`** consistently per mode:

- **Bio Ball / Nickname Streak:** typically number of **incorrect guesses** before win/loss/abandon.
- **Career Path:** typically number of **wrong selections** or branches taken that count against the player (match whatever the UI considers a “mistake”).

Use **`modeMetrics`** only when a future metric cannot be expressed as a single integer (document keys in the API or client implementation notes).

---

## 4. Aggregate document: `users/{uid}/stats/summary`

Single document id **`summary`** (subcollection `stats`), updated **only by trusted code** in the **same Firestore transaction** as a new gameplay event insert (see `server/lib/stats-aggregate.js`).

| Field | Type | Description |
|-------|------|-------------|
| `aggregateVersion` | `number` (int) | Schema version for this aggregate shape (`STATS_SCHEMA_VERSION` in server code). |
| `updatedAt` | `Timestamp` | Server time when aggregates were written (`FieldValue.serverTimestamp()`). |
| `statsUpdatedAt` | `Timestamp` | Same purpose as `updatedAt` — duplicate field for debugging / grep in exports. |
| `lastPlayedAt` | `Timestamp` | Same instant as the last applied event’s `createdAt` (written in one transaction). |
| `totals` | `map` | `gamesPlayed`, `wins`, `losses`, `abandoned`. |
| `totalsByMode` | `map` | Per `gameMode` key: same counters as `totals`. |
| `streaks` | `map` | `byMode.{gameMode}.currentWinStreak` / `bestWinStreak` — consecutive `won` per mode in **API processing order**; plus `nicknameStreak.{current,best}` from nickname `modeMetrics`. |
| `bests` | `map` | Global `fastestWinMs`, `fewestMistakesWin`, plus `byMode.{gameMode}` for the same two metrics (wins only). |

**Reads:** authenticated user may **read** their own `stats` subcollection documents; **writes** from the client are **denied** in `firestore.rules` (Story 3).

---

## 5. Security model (reference for rules + Express owners)

- **Clients** do not write directly to `gameplayEvents` or `stats`; they use **HTTPS + Firebase Auth** to the Express API, which uses the **Admin SDK** (bypasses rules).
- **`firestore.rules` (Story 3):** `users/{userId}/gameplayEvents/{eventId}` — **read** own events only; **create/update/delete** `false`. `users/{userId}/stats/{docId}` — **read** own aggregates only; **create/update/delete** `false`. Deploy: [firestore-rules-deploy.md](firestore-rules-deploy.md).

---

## 6. Review sign-off

| Role | Owner | Status |
|------|--------|--------|
| Firestore rules | *TBD — team* | Story 3 rules merged — deploy per [firestore-rules-deploy.md](firestore-rules-deploy.md) |
| Express / API | *TBD — team* | Pending review |

*Update this table when reviewers acknowledge the design.*

---

## 7. Verification toolkit (Story 8)

- **Script:** `scripts/verify-stats-reconciliation.mjs` — replay `gameplayEvents` with `applyEventToStatsTree` and diff against `stats/summary`.
- **QA steps:** [stats-reconciliation.md](stats-reconciliation.md) — pick user `uid`, run `npm run verify:stats-reconciliation -- <uid>`, expect exit **0** and no diff.

### Troubleshooting: POST /gameplay-events 500

If **`POST /api/v1/me/gameplay-events`** returns **500** in production while Auth works:

1. **Database mismatch (most common)** — The Angular bundle targets **`environment.firestoreDatabaseId`** (often **`roster-riddles`** from `generate-env-prod.mjs`). Express uses **`process.env.FIRESTORE_DATABASE_ID`** in `server/lib/admin-firestore.js`. If that env var is **missing** on Cloud Run, the server uses Firestore **`(default)`** instead of the named database, which can cause transaction failures or writes that never show up in the client’s DB.
   - **Fix (deploy):** Ensure the container sets **`FIRESTORE_DATABASE_ID=roster-riddles`** (see `Dockerfile` runtime `ENV` and `cloudbuild.yaml` `_FIRESTORE_DATABASE_ID`).
   - **Fix (immediate):** `gcloud run services update SERVICE_NAME --region=REGION --set-env-vars FIRESTORE_DATABASE_ID=roster-riddles` (use your service name/region).
2. **IAM** — Cloud Run’s service account needs Firestore access in the Firebase/GCP project (e.g. **Datastore User** / **Cloud Datastore User**).
3. **Logs** — Structured lines from `gameplay-events` include **`requestId`**, **`outcome: write_failed`**, and **`errorMessage`** / **`firestoreCode`** (see [gameplay-observability.md](gameplay-observability.md)). Correlate with **`X-Request-ID`** on the response.

---

## 8. Observability (Story 9)

- **Logging:** Structured JSON lines for gameplay events (`requestId`, `uid`, `eventId`, `gameMode`, `latencyMs`, `result`, `httpStatus`, `outcome`). See [gameplay-observability.md](gameplay-observability.md).
- **Indexes:** No composite indexes required for current writes/queries; see same doc if adding filtered `gameplayEvents` queries.

---

## References

- [Leaderboards Phase 3 ADR](../leaderboards/leaderboards-phase3-adr.md) — v1 scope (wins-based boards; weekly follow-up).
- `src/app/app-routing.module.ts` — route prefixes.
- `src/app/game/shared/constants/game.constants.ts` — `GameType`.
- `src/app/nav/difficulty-toggle/difficulty-toggle.component.ts` — `Difficulty`.
- `firestore.rules` — `users/{userId}`, `gameplayEvents`, `stats`.
- `docs/platform/firestore-rules-deploy.md` — staging + prod deploy steps.
