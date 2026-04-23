# Stats verification toolkit (Story 8)

Reconcile **`users/{uid}/stats/summary`** against a full replay of **`users/{uid}/gameplayEvents/*`**.

The server updates the aggregate in the same transaction as each new event (`server/lib/stats-aggregate.js`). This script loads all events, sorts them by **`createdAt`** (then `eventId` for ties), applies **`applyEventToStatsTree`** in that order, and compares the result to the stored aggregate (normalized with **`normalizeStatsFromFirestore`**).

The script loads **`.env`** via `dotenv` (same as `index.js`), so you can set **`FIRESTORE_DATABASE_ID`** and credential paths locally without exporting them every time.

## Prerequisites

- **Firebase Admin** credentials (same as the Express API):
  - **`FIREBASE_SERVICE_ACCOUNT_JSON`** — JSON string of a service account, or
  - **`GOOGLE_APPLICATION_CREDENTIALS`** — path to a service account key file
- **`FIRESTORE_DATABASE_ID`** — must match the app (e.g. **`roster-riddles`** for production; omit or `(default)` for the default database). See `.env.example` and `server/lib/admin-firestore.js`.

## Staging verification uid

For **staging** reconciliation and PR evidence, use this Firebase Auth **`uid`**:

| Environment | `uid` |
|-------------|--------|
| Staging | `fLpbO082rbMGp3bHw0YBMmdIKs53` |

Copy-paste (set credentials as in [Prerequisites](#prerequisites)):

```bash
npm run verify:stats-reconciliation -- fLpbO082rbMGp3bHw0YBMmdIKs53
```

## QA procedure

1. Use the [staging verification uid](#staging-verification-uid) above, or pick another test **`uid`** (Firebase Authentication → user record).
2. From the repo root, run:

   ```bash
   export FIREBASE_SERVICE_ACCOUNT_JSON='{"type":"service_account",...}'
   export FIRESTORE_DATABASE_ID=roster-riddles
   npm run verify:stats-reconciliation -- <uid>
   ```

   Or without npm:

   ```bash
   node scripts/verify-stats-reconciliation.mjs <uid>
   ```

3. **Expect:** stdout ends with  
   `[verify-stats] OK — users/<uid>/stats/summary matches replay of N gameplay event(s).`  
   and exit code **`0`**.
4. **On mismatch:** exit code **`1`**; the script prints normalized stored vs recomputed JSON. Investigate event ordering, invalid payloads, or manual edits to aggregates/events.

### Optional flags

| Flag | Meaning |
|------|--------|
| `--verbose` / `-v` | Print each event in apply order (truncated id + result + mode). Compare `lastPlayedAt` to the last event’s `createdAt` (ms). |
| `--limit N` | Process only the **first N** events after sort (oldest first). **Does not** validate against the live aggregate (exits **`2`**). Use only for debugging large collections. |

### Staging sign-off (acceptance)

For release evidence, run the command against the [staging verification uid](#staging-verification-uid) (or another staging account with real traffic), capture **terminal output** or a screenshot showing **`OK`** and the event count, and attach to the PR or ticket. Example log line shape:

```text
[verify-stats] OK — users/fLpbO082rbMGp3bHw0YBMmdIKs53/stats/summary matches replay of 42 gameplay event(s).
```

## Firestore query recipe (console / gcloud)

Equivalent data access (read-only):

- Collection: `users/{uid}/gameplayEvents`
- Document: `users/{uid}/stats/summary`

The script is the recommended check because it encodes sort order and the same pure functions as production.

## Troubleshooting

| Symptom | Likely cause |
|---------|----------------|
| `Firestore init failed` | Missing or invalid Admin credentials. |
| `MISMATCH` | Events applied out of order vs server (rare), corrupt event fields, or aggregate updated without a matching event (manual write). |
| `invalid event payloads` | `result` / `gameMode` missing or not in the allowed sets; fix source data or backfill. |
| `last event createdAt ≠ lastPlayedAt` (verbose) | Expected only if metadata was written differently; investigate if combined with mismatch. |
