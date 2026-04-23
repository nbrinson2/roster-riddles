# Deploying `firestore.rules` (staging + production)

The repo’s rules file targets **gameplay stats** (`users/{uid}/gameplayEvents/*`, `users/{uid}/stats/*`) and existing profile/cache paths. Deploy the **same** `firestore.rules` everywhere the app’s clients talk to Firestore so clients cannot forge events or aggregates.

## Production (named database `roster-riddles`)

The Angular production app uses the **named** database `roster-riddles` (second `firestore` entry in `firebase.json`; staging uses the first entry, `(default)`).

1. Use the **production** Firebase / GCP project (see [environment-matrix.md](environment-matrix.md); verify project id in GCP — `npm run deploy:firestore:prod` defaults to `roster-riddles-457600`).
2. From the repo root:

   ```bash
   npm run deploy:firestore:prod
   ```

   Or: `firebase deploy --only firestore:roster-riddles --project <PROD_PROJECT_ID>` if your prod project id differs.

3. In the [Firebase console](https://console.firebase.google.com/) → **Firestore** → database **`roster-riddles`** → **Rules** / **Indexes** and confirm.

## Staging (`(default)` database — `roster-riddles-staging`)

The staging app uses the **`(default)`** Firestore database (see [environment-matrix.md](environment-matrix.md)). **`firebase.json`** includes a `firestore` entry for **`(default)`** so rules and **`firestore.indexes.json`** (leaderboard collection-group indexes) can be deployed to staging.

Deploy **only** the default database to staging (avoids touching a named DB that may not exist in the staging project):

```bash
firebase deploy --only "firestore:(default)" --project roster-riddles-staging
```

Or use the npm script (same command):

```bash
npm run deploy:firestore:staging
```

After deploy, open **Firebase console** → **Firestore** → database **`(default)`** → **Indexes** and wait until composite indexes show **Enabled** before relying on `GET /api/v1/leaderboards` against staging.

**First-time / drift:** If indexes were never deployed to staging, this command is the fix. Re-run after changing `firestore.indexes.json`.

### Production vs staging

| Target | Typical project | Database id | Command |
|--------|-----------------|-------------|---------|
| Staging | `roster-riddles-staging` | `(default)` | `npm run deploy:firestore:staging` |
| Production | e.g. `roster-riddles-457600` (verify in GCP) | `roster-riddles` (named) | `npm run deploy:firestore:prod` |

Do **not** assume indexes deployed to production’s named DB also exist on staging — deploy staging explicitly.

## Verification (local)

```bash
npm run test:firestore-rules
```

Runs the Firestore emulator and `scripts/verify-firestore-rules.mjs`.

Stats aggregate logic (Story 4):

```bash
npm run test:server
npm run test:stats-emulator
```

(`test:stats-emulator` needs the Firestore emulator port free — default **9450** in `firebase.json`.)

**`firebase emulators:exec`:** The CLI stops the emulator when the **child process exits**. Child scripts must finish so Node can exit:

| Script | Teardown |
|--------|----------|
| `verify-firestore-rules.mjs` | `testEnv.cleanup()` in a **`finally`** block (always runs on pass/fail), then **`exitEmulatorExecChild`** |
| `verify-stats-aggregate-emulator.mjs`, `stats-concurrency-load-test.mjs` | **`deleteFirebaseAdminApp(admin)`** in **`finally`** (closes Admin gRPC), then **`exitEmulatorExecChild`** |

Shared helpers live in **`scripts/emulator-child-exit.mjs`**. Without releasing **firebase-admin** or cleaning up **rules-unit-testing**, open handles can keep Node alive and the emulator will **not** shut down.

## Composite indexes (leaderboards — `firestore.indexes.json`)

Indexes for collection-group queries on `stats` live in **`firestore.indexes.json`**. Deploy them **per project / per database** (staging `(default)` vs production `roster-riddles`):

```bash
# Staging — see § Staging above
npm run deploy:firestore:staging

# Production — named database
npm run deploy:firestore:prod
```

Equivalent raw CLI for production:

```bash
firebase deploy --only firestore:roster-riddles --project <PROD_PROJECT_ID>
```

### Pull indexes from GCP into `firestore.indexes.json`

Use the **Firebase CLI** from this repo (`firebase-tools` — e.g. `npx firebase-tools` or `./node_modules/.bin/firebase`). The subcommand is **`firestore:indexes`** (colon; **`firebase firestore indexes`** is invalid).

Staging (`(default)` database):

```bash
npx firebase-tools firestore:indexes --project roster-riddles-staging --database "(default)" --non-interactive > firestore.indexes.json
```

Production (named database `roster-riddles`):

```bash
npx firebase-tools firestore:indexes --project roster-riddles-457600 --database roster-riddles --non-interactive > firestore.indexes.json
```

Omit **`--database "(default)"`** only if you are sure the CLI default matches; quoting **`(default)`** avoids shell errors. Review the diff before committing — this **overwrites** the file.

**Do not** use `--only firestore:indexes` **alone** when `firebase.json` lists **multiple** Firestore databases. In current `firebase-tools`, that filter does not select any database (the CLI drops the `indexes` token), so **no indexes are deployed** and you may see no index step in the log. Use one of:

- **Rules + indexes (recommended):** `npm run deploy:firestore:prod` / `deploy:firestore:staging` (same as `--only firestore:roster-riddles` or `firestore:(default)`).
- **Indexes only:** `npm run deploy:firestore:prod:indexes` / `deploy:firestore:staging:indexes` (compound `--only firestore:indexes,firestore:<database-id>`).
- **Rules only:** `npm run deploy:firestore:prod:rules` / `deploy:firestore:staging:rules` (compound `--only firestore:rules,firestore:<database-id>` — `firestore:rules` alone also selects no database with a multi-entry `firebase.json`).

If the CLI reports an **orphan** index (extra index in GCP not in the repo), run the same command **interactively** and accept deletion, or pass **`--force`** after reviewing (see Firebase CLI help).

### “Indexes in your project but not in your file” + **409** on deploy

Sometimes the CLI lists **`stats`** composite indexes as missing from **`firestore.indexes.json`** even though they are present, then asks to delete them. If you answer **No** (keep remote indexes), the deploy may still try to **create** indexes from the file and return **HTTP 409 — index already exists** on `collectionGroups/stats/indexes`.

That is usually **CLI / API drift** (same logical index, different canonical field-path string), not a bad repo file. Do **not** delete production indexes blindly.

**Rules only (no index step):**

```bash
npm run deploy:firestore:staging:rules
# production:
npm run deploy:firestore:prod:rules
```

These upload **`firestore.rules`** for the matching database only and **skip** composite index reconciliation (use when you only changed rules).

**Fix index deploy (pick one):**

1. **Reconcile from GCP** — List composite indexes and align the repo with what the API returns:
   ```bash
   gcloud firestore indexes composite list \
     --database='(default)' \
     --project=roster-riddles-staging \
     --format=json
   ```
   Compare **`fields[].fieldPath`** to **`firestore.indexes.json`**. If staging uses a different spelling than backticked map keys, adjust the JSON to match (then redeploy).

2. **Create only new indexes in the console** — For **`contests`** composites, use **Firestore → Indexes → Composite → Add** with the same fields as in **`firestore.indexes.json`** (`status` + `windowStart` / `windowEnd`), then keep deploying until the CLI stops fighting `stats` indexes.

3. **Upgrade `firebase-tools`** — Several versions mishandle index reconciliation (see [firebase-tools#8859](https://github.com/firebase/firebase-tools/issues/8859)); try the latest **firebase-tools** in **`devDependencies`**.

If deploy returns **409 index already exists** without the orphan prompt, the index is often already **Enabled** in the console; the failure is duplicate **create**, not a missing index.

**409 but the indexes still show up / become READY**

Firestore’s index API returns **409 Conflict** when a **create** request matches an index that **already exists** or is still **CREATING** (same definition). The Firebase CLI may still report an error and exit **non-zero** even though:

- The index was **already there** from a previous deploy or console link, or  
- The first request created it and a **retry** hit 409, or  
- The index finishes building moments later.

**What to do:** Treat deploy as successful for indexes if **`gcloud firestore indexes composite list`** (or the console) shows every composite from **`firestore.indexes.json`** with **`state: READY`**. Align the JSON with **`fields[].fieldPath`** from `gcloud` output (including **`__name__`** and order) so the next deploy stops issuing redundant creates. Upgrading **`firebase-tools`** also reduces noisy 409s ([firebase-tools#8859](https://github.com/firebase/firebase-tools/issues/8859)).

**Manual `gcloud` create** (same `--collection-group=stats`, `--query-scope=COLLECTION_GROUP`, and field paths as in **`firestore.indexes.json`**). Hyphenated map keys need **backticks** in the field path (e.g. `` totalsByMode.`bio-ball`.wins ``).

Index definitions require **`__name__` as the last field** in each composite index for **`stats`** leaderboard queries.

## Notes

- **Admin SDK** (Express, jobs) **bypasses** security rules; rules constrain **client** SDK access only.
- After changing rules, smoke-test a signed-in client: profile read/write still works; **cannot** `setDoc` under `gameplayEvents` or `stats`.
