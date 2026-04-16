# Deploying `firestore.rules` (staging + production)

The repo’s rules file targets **gameplay stats** (`users/{uid}/gameplayEvents/*`, `users/{uid}/stats/*`) and existing profile/cache paths. Deploy the **same** `firestore.rules` everywhere the app’s clients talk to Firestore so clients cannot forge events or aggregates.

## Production (named database `roster-riddles`)

The Angular production app uses the **named** database `roster-riddles` (see `firebase.json` → `firestore[0].database`).

1. Use the **production** Firebase / GCP project (see `docs/environment-matrix.md`).
2. From the repo root:

   ```bash
   firebase deploy --only firestore:roster-riddles --project <PROD_PROJECT_ID>
   ```

3. In the [Firebase console](https://console.firebase.google.com/) → **Firestore** → select database **`roster-riddles`** → **Rules** and confirm the revision matches what you expect.

## Staging (typically `(default)` database)

The staging app usually uses the **`(default)`** Firestore database in the **staging** project (`roster-riddles-staging`).

1. If `firebase.json` in this repo only lists `roster-riddles`, either:
   - **Add** a second `firestore` entry for `"database": "(default)"` pointing at the same `firestore.rules` (and deploy only the databases that exist in that project), or  
   - **Paste** the contents of `firestore.rules` into the console: Firestore → **(default)** → **Rules** → Publish.

2. CLI example when `(default)` is configured in `firebase.json`:

   ```bash
   firebase deploy --only firestore --project roster-riddles-staging
   ```

   Use `--only firestore:<database-id>` if you need a single database.

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

## Composite indexes (leaderboards — `firestore.indexes.json`)

Indexes for collection-group queries on `stats/summary` live in **`firestore.indexes.json`**. Deploy them with the **same** command as rules, targeting the named database:

```bash
firebase deploy --only firestore:roster-riddles --project <PROD_PROJECT_ID>
```

**Do not** use `--only firestore:indexes` alone when `firebase.json` uses a **named** database array entry — some `firebase-tools` versions skip index prepare and crash. Use **`firestore:<database-id>`** (e.g. `firestore:roster-riddles`).

If the CLI reports an **orphan** index (extra index in GCP not in the repo), run the same command **interactively** and accept deletion, or pass **`--force`** after reviewing (see Firebase CLI help).

If deploy returns **409 index already exists**, the global index may already be **READY**; the CLI can still try to recreate it. Options:

1. Open **Firestore → Indexes** in the console and confirm which `stats` collection-group indexes exist; or  
2. Add any missing index with **`gcloud firestore indexes composite create`** (same `--collection-group=stats`, `--query-scope=COLLECTION_GROUP`, and field paths as in **`firestore.indexes.json`**). Hyphenated map keys need **backticks** in the field path (e.g. `` totalsByMode.`bio-ball`.wins ``).

Index definitions require **`__name__` as the last field** in each composite index.

## Notes

- **Admin SDK** (Express, jobs) **bypasses** security rules; rules constrain **client** SDK access only.
- After changing rules, smoke-test a signed-in client: profile read/write still works; **cannot** `setDoc` under `gameplayEvents` or `stats`.
