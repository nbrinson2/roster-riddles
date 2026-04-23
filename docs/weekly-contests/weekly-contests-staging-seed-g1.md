# Weekly contests — staging seed + checklist (Story G1)

**Status:** Implemented (fixture + seed script + checklist)  
**Depends on:** [weekly-contests-api-c1.md](weekly-contests-api-c1.md) (C1), [weekly-contests-ops-e2.md](weekly-contests-ops-e2.md) (E2), [weekly-contests-schema-results.md](weekly-contests-schema-results.md) (F1 dry-run)

## Goal

Provide a **repeatable** way to load a **fake Bio Ball contest**, **entrant rows**, and **gameplay events** in a **staging** Firestore project so that:

- Known **uids** produce **predictable ranks** after **`POST /api/internal/v1/contests/run-scoring`**.
- **Dry-run payout** lines follow **F1** (**`FAKE_USD`**, **`amountCents`** for rank 1 — not real money).

## Fixture

1. Copy **[`docs/fixtures/weekly-contest-staging.example.json`](../fixtures/weekly-contest-staging.example.json)** to **`weekly-contest-staging.json`** in the repo root (gitignored), **or** keep a path elsewhere and pass it as the first CLI argument.
2. Set **`contestId`**, **`entrants[].uid`**, and window timestamps for your environment. Example UIDs in the committed fixture are placeholders — **replace with real Firebase Auth `uid`s** from staging before running a real seed (test accounts you control).
3. **`metadata.currencyNote`** and **`expectedAfterScoring`** document **FAKE_USD** / **`dryRunWinnerAmountCents`** (**10000** = **$100.00** notional for rank 1 in v1 scoring).

## Seed script (writes Firestore)

Requires Admin credentials (same as other ops scripts): `GOOGLE_APPLICATION_CREDENTIALS` or `FIREBASE_SERVICE_ACCOUNT_JSON`; optional `FIRESTORE_DATABASE_ID`.

```bash
export GOOGLE_APPLICATION_CREDENTIALS=./secrets/roster-riddles-staging-adminsdk.json
export FIRESTORE_DATABASE_ID='(default)'

# Validate fixture only (no credentials needed)
npm run seed:weekly-contest-staging -- --dry-run

# Write contest + entries + users/{uid}/gameplayEvents (idempotent event ids)
npm run seed:weekly-contest-staging

# Or explicit path:
# node scripts/seed-weekly-contest-staging.mjs ./weekly-contest-staging.json
```

The script writes:

- `contests/{contestId}` — `gameMode: bio-ball`, **`metadata.notRealMoney`** from fixture when present.
- `contests/{contestId}/entries/{uid}` — mirrors join fields (trusted seed, not the public join API).
- `users/{uid}/gameplayEvents/{eventId}` — Bio Ball **`result`** + **`createdAt`** inside **[windowStart, windowEnd)** and after **`joinedAt`**, so the scoring job’s mini-league slate matches **`slate`**.

**Re-running** the same fixture overwrites the same contest/entry docs and the same event doc ids (deterministic **`clientSessionId`** + `computeGameplayEventId`).

## After seed — lifecycle (manual QA)

For a full **staging sign-off** (paid + cancelled paths, logs, evidence), follow [weekly-contests-runbook-g2.md](weekly-contests-runbook-g2.md) (Story G2).

When **`status`** is **`open`**, close the window and score using internal hooks (see [weekly-contests-ops-e1.md](weekly-contests-ops-e1.md), [weekly-contests-ops-e2.md](weekly-contests-ops-e2.md), [weekly-contests-ops-d1.md](weekly-contests-ops-d1.md)):

1. Move **`open` → `scoring`** when **`now >= windowEnd`** (or **`force: true`** for staging).
2. **`POST /api/internal/v1/contests/run-scoring`** with **`contestId`**.
3. Verify **`contests/{id}/results/final`** standings and **`payouts/dryRun`** (**FAKE_USD**, rank 1 **`amountCents`** per F1).

To void or re-score after **`paid`**, see [weekly-contests-ops-f2.md](weekly-contests-ops-f2.md).

## Sign-off checklist (staging)

| Step | Done | Initials | Date |
|------|:----:|----------|------|
| Fixture copied / edited; **real** staging uids; **FAKE_USD** / notional amounts understood | [ ] | | |
| `npm run seed:weekly-contest-staging` completed without error | [ ] | | |
| Contest transitioned **`open` → `scoring` →** scoring run → **`paid`** (or your target path) | [ ] | | |
| Standings match **`expectedAfterScoring`** (ranks / wins) | [ ] | | |
| Dry-run **`payouts/dryRun`** shows numeric lines; UI shows “Winner gets …” + dry-run banner (C2) | [ ] | | |

## References

- Example fixture: [`docs/fixtures/weekly-contest-staging.example.json`](../fixtures/weekly-contest-staging.example.json)
- Script: [`scripts/seed-weekly-contest-staging.mjs`](../scripts/seed-weekly-contest-staging.mjs)
- E2E staging sign-off: [weekly-contests-runbook-g2.md](weekly-contests-runbook-g2.md) — Story G2
- Jira: [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — Story G1
