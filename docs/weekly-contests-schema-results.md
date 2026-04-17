# Weekly contests — immutable results & tie metadata (Story B3)

**Status:** Implemented (rules + TS model)  
**Depends on:** [weekly-contests-phase4-adr.md](weekly-contests-phase4-adr.md), [weekly-contests-schema-contests.md](weekly-contests-schema-contests.md)  
**Paths (v1):**

- **`contests/{contestId}/results/final`** — single write-once artifact for ordered standings + tie policy + job idempotency fields.
- **`contests/{contestId}/payouts/dryRun`** — dry-run payout lines (numeric only; no Stripe). May be merged into `results/final` in a later story; separate doc keeps payouts easy to permission separately.

## Immutability & idempotency

- **Clients:** **No** creates/updates/deletes — only **Admin SDK** (scoring job / Express).
- **Retries:** Second scoring run with the same logical inputs should **replace** `results/final` with the **same** standings (or no-op if job uses deterministic `scoringJobId` + compare). Optional **`scoringAttempt`** (monotonic int) documents retries for audit.
- **Tie metadata:** **`tieBreakPolicy`** and per-row **`tieBreakKey`** (and optional **`tieResolution`**) record *why* order is stable (see ADR mini-league ordering).

## `results/final` field reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | Yes | Document schema version. **`1`**. |
| `computedAt` | `Timestamp` | Yes | Server time when scoring finished. |
| `windowStart` | `Timestamp` | Yes | Copy from contest (audit). |
| `windowEnd` | `Timestamp` | Yes | Copy from contest (audit). |
| `gameMode` | `string` | Yes | Phase 4 v1: **`bio-ball`**. |
| `leagueGamesN` | `number` | Yes | Copy from contest. |
| `standings` | `array` | Yes | Ordered rows (see [Standing row](#standing-row)). |
| `tieBreakPolicy` | `string` | Yes | e.g. `mini_league_wins_desc_losses_asc_uid_asc`. |
| `scoringJobId` | `string` | Yes | Idempotency / trace id (opaque). |
| `eventSource` | `string` | Yes | e.g. `gameplayEvents_first_n_bio_ball_after_join`. |
| `scoringAttempt` | `number` | No | Monotonic attempt counter for job retries (optional). |
| `tieResolution` | `map` | No | **Story E3** — structured tie audit (see [Tie resolution (`tieResolution`)](#tie-resolution-tieresolution)). **No PII** beyond optional public `displayName` on rows. |

### Standing row

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `rank` | `number` | Yes | 1-based rank (dense or competition-style per product; must be stable with `standings[]` order). |
| `uid` | `string` | Yes | Entrant uid. |
| `wins` | `number` | Yes | Wins in league slate. |
| `gamesPlayed` | `number` | Yes | Games in slate (≤ `leagueGamesN`). |
| `losses` | `number` | Yes | Losses in slate. |
| `abandoned` | `number` | Yes | Abandoned games in slate. |
| `displayName` | `string` \| `null` | No | Optional snapshot for UI. |
| `tieBreakKey` | `string` | Yes | Deterministic key for this row (e.g. uid used as final tie-break). |
| `tier` | `string` | No | **`full`** \| **`partial`** — Tier A vs B per ADR (optional clarity). |

## `payouts/dryRun` field reference

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `schemaVersion` | `number` | Yes | e.g. **`1`**. |
| `notRealMoney` | `boolean` | Yes | **`true`** in v1. |
| `currency` | `string` | Yes | e.g. **`FAKE_USD`**. |
| `lines` | `array` | Yes | `{ rank` or `place`, `uid`, `amountCents`, optional `label` }. |
| `finalizedAt` | `Timestamp` | Yes | When committed. |
| `payoutJobId` | `string` | No | Correlates with scoring job if separate. |

## Tie resolution (`tieResolution`)

Populated by the scoring job (**Story E3**) so support can explain ordering when stats match before the final key.

| Field | Type | Description |
|-------|------|-------------|
| `schemaVersion` | `number` | Nested audit schema; **`1`**. |
| `policyRef` | `string` | Same logical policy as top-level **`tieBreakPolicy`**. |
| `leagueGamesN` | `number` | Copy for context. |
| `coinFlipOrRandomTieBreak` | `boolean` | **`false`** in v1 — ADR forbids random tie-breaks. |
| `summary` | `string` | Short human-readable rationale. |
| `comparisonSteps` | `object` | **`tierA_fullSlate`** / **`tierB_partialSlate`** step lists (field + direction + notes). |
| `statIdentityGroups` | `array` | Only groups where **≥ 2** entrants shared the same pre-uid stats; each entry documents **`uidsInOrder`**, **`ranks`**, **`equalOnStats`**, and **`resolvedBy.step`** (`uid_utf8_lexicographic_asc`). Omitted entries mean no stat-only ties in that contest. |

## Example `results/final` payload (QA)

```json
{
  "schemaVersion": 1,
  "computedAt": "2026-04-21T12:05:00.000Z",
  "windowStart": "2026-04-14T04:00:00.000Z",
  "windowEnd": "2026-04-21T04:00:00.000Z",
  "gameMode": "bio-ball",
  "leagueGamesN": 10,
  "tieBreakPolicy": "mini_league_wins_desc_losses_asc_uid_asc",
  "scoringJobId": "job_01J8XK2N4S8Q9V0ABCDEF",
  "eventSource": "gameplayEvents_first_n_bio_ball_after_join",
  "scoringAttempt": 1,
  "tieResolution": {
    "schemaVersion": 1,
    "policyRef": "mini_league_wins_desc_losses_asc_uid_asc",
    "leagueGamesN": 10,
    "coinFlipOrRandomTieBreak": false,
    "summary": "Ordering follows ADR mini-league tiers; within identical stat tuples, rank order is by Firebase Auth uid UTF-8 string ascending (deterministic, no randomness).",
    "comparisonSteps": {
      "tierA_fullSlate": [{ "order": 1, "field": "slate_tier", "rule": "full_before_partial" }],
      "tierB_partialSlate": [{ "order": 1, "field": "slate_tier", "rule": "full_before_partial" }]
    },
    "statIdentityGroups": [
      {
        "tier": "full",
        "ranks": [1, 2],
        "uidsInOrder": ["uidAlice", "uidBob"],
        "resolvedBy": { "step": "uid_utf8_lexicographic_asc", "randomness": "none" },
        "equalOnStats": { "wins": 8, "losses": 2, "abandoned": 0, "leagueGamesN": 10 }
      }
    ]
  },
  "standings": [
    {
      "rank": 1,
      "uid": "uidAlice",
      "wins": 8,
      "gamesPlayed": 10,
      "losses": 2,
      "abandoned": 0,
      "displayName": "Alice",
      "tieBreakKey": "uid:uidAlice",
      "tier": "full"
    },
    {
      "rank": 2,
      "uid": "uidBob",
      "wins": 8,
      "gamesPlayed": 10,
      "losses": 2,
      "abandoned": 0,
      "displayName": "Bob",
      "tieBreakKey": "uid:uidBob",
      "tier": "full"
    }
  ]
}
```

(ISO strings shown; Firestore stores **`Timestamp`**.)

## Security rules

- **`results/*`** and **`payouts/*`:** **Read** if **signed-in**; **writes denied** to clients (see `firestore.rules`).

## TypeScript

- **`src/app/shared/models/contest-results-final.model.ts`** — `ContestFinalResultsDocument`, `ContestStandingRow`, tie policy literal type.
- **`src/app/shared/models/contest-payouts-dry-run.model.ts`** — `ContestDryRunPayoutsDocument`, `ContestPayoutLine`.

## References

- [weekly-contests-phase4-jira.md](weekly-contests-phase4-jira.md) — Story B3  
