# Mirror production `cache` Firestore data to staging

The app reads game caches from the **`cache`** collection (`mlb_players_snapshot`, `career_path_*`, `mlb_nicknames`, etc.). To copy those documents from **production** into **staging** (separate project, `(default)` database):

## 1. Service accounts

| Role | Needs |
|------|--------|
| **Source (prod)** | JSON key for a service account that can **read** Firestore in the **production** project (`roster-riddles-457600`), **named database `roster-riddles`**. |
| **Target (staging)** | JSON key that can **write** Firestore in **`roster-riddles-staging`**, **`(default)`** database (same key you use for local Express is fine). |

Download keys from each project: **Project settings → Service accounts → Generate new private key**. Store under `secrets/` (gitignored).

## 2. Environment

In `.env` (not committed):

```bash
MIRROR_SOURCE_CREDENTIALS=./secrets/your-prod-readonly-or-admin.json
MIRROR_TARGET_CREDENTIALS=./secrets/roster-riddles-staging-adminsdk.json
SOURCE_FIRESTORE_DATABASE_ID=roster-riddles
# Target is default DB — leave empty or set explicitly:
# TARGET_FIRESTORE_DATABASE_ID=
```

## 3. Run

```bash
node scripts/mirror-firestore-cache.mjs
```

This **overwrites** documents in staging `cache` that share the same IDs as production. It does **not** copy the `users` collection (use only for non-PII cache blobs unless you extend the script).

## 4. Notes

- First-time **Blaze** / export-based backups are a separate process; this script is a **direct document copy** for dev/staging parity.
- Very large documents must stay under Firestore’s per-doc size limit (1 MiB).
- If prod credentials are ever exposed, **rotate** keys in Google Cloud.
