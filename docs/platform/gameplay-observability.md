# Gameplay events — observability (Story 9)

Structured logging and operational notes for **`POST /api/v1/me/gameplay-events`**.

## Request correlation

- Every HTTP request receives **`req.requestId`** (UUID or a safe inbound **`X-Request-ID`**).
- The same value is echoed on the response as **`X-Request-ID`**.
- Gameplay and auth log lines include **`requestId`** so failed writes and auth failures can be tied to a single request in Cloud Logging (or any log sink).

**Secrets:** Logs never include `Authorization` headers, ID tokens, or service account material. Error messages are truncated; request bodies are not dumped on success or validation failure.

## Structured log line (`gameplay-events`)

Each handler outcome emits **one JSON object** on stdout with (subset may be omitted when unknown):

| Field | Description |
|--------|-------------|
| `component` | Always `gameplay-events`. |
| `severity` | `INFO`, `WARNING`, or `ERROR` (derived from HTTP status). |
| `timestamp` | ISO-8601 UTC. |
| `requestId` | Correlation id. |
| `uid` | Firebase Auth uid (omitted if unauthorized path). |
| `eventId` | Deterministic Firestore document id (hex), when computed. |
| `gameMode` | e.g. `bio-ball`, when known after parse. |
| `result` | Game outcome: `won` \| `lost` \| `abandoned` (not the HTTP status). |
| `httpStatus` | Response status: `201` created, `200` idempotent replay, `400`, `500`, `503`. |
| `outcome` | Semantic code (see below). |
| `latencyMs` | Wall time for the handler (ms). |
| `idempotentReplay` | `true` when existing event was returned (`200`). |
| `validationIssueCount` | Zod issue count (`400` only). |
| `firestoreCode` / `errorMessage` | Sanitized Firestore / init errors (`500` / `503`), truncated. |

### `outcome` values

| `outcome` | Meaning |
|-----------|---------|
| `event_created` | New event written (`201`). |
| `idempotent_replay` | Same `clientSessionId` replay (`200`). **Not HTTP 409** — duplicates are surfaced as `200` with `idempotentReplay: true`. |
| `validation_error` | Zod validation failed (`400`). |
| `firestore_init_failed` | Admin SDK / Firestore not available (`503`). |
| `write_failed` | Transaction error (`500`). |
| `read_after_write_failed` | Rare read-after-write inconsistency (`500`). |
| `unauthorized` | Missing `req.user` (`401`). |

## Log-based metrics (optional)

Filter JSON logs in your sink (Cloud Logging, Datadog, etc.):

- **Idempotent replay rate:** `jsonPayload.outcome="idempotent_replay"` (or `httpStatus=200` and `idempotentReplay=true`).
- **Validation failure rate:** `jsonPayload.outcome="validation_error"` (or `httpStatus=400`).

Alert on high **`write_failed`** or **`firestore_init_failed`** rates with **`severity="ERROR"`**.

## Auth logs (`component`: `auth`)

Structured lines include **`requestId`**, **`outcome`** (`admin_init_failed` | `invalid_token`), and a short **`message`**. Tokens are never logged.

## Firestore indexes

Current production path **writes** by deterministic document id and does **not** run composite queries on `gameplayEvents` in application code. **No composite index** is required for the Express API or the **`verify-stats-reconciliation`** script (full collection read per user).

If you later add queries such as `where('gameMode', '==', x).orderBy('createdAt')` under `users/{uid}/gameplayEvents`, create a composite index in **`firestore.indexes.json`** and deploy; until then **`indexes`** may remain empty.
