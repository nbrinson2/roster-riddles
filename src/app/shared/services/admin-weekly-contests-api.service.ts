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
}
