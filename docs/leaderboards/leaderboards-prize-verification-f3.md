# Prize / verification gate (Story F3)

**Status:** **Deferred for Leaderboards v1** (no paid contests or prize claims in this release)  
**Depends on:** [leaderboards-phase3-adr.md](leaderboards-phase3-adr.md) (Story A0 — anti-abuse)

## v1 decision

Roster Riddles **v1 leaderboards** ship **wins-based rankings** only. There is **no** prize wallet, claim flow, or KYC in this codebase path. Story F3 exists so Jira and the ADR record an explicit **deferral** rather than an ambiguous gap.

**Owner (when picked up):** Product + Legal define eligibility and tax/disclosure rules; engineering implements the gate below.

## Intended shape (post–v1 / contests)

When contests or cash-equivalent prizes exist, a minimal gate usually includes:

1. **Eligibility record** — e.g. Firestore `users/{uid}/prizeProfile` or `contestClaims/{claimId}` with `status: pending | approved | rejected`, `reviewedBy`, `reviewedAt`, optional `notes` (internal only).
2. **Claim API** — authenticated `POST` (or similar) that creates a **pending** claim; **no** payout until `approved`.
3. **Admin review** — console or support tool to flip `approved` / `rejected`; audit log (Story 9–style JSON lines).
4. **Client** — “Verify identity” / “Under review” UX; **no** PII in leaderboard public payloads.

## What not to do in v1

- Do not block **`GET /api/v1/leaderboards`** on KYC — public read stays cheap and anonymous-friendly.
- Do not store government IDs in Firestore without a separate security review and retention policy.

## References

- ADR anti-abuse row: [leaderboards-phase3-adr.md#anti-abuse](leaderboards-phase3-adr.md#anti-abuse)
- Jira: [leaderboards-phase3-jira.md](leaderboards-phase3-jira.md) — Story F3
