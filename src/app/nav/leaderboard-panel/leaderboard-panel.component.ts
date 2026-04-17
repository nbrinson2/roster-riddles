import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { doc, onSnapshot, Timestamp, type Unsubscribe } from 'firebase/firestore';
import { EMPTY, Subject, timer } from 'rxjs';
import { catchError, filter, switchMap, takeUntil } from 'rxjs/operators';
import { getConfiguredFirestore } from 'src/app/config/firestore-instance';
import { environment } from 'src/environment';
import type { LeaderboardSnapshotDocument } from 'src/app/shared/models/leaderboard-snapshot.model';
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
  /** ISO 8601 from precomputed snapshot doc `generatedAt` (Story E2), if any. */
  snapshotGeneratedAt?: string | null;
  nextPageToken?: string;
}

@Component({
  selector: 'leaderboard-panel',
  templateUrl: './leaderboard-panel.component.html',
  styleUrls: ['./leaderboard-panel.component.scss'],
  standalone: false,
})
export class LeaderboardPanelComponent implements OnInit, OnDestroy {
  /** When true, data comes only from precomputed B2 docs (not live `stats/summary` via API). */
  protected readonly useSnapshotMode =
    environment.leaderboardUseFirestoreSnapshot;

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
  /** B2 snapshot mode — from `generatedAt` on the precomputed doc. */
  protected lastUpdatedLabel: string | null = null;
  private destroy$ = new Subject<void>();
  private snapshotUnsub: Unsubscribe | null = null;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (environment.leaderboardUseFirestoreSnapshot) {
      this.attachSnapshotListener();
    } else {
      this.loadFirstPage();
      this.scheduleHttpPoll();
    }
  }

  ngOnDestroy(): void {
    this.detachSnapshotListener();
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
    this.lastUpdatedLabel = null;
    if (environment.leaderboardUseFirestoreSnapshot) {
      this.attachSnapshotListener();
    } else {
      this.loadFirstPage();
    }
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
    if (environment.leaderboardUseFirestoreSnapshot) {
      return;
    }
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
          this.applySnapshotGeneratedAtFromApi(res);
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
    this.lastUpdatedLabel = null;
    const url = this.buildUrl({});
    this.http
      .get<LeaderboardApiResponse>(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.entries = res.entries;
          this.nextPageToken = res.nextPageToken ?? null;
          this.applySnapshotGeneratedAtFromApi(res);
          this.loading = false;
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.errorMessage = this.mapError(err);
        },
      });
  }

  private scheduleHttpPoll(): void {
    const ms = environment.leaderboardPollIntervalMs ?? 0;
    if (ms <= 0) {
      return;
    }
    timer(ms, ms)
      .pipe(
        takeUntil(this.destroy$),
        filter(
          () =>
            !environment.leaderboardUseFirestoreSnapshot &&
            !this.loading &&
            !this.loadingMore &&
            this.nextPageToken == null,
        ),
        switchMap(() =>
          this.http.get<LeaderboardApiResponse>(this.buildUrl({})).pipe(
            catchError(() => EMPTY),
          ),
        ),
      )
      .subscribe((res) => {
        this.entries = res.entries;
        this.nextPageToken = res.nextPageToken ?? null;
        this.applySnapshotGeneratedAtFromApi(res);
      });
  }

  private applySnapshotGeneratedAtFromApi(res: LeaderboardApiResponse): void {
    if (environment.leaderboardUseFirestoreSnapshot) {
      return;
    }
    const iso = res.snapshotGeneratedAt;
    if (typeof iso !== 'string' || !iso.trim()) {
      this.lastUpdatedLabel = null;
      return;
    }
    const d = new Date(iso);
    this.lastUpdatedLabel = Number.isNaN(d.getTime())
      ? null
      : d.toLocaleString();
  }

  private attachSnapshotListener(): void {
    this.detachSnapshotListener();
    this.loading = true;
    this.errorMessage = null;
    this.entries = [];
    this.nextPageToken = null;
    this.lastUpdatedLabel = null;

    const db = getConfiguredFirestore();
    const d = doc(db, 'leaderboards', 'snapshots', 'boards', this.scope);
    this.snapshotUnsub = onSnapshot(
      d,
      (snap) => {
        this.loading = false;
        if (!snap.exists()) {
          this.entries = [];
          this.lastUpdatedLabel = null;
          return;
        }
        const raw = snap.data() as LeaderboardSnapshotDocument;
        this.entries = this.mapSnapshotToRows(raw, this.scope);
        this.lastUpdatedLabel = this.formatGeneratedAt(raw.generatedAt);
      },
      (err: Error) => {
        this.loading = false;
        this.errorMessage =
          typeof err?.message === 'string'
            ? err.message
            : 'Could not load leaderboard.';
      },
    );
  }

  private detachSnapshotListener(): void {
    if (this.snapshotUnsub) {
      this.snapshotUnsub();
      this.snapshotUnsub = null;
    }
  }

  private mapSnapshotToRows(
    data: LeaderboardSnapshotDocument,
    scope: LeaderboardScope,
  ): LeaderboardEntryRow[] {
    const list = data.entries;
    if (!Array.isArray(list) || list.length === 0) {
      return [];
    }
    const board = (data.boardId as LeaderboardScope) ?? scope;
    return list.map((e) => ({
      rank: e.rank,
      uid: e.uid,
      score: e.score,
      scope: board,
      tieBreakKey: e.tieBreakKey,
      displayName: e.displayName,
    }));
  }

  private formatGeneratedAt(value: unknown): string | null {
    if (value == null) {
      return null;
    }
    if (value instanceof Timestamp) {
      return value.toDate().toLocaleString();
    }
    return null;
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
