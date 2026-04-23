# Weekly contests UI — highest-leverage smoke check (anytime)

**Use this** before a release, after a deploy, or when touching contests Firestore rules, the join API, or `contests-panel` UI. It complements the operator-heavy path in [weekly-contests-runbook-g2.md](weekly-contests-runbook-g2.md) with **player-facing** verification only.

**Scope:** Angular **Weekly contests** drawer (Story C2), not Admin or cron hooks.

---

## Preconditions (all walks)

| Check | Notes |
|--------|--------|
| **Game mode** | Contests entry is **Bio Ball only** — use the game switcher so **Bio Ball** is active; the nav **event** (weekly contests) icon appears only with Bio Ball when the UI flag is on. |
| **Build flag** | `WEEKLY_CONTESTS_UI_ENABLED` must be true for this build/environment ([environment-matrix.md](environment-matrix.md)). |
| **Auth** | **Signed-in** test user (Firebase). Unsigned users should only see sign-in, not the list. |
| **Data** | **Walk A** needs at least one contest in **`open`** with **join window live** (`now ∈ [windowStart, windowEnd)`). **Walk B** needs at least one contest in **`paid`** with **`payouts/dryRun`** (and ideally **`results/final`**) already written — use staging seed or a completed contest from G2. |

---

## Walk A — First-time: strip → card → join

Goal: prove a new entrant can discover the dry-run banner, open a contest, accept rules, and join without errors.

1. **Open the drawer** — From the main nav, choose **Open weekly contests** (calendar **`event`** icon, `aria-label` matches).
2. **Strip** — At the top of the panel, confirm the **dry-run / no real money** note is visible (dashed callout under the hero).
3. **Card** — Confirm at least one **contest card** loads (title, status chip, play window, value line). If the list is empty or stuck loading, stop — fix data or Firestore reads first.
4. **Details** — On an **open** contest that is joinable now, expand **View details**.
5. **Rules surface** — Scroll the expanded region: eligibility, rules bullets, link to full rules, pipeline/help text as expected.
6. **Join** — Check **rules acceptance**, click **Join contest**.
7. **Outcome** — You should see a **success** message and, after the entry snapshot updates, **You’re in** on the card (and rules version when applicable). If join fails, capture status code / body per [weekly-contests-api-c1.md](weekly-contests-api-c1.md).

**Pass:** Strip + card + expanded detail + join success + entered state.  
**Fail:** List error, join disabled with no clear reason while window is open, or repeated 4xx/5xx on join.

---

## Walk B — Returning: panel → last paid contest → payout line + details

Goal: prove a returning user can open the panel, find the most recent finished contest, see payout context on the card, and get closure in the expanded section.

1. **Open the drawer** — Same as step 1 in Walk A.
2. **Locate paid** — Find a contest whose status chip reads **Complete** (`paid`). Listed **paid** contests are the **most recent by window end** (up to a small cap); the **first Complete card in the list** is the usual “last finished” smoke target.
3. **Collapsed card** — On that card, confirm:
   - Meta line includes **winner / payout** phrasing when dry-run data exists (or a sensible loading/empty state while fetching).
   - Optional **your place** line appears when **`results/final`** is present for your uid (may be absent if you did not enter).
4. **Details** — Expand **View details** for that **Complete** contest.
5. **Deep verification** — Inside the expanded region, confirm in order:
   - **Slate** summary line.
   - **Final results** block (winner line; your finish or missing-standings copy when applicable).
   - **Why / tie-break** block when the product shows it (entered users, policy data present).
   - **Payout transparency** one-liner (place count, currency/dry-run honesty).
   - **Dry-run payout** section with **Winner gets …** and other place lines from Firestore.

**Pass:** Payout context on the card and full closure blocks in details without console errors; dry-run honesty copy remains visible.  
**Fail:** Permanent loading spinners, missing payout after **`paid`** + backend wrote dry-run, or blank expanded payout with no error hint.

---

## Quick matrix

| Walk | Proves |
|------|--------|
| **A** | Discovery, trust copy (strip), join API + entry listener |
| **B** | Read paths for **`paid`**, **`payouts/dryRun`**, **`results/final`**, P1 closure UI |

---

## See also

- Full lifecycle + operator steps: [weekly-contests-runbook-g2.md](weekly-contests-runbook-g2.md)  
- Join contract: [weekly-contests-api-c1.md](weekly-contests-api-c1.md)  
- Schema for results/payout docs: [weekly-contests-schema-results.md](weekly-contests-schema-results.md)
