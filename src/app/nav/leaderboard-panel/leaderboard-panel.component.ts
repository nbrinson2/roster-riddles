import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject, takeUntil } from 'rxjs';
import { environment } from 'src/environment';
import {
  LEADERBOARD_DEFAULT_PAGE_SIZE,
  LeaderboardEntryRow,
  LeaderboardScope,
} from 'src/app/shared/models/leaderboard-query.model';

interface LeaderboardApiResponse {
  schemaVersion: number;
  scope: LeaderboardScope;
  pageSize: number;
  entries: LeaderboardEntryRow[];
  nextPageToken?: string;
}

@Component({
  selector: 'leaderboard-panel',
  templateUrl: './leaderboard-panel.component.html',
  styleUrls: ['./leaderboard-panel.component.scss'],
  standalone: false,
})
export class LeaderboardPanelComponent implements OnInit, OnDestroy {
  protected readonly scopes: { value: LeaderboardScope; label: string }[] = [
    { value: 'global', label: 'All modes' },
    { value: 'bio-ball', label: 'Bio Ball' },
    { value: 'career-path', label: 'Career Path' },
    { value: 'nickname-streak', label: 'Nickname Streak' },
  ];

  protected scope: LeaderboardScope = 'global';
  protected entries: LeaderboardEntryRow[] = [];
  protected loading = false;
  protected loadingMore = false;
  protected errorMessage: string | null = null;
  protected nextPageToken: string | null = null;
  private destroy$ = new Subject<void>();

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    this.loadFirstPage();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected onScopeSelect(value: string): void {
    const v = value as LeaderboardScope;
    if (!v || v === this.scope) {
      return;
    }
    this.scope = v;
    this.nextPageToken = null;
    this.entries = [];
    this.errorMessage = null;
    this.loadFirstPage();
  }

  /** @param {number} rank */
  protected isTopThree(rank: number): boolean {
    return rank >= 1 && rank <= 3;
  }

  /**
   * @param {number} _i
   * @param {LeaderboardEntryRow} row
   */
  protected trackByRank(_i: number, row: LeaderboardEntryRow): string {
    return `${row.rank}-${row.uid}`;
  }

  protected loadMore(): void {
    if (!this.nextPageToken || this.loadingMore) {
      return;
    }
    this.loadingMore = true;
    this.errorMessage = null;
    const url = this.buildUrl({ pageToken: this.nextPageToken });
    this.http
      .get<LeaderboardApiResponse>(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.entries = [...this.entries, ...res.entries];
          this.nextPageToken = res.nextPageToken ?? null;
          this.loadingMore = false;
        },
        error: (err: HttpErrorResponse) => {
          this.loadingMore = false;
          this.errorMessage = this.mapError(err);
        },
      });
  }

  private loadFirstPage(): void {
    this.loading = true;
    this.errorMessage = null;
    this.entries = [];
    this.nextPageToken = null;
    const url = this.buildUrl({});
    this.http
      .get<LeaderboardApiResponse>(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.entries = res.entries;
          this.nextPageToken = res.nextPageToken ?? null;
          this.loading = false;
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.errorMessage = this.mapError(err);
        },
      });
  }

  private buildUrl(opts: { pageToken?: string }): string {
    const base = environment.baseUrl || '';
    const qs = new URLSearchParams();
    qs.set('scope', this.scope);
    qs.set('pageSize', String(LEADERBOARD_DEFAULT_PAGE_SIZE));
    if (opts.pageToken) {
      qs.set('pageToken', opts.pageToken);
    }
    return `${base}/api/v1/leaderboards?${qs.toString()}`;
  }

  private mapError(err: HttpErrorResponse): string {
    if (err.status === 503) {
      return 'Leaderboard is unavailable (server not configured).';
    }
    if (err.status === 0) {
      return 'Could not reach the server. Is the API running?';
    }
    const body = err.error as { error?: { message?: string } } | null;
    const msg = body?.error?.message;
    return typeof msg === 'string' ? msg : 'Could not load leaderboard.';
  }
}
