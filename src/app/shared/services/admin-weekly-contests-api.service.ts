import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from 'src/environment';
import type { ContestStatus } from 'src/app/shared/models/contest.model';

/** Public contest row from `GET /api/v1/contests` / admin list (Story D2 shape). */
export interface AdminContestPublicRow {
  contestId: string;
  schemaVersion: number;
  status: ContestStatus;
  gameMode: string;
  rulesVersion: number | string;
  leagueGamesN: number;
  windowStart?: string;
  windowEnd?: string;
  title?: string;
  createdAt?: string;
  updatedAt?: string;
  prizePoolCents?: number;
  entryFeeCents?: number;
  maxEntries?: number;
}

export interface AdminContestListResponse {
  schemaVersion: number;
  contests: AdminContestPublicRow[];
}

export interface AdminContestTransitionBody {
  to: 'open' | 'scoring' | 'paid' | 'cancelled';
  force?: boolean;
  reason?: string;
}

export interface AdminContestTransitionResponse {
  contestId: string;
  from: ContestStatus;
  to: ContestStatus;
  actorType: string;
  adminUid: string | null;
  dryRunArtifactsCleared: boolean;
}

export interface AdminContestCreateBody {
  /** Omit to let the server assign a unique id (`bb-<timestamp>-<hex>`). */
  contestId?: string;
  status: 'scheduled' | 'open';
  windowStart: string;
  windowEnd: string;
  leagueGamesN: number;
  rulesVersion?: number | string;
  title?: string;
  prizePoolCents?: number;
  entryFeeCents?: number;
  maxEntries?: number;
}

export interface AdminContestCreateResponse {
  schemaVersion: number;
  contest: AdminContestPublicRow;
}

/** Response from POST /api/v1/admin/contests/:contestId/run-scoring (Story E2). */
export interface AdminContestRunScoringResponse {
  ok: true;
  contestId: string;
  scoringJobId: string;
  /** True when the job advanced the contest `scoring` → `paid`. */
  transitioned: boolean;
  standingsCount: number;
}

/** Optional body for POST /api/v1/admin/contests/:contestId/payout-execute (Phase 6). */
export interface AdminContestPayoutExecuteBody {
  payoutJobId?: string;
}

/**
 * Success JSON from POST /api/v1/admin/contests/:contestId/payout-execute.
 * Shape varies (fresh run vs idempotent `payout_final_already_succeeded`).
 */
export interface AdminContestPayoutExecuteResponse {
  schemaVersion: number;
  contestId: string;
  payoutJobId?: string;
  aggregateStatus?: string;
  outcome?: string;
  lines?: unknown[];
}

@Injectable({ providedIn: 'root' })
export class AdminWeeklyContestsApiService {
  private readonly http = inject(HttpClient);

  private apiUrl(path: string): string {
    return `${environment.baseUrl.replace(/\/$/, '')}${path}`;
  }

  listContests(limit = 50): Observable<AdminContestListResponse> {
    return this.http.get<AdminContestListResponse>(
      this.apiUrl('/api/v1/admin/contests'),
      { params: { limit: String(limit) } },
    );
  }

  transition(
    contestId: string,
    body: AdminContestTransitionBody,
  ): Observable<AdminContestTransitionResponse> {
    const id = encodeURIComponent(contestId);
    return this.http.post<AdminContestTransitionResponse>(
      this.apiUrl(`/api/v1/admin/contests/${id}/transition`),
      body,
    );
  }

  createContest(
    body: AdminContestCreateBody,
  ): Observable<AdminContestCreateResponse> {
    return this.http.post<AdminContestCreateResponse>(
      this.apiUrl('/api/v1/admin/contests'),
      body,
    );
  }

  /** Runs mini-league scoring (E2). Contest must be in `scoring`; success may set status to `paid`. */
  runScoring(contestId: string): Observable<AdminContestRunScoringResponse> {
    const id = encodeURIComponent(contestId);
    return this.http.post<AdminContestRunScoringResponse>(
      this.apiUrl(`/api/v1/admin/contests/${id}/run-scoring`),
      {},
    );
  }

  /**
   * Phase 6 — Stripe prize transfers + `payouts/final` for a `paid` contest (same engine as internal execute).
   * Requires `CONTESTS_PAYMENTS_ENABLED` and Stripe; may move real money.
   */
  payoutExecute(
    contestId: string,
    body: AdminContestPayoutExecuteBody = {},
  ): Observable<AdminContestPayoutExecuteResponse> {
    const id = encodeURIComponent(contestId);
    return this.http.post<AdminContestPayoutExecuteResponse>(
      this.apiUrl(`/api/v1/admin/contests/${id}/payout-execute`),
      body,
    );
  }
}
