# Weekly contests — staging end-to-end runbook (Story G2)

**Status:** Implemented  
**Depends on:** [weekly-contests-staging-seed-g1.md](weekly-contests-staging-seed-g1.md) (G1), [weekly-contests-ops-d1.md](weekly-contests-ops-d1.md) (D1), [weekly-contests-ops-e1.md](weekly-contests-ops-e1.md) (E1), [weekly-contests-ops-e2.md](weekly-contests-ops-e2.md) (E2), [weekly-contests-ops-f2.md](weekly-contests-ops-f2.md) (F2), [weekly-contests-api-c1.md](weekly-contests-api-c1.md) (C1)

## Purpose

Single place for **release owners** and **QA** to run and sign off the **weekly contest dry-run lifecycle in staging**: who invokes which hook, how to confirm **immutable** results + **FAKE_USD** payouts, how to verify **logs**, and how to **reset** for another cycle (**new `contestId`**).

General hosting and Firebase layout: [environment-matrix.md](environment-matrix.md).

---

## Prerequisites

| Requirement | Notes |
|-------------|--------|
| Staging API base URL | e.g. `https://<staging-api>` — same host for **`/api/v1/*`** (auth) and **`/api/internal/v1/*`** (secrets). |
| `CONTESTS_OPERATOR_SECRET` | D1 / E2 / F2 internal routes ([weekly-contests-ops-d1.md](weekly-contests-ops-d1.md)). |
| `CONTEST_WINDOW_CRON_SECRET` | Optional; E1 may fall back to operator secret ([weekly-contests-ops-e1.md](weekly-contests-ops-e1.md)). |
| Firebase Auth test users | For **join** (`POST /api/v1/contests/:id/join`) and contests UI ([weekly-contests-api-c1.md](weekly-contests-api-c1.md)). |
| Admin SDK (optional) | For [G1 seed](weekly-contests-staging-seed-g1.md) — not required if you create contests only via Admin console / other tooling. |

Set shell helpers (example):

```bash
export API_BASE="https://<your-staging-api>"
export CONTESTS_OPERATOR_SECRET="…"   # never commit
export AUTH_BEARER_USER="…"           # Firebase ID token for curl join tests
```

---

## Path 1 — Happy path to **`paid`** (dry-run complete)

Use a **dedicated `contestId`** per run (e.g. `staging_e2e_2026_04_19_a`). Reusing ids across tests is OK only if you follow [reset](#reset-for-the-next-week-or-demo).

| Step | Actor | Action | Verify |
|------|--------|--------|--------|
| 1 | Admin / script | Create **`contests/{contestId}`** with **`gameMode: bio-ball`**, valid **`windowStart`/`windowEnd`**, **`leagueGamesN`**, **`rulesVersion`**. Set **`status: scheduled`** then transition to **`open`** via D1, or create **`open`** directly per your process. | Document exists; **`windowEnd` > now** if you want live **join** in the app. |
| 2 | Test user | **Join** — Bio Ball app: contests panel + **`POST .../join`** ([C1](weekly-contests-api-c1.md)), or seed entries via [G1](weekly-contests-staging-seed-g1.md) + gameplay events. | **`contests/{id}/entries/{uid}`** exists; **`rulesAcceptedVersion`** matches contest. |
| 3 | System / cron | When **`now >= windowEnd`**, run **E1** `POST /api/internal/v1/contests/close-due-windows` (or D1 **`open`→`scoring`** with **`force: true`** if staging must close early). | Contest → **`scoring`**; logs: **`component: contest_scoring`**, **`phase`** / **`outcome`** ([E1](weekly-contests-ops-e1.md)). |
| 4 | Worker | **E2** `POST /api/internal/v1/contests/run-scoring` with **`{ "contestId" }`** (webhook from E1 or manual). | **200**; **`results/final`** + **`payouts/dryRun`** written; contest → **`paid`**. |
| 5 | QA | Open **Bio Ball → Weekly contests** (contests panel — Story C2); select the **`paid`** contest. | **Dry-run** copy visible; **“Winner gets $…”** from numeric **`amountCents`** (**FAKE_USD** / notional — [F1](weekly-contests-schema-results.md)). |
| 6 | QA | Firestore read (console or script): **`contests/{id}/results/final`**, **`payouts/dryRun`**. | Standings + tie metadata present; clients **cannot** write these paths ([firestore.rules](../firestore.rules)). |

**Structured logs to spot-check (GCP / stdout):**

- **`component: contest_scoring`** — E1 enqueue / E2 scoring phases ([weekly-contests-ops-e2.md](weekly-contests-ops-e2.md)).
- **`component: contest_transition`** — D1 status changes ([weekly-contests-ops-d1.md](weekly-contests-ops-d1.md)).

---

## Path 2 — **`cancelled`** (must be exercised separately)

Story G2 requires a **`cancelled`** outcome **at least once** (may be a **second** contest). Pick **one** of:

| Scenario | Minimal steps |
|----------|----------------|
| **A. Cancel before scoring** | D1: **`scheduled`→`cancelled`** or **`open`→`cancelled`** with operator secret. No **`results/final`**. |
| **B. Cancel from scoring** | D1: **`scoring`→`cancelled`** (e.g. abort before E2 succeeds). |
| **C. Void after `paid` (F2)** | F2: **`paid`→`cancelled`** with **`force: true`** — artifacts deleted; contest **`cancelled`**. |

Document which scenario you ran in the [sign-off](#sign-off-template) table.

---

## Reset for the next week (or demo)

1. **New contest** — use a **new `contestId`** for a clean lifecycle ([weekly-contests-schema-contests.md](weekly-contests-schema-contests.md)).
2. **Reuse same id** — only after product-allowed cleanup: e.g. F2 **`paid`→`cancelled`** or manual archive; avoid ambiguous **`open`** docs left from half-finished tests.
3. **Indexes** — if list queries fail, confirm composites from [firestore.indexes.json](../firestore.indexes.json) are deployed ([weekly-contests-schema-contests.md](weekly-contests-schema-contests.md)).

---

## Sign-off template (PR comment or ticket)

Copy and fill:

```text
Weekly contests G2 — staging E2E (dry-run)

Path PAID: contestId=________  date=________  operator=________
  - [ ] Join(s) + entries verified
  - [ ] open → scoring → run-scoring → paid
  - [ ] results/final + payouts/dryRun present (FAKE_USD / notional)
  - [ ] UI shows paid contest + Winner gets $… + dry-run disclaimer

Path CANCELLED: contestId=________  scenario=A/B/C (see runbook)  date=________
  - [ ] Contest status cancelled as intended

Evidence: link to PR / Cloud Logging filter / Firestore screenshot (optional)
```

---

## References

- Phase exit criteria: [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — top table + Story G2  
- Jira backlog: same file — Epic G  
