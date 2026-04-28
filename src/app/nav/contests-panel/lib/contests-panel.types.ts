import type { ContestEntryPaymentStatus } from 'src/app/shared/models/contest-entry.model';
import type { ContestStatus } from 'src/app/shared/models/contest.model';

/** Max `paid` contests shown (most recent by window end), in addition to all open + scheduled. */
export const MAX_COMPLETED_CONTESTS = 5;

/** Per-contest entry doc (signed-in user), for “You’re in” and join UI. */
export interface ContestEntryRowState {
  loaded: boolean;
  /** Firestore doc exists (`entries/{uid}`). */
  entered: boolean;
  rulesAcceptedVersion: number | string | null;
  /** Phase 5 — when set, drives paid vs free “you’re in” (webhook writes `paid`). */
  paymentStatus?: ContestEntryPaymentStatus | null;
}

/** Dry-run payout snapshot for one contest card. */
export interface ContestPayoutView {
  loading: boolean;
  winnerText: string | null;
  otherLines: string[];
  lineCount: number;
  currencyLabel: string;
}

/** Row for list + detail (Firestore + id). */
export interface ContestListRow {
  contestId: string;
  status: ContestStatus;
  gameMode: string;
  rulesVersion: number | string;
  title: string;
  leagueGamesN: number;
  windowStart: Date;
  windowEnd: Date;
  prizePoolCents?: number;
  entryFeeCents?: number;
  maxEntries?: number;
}

export interface ContestJoinResponse {
  idempotentReplay: boolean;
  entry: {
    schemaVersion: number;
    contestId: string;
    uid: string;
    rulesAcceptedVersion: number | string;
    joinedAt: string;
    displayNameSnapshot?: string | null;
    clientRequestId?: string;
    /** Present when entry includes Phase 5 payment fields (e.g. paid replay). */
    paymentStatus?: ContestEntryPaymentStatus;
    entryFeeCentsSnapshot?: number;
  };
  contest: {
    contestId: string;
    status: string;
    gameMode: string;
    rulesVersion: number | string;
    leagueGamesN: number;
    windowStart: string;
    windowEnd: string;
    title?: string;
  };
}

export interface ContestCheckoutSessionResponse {
  schemaVersion: number;
  url: string;
  sessionId: string;
}

/** Recent free-join HTTP response — drives headline wording and delight styling until cleared. */
export interface ContestJoinSuccessView {
  headline: 'joined' | 'already';
  rulesLine: string;
}
