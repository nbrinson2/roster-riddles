import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { MatButtonToggleChange } from '@angular/material/button-toggle';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  Timestamp,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { EMPTY, Subject, Subscription, timer } from 'rxjs';
import { catchError, filter, switchMap, takeUntil } from 'rxjs/operators';
import { getConfiguredFirestore } from 'src/app/config/firestore-instance';
import { environment } from 'src/environment';
import type { LeaderboardSnapshotDocument } from 'src/app/shared/models/leaderboard-snapshot.model';
import { CONTEST_GAME_MODE_BIO_BALL } from 'src/app/shared/models/contest.model';
import {
  LEADERBOARD_DEFAULT_PAGE_SIZE,
  LeaderboardEntryRow,
  LeaderboardScope,
} from 'src/app/shared/models/leaderboard-query.model';
import { parseContestFirestoreRow } from '../contests-panel/lib/contests-panel-list.util';
import type { ContestListRow } from '../contests-panel/lib/contests-panel.types';

interface LeaderboardApiResponse {
  schemaVersion: number;
  scope: LeaderboardScope;
  pageSize: number;
  entries: LeaderboardEntryRow[];
  /** ISO 8601 from precomputed snapshot doc `generatedAt` (Story E2), if any. */
  snapshotGeneratedAt?: string | null;
  /** Story F2 — public listing omits unverified Auth emails when true. */
  listingPolicy?: { emailVerifiedRequired?: boolean };
  nextPageToken?: string;
}

/** `GET /api/v1/contests/:contestId/leaderboard` — aligns with `results/final` rows. */
interface ContestLiveStandingRow {
  rank: number;
  uid: string;
  wins: number;
  gamesPlayed: number;
  losses: number;
  abandoned: number;
  displayName: string | null;
  tieBreakKey?: string;
  tier?: string;
}

interface ContestLiveLeaderboardApiResponse {
  schemaVersion: number;
  contestId: string;
  standings: ContestLiveStandingRow[];
  computedAt?: string;
  cache?: { hit?: boolean };
}

/** Phase 0 — leaderboard panel surface (all-time vs weekly contest UX). */
type LeaderboardPanelSurfaceMode = 'alltime' | 'weeklyContest';

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

  /**
   * Phase 0 — weekly-contest segment in this panel (Firestore open contests + placeholder copy).
   * Gated by weekly contests product flag and a separate build flag for rollout.
   */
  protected readonly showWeeklyContestLeaderboardTab =
    environment.weeklyContestsUiEnabled &&
    environment.leaderboardContestTabEnabled;

  protected surfaceMode: LeaderboardPanelSurfaceMode = 'alltime';

  /** `status === 'open'` Bio Ball contests from Firestore (anonymous may read open docs per rules). */
  protected openContestRows: ContestListRow[] = [];
  protected contestListLoading = false;
  protected contestListError: string | null = null;
  protected selectedContestId: string | null = null;

  /** Phase 3 — live standings from `GET /api/v1/contests/:contestId/leaderboard`. */
  protected contestStandingsRows: ContestLiveStandingRow[] = [];
  protected contestStandingsLoading = false;
  protected contestStandingsError: string | null = null;
  protected contestStandingsComputedAtLabel: string | null = null;

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
  /** Story F2 — show “verified email” hint (HTTP from API; snapshot heuristic for production). */
  protected listingEmailVerifiedRequired = false;
  private destroy$ = new Subject<void>();
  private snapshotUnsub: Unsubscribe | null = null;
  private contestListUnsub: Unsubscribe | null = null;
  private contestLivePollSub: Subscription | null = null;
  private contestStandingsRequestSeq = 0;

  constructor(private http: HttpClient) {}

  ngOnInit(): void {
    if (!environment.leaderboardUseFirestoreSnapshot) {
      this.scheduleHttpPoll();
    }
    this.syncAllTimeLeaderboardSubscription();
  }

  ngOnDestroy(): void {
    this.detachSnapshotListener();
    this.stopContestListListener();
    this.stopContestLivePoll();
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Hero subtitle — all-time scope label vs weekly contest (Bio Ball v1). */
  protected get heroSubtitle(): string {
    if (this.surfaceMode === 'weeklyContest') {
      return 'Weekly contest · Bio Ball mini-league (v1)';
    }
    const s = this.scopes.find((x) => x.value === this.scope);
    return s ? `All-time wins · ${s.label}` : 'All-time wins';
  }

  protected onSurfaceModeChange(ev: MatButtonToggleChange): void {
    const value = typeof ev.value === 'string' ? ev.value : '';
    const mode: LeaderboardPanelSurfaceMode =
      value === 'weeklyContest' ? 'weeklyContest' : 'alltime';
    if (mode === this.surfaceMode) {
      return;
    }
    this.surfaceMode = mode;
    this.errorMessage = null;
    if (mode === 'alltime') {
      this.stopContestListListener();
      this.stopContestLivePoll();
      this.openContestRows = [];
      this.contestListError = null;
      this.selectedContestId = null;
      this.contestStandingsRows = [];
      this.contestStandingsError = null;
      this.contestStandingsComputedAtLabel = null;
      this.contestStandingsLoading = false;
      this.syncAllTimeLeaderboardSubscription();
      return;
    }
    this.detachSnapshotListener();
    this.entries = [];
    this.nextPageToken = null;
    this.lastUpdatedLabel = null;
    this.loading = false;
    this.loadingMore = false;
    this.contestStandingsRows = [];
    this.contestStandingsError = null;
    this.contestStandingsComputedAtLabel = null;
    this.stopContestLivePoll();
    this.startContestListListener();
  }

  protected onContestSelect(contestId: string): void {
    if (!contestId || contestId === this.selectedContestId) {
      return;
    }
    this.selectedContestId = contestId;
    this.stopContestLivePoll();
    this.loadContestLiveStandings();
  }

  protected get selectedContest(): ContestListRow | null {
    const id = this.selectedContestId;
    if (!id) {
      return null;
    }
    return this.openContestRows.find((r) => r.contestId === id) ?? null;
  }

  protected formatContestWindowEnd(row: ContestListRow): string {
    return row.windowEnd.toLocaleString();
  }

  protected contestOptionLabel(row: ContestListRow): string {
    const end = this.formatContestWindowEnd(row);
    return `${row.title} · ends ${end}`;
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
    this.listingEmailVerifiedRequired = false;
    if (this.surfaceMode !== 'alltime') {
      return;
    }
    this.syncAllTimeLeaderboardSubscription();
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
    if (
      this.surfaceMode !== 'alltime' ||
      environment.leaderboardUseFirestoreSnapshot
    ) {
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
          if (this.surfaceMode !== 'alltime') {
            return;
          }
          this.entries = [...this.entries, ...res.entries];
          this.nextPageToken = res.nextPageToken ?? null;
          this.applySnapshotGeneratedAtFromApi(res);
          this.applyListingPolicyFromApi(res);
          this.loadingMore = false;
        },
        error: (err: HttpErrorResponse) => {
          if (this.surfaceMode !== 'alltime') {
            return;
          }
          this.loadingMore = false;
          this.errorMessage = this.mapError(err);
        },
      });
  }

  private loadFirstPage(): void {
    if (this.surfaceMode !== 'alltime') {
      return;
    }
    this.loading = true;
    this.errorMessage = null;
    this.entries = [];
    this.nextPageToken = null;
    this.lastUpdatedLabel = null;
    this.listingEmailVerifiedRequired = false;
    const url = this.buildUrl({});
    this.http
      .get<LeaderboardApiResponse>(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (this.surfaceMode !== 'alltime') {
            return;
          }
          this.entries = res.entries;
          this.nextPageToken = res.nextPageToken ?? null;
          this.applySnapshotGeneratedAtFromApi(res);
          this.applyListingPolicyFromApi(res);
          this.loading = false;
        },
        error: (err: HttpErrorResponse) => {
          if (this.surfaceMode !== 'alltime') {
            return;
          }
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
            this.surfaceMode === 'alltime' &&
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
        if (this.surfaceMode !== 'alltime') {
          return;
        }
        this.entries = res.entries;
        this.nextPageToken = res.nextPageToken ?? null;
        this.applySnapshotGeneratedAtFromApi(res);
        this.applyListingPolicyFromApi(res);
      });
  }

  private applyListingPolicyFromApi(res: LeaderboardApiResponse): void {
    this.listingEmailVerifiedRequired =
      res.listingPolicy?.emailVerifiedRequired === true;
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
    if (this.surfaceMode !== 'alltime') {
      return;
    }
    this.detachSnapshotListener();
    this.loading = true;
    this.errorMessage = null;
    this.entries = [];
    this.nextPageToken = null;
    this.lastUpdatedLabel = null;
    this.listingEmailVerifiedRequired =
      environment.deployment === 'production';

    const db = getConfiguredFirestore();
    const d = doc(db, 'leaderboards', 'snapshots', 'boards', this.scope);
    this.snapshotUnsub = onSnapshot(
      d,
      (snap) => {
        if (this.surfaceMode !== 'alltime') {
          return;
        }
        this.loading = false;
        if (!snap.exists()) {
          this.entries = [];
          this.lastUpdatedLabel = null;
          this.listingEmailVerifiedRequired =
            environment.deployment === 'production';
          return;
        }
        const raw = snap.data() as LeaderboardSnapshotDocument;
        this.entries = this.mapSnapshotToRows(raw, this.scope);
        this.lastUpdatedLabel = this.formatGeneratedAt(raw.generatedAt);
      },
      (err: Error) => {
        if (this.surfaceMode !== 'alltime') {
          return;
        }
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

  /**
   * Loads or re-subscribes to the all-time board only (HTTP or B2 snapshot).
   */
  private syncAllTimeLeaderboardSubscription(): void {
    if (this.surfaceMode !== 'alltime') {
      return;
    }
    if (environment.leaderboardUseFirestoreSnapshot) {
      this.attachSnapshotListener();
    } else {
      this.loadFirstPage();
    }
  }

  /**
   * Open Bio Ball contests (`status === 'open'`). Firestore matches B1 rules
   * (signed-out clients may still read open contest docs).
   */
  private startContestListListener(): void {
    this.stopContestListListener();
    this.contestListLoading = true;
    this.contestListError = null;
    this.openContestRows = [];
    this.selectedContestId = null;

    const db = getConfiguredFirestore();
    const qOpen = query(
      collection(db, 'contests'),
      where('status', '==', 'open'),
      orderBy('windowStart', 'desc'),
      limit(25),
    );

    this.contestListUnsub = onSnapshot(
      qOpen,
      (snap) => {
        this.contestListLoading = false;
        const previousSelected = this.selectedContestId;
        const rows: ContestListRow[] = [];
        snap.forEach((d) => {
          const parsed = parseContestFirestoreRow(d.id, d.data());
          if (
            parsed &&
            parsed.status === 'open' &&
            parsed.gameMode === CONTEST_GAME_MODE_BIO_BALL
          ) {
            rows.push(parsed);
          }
        });
        rows.sort(
          (a, b) => a.windowEnd.getTime() - b.windowEnd.getTime(),
        );
        if (rows.length === 0) {
          this.openContestRows = [];
          this.selectedContestId = null;
          this.stopContestLivePoll();
          this.contestStandingsRows = [];
          this.contestStandingsError = null;
          this.contestStandingsComputedAtLabel = null;
          this.contestStandingsLoading = false;
          return;
        }
        this.openContestRows = rows;
        if (
          !this.selectedContestId ||
          !rows.some((r) => r.contestId === this.selectedContestId)
        ) {
          this.selectedContestId = rows[0]?.contestId ?? null;
        }
        if (this.selectedContestId !== previousSelected) {
          this.stopContestLivePoll();
          this.loadContestLiveStandings();
        }
      },
      (err: Error) => {
        this.contestListLoading = false;
        this.contestListError =
          typeof err?.message === 'string'
            ? err.message
            : 'Could not load contests.';
      },
    );
  }

  private stopContestListListener(): void {
    if (this.contestListUnsub) {
      this.contestListUnsub();
      this.contestListUnsub = null;
    }
  }

  /**
   * @param {number} _i
   * @param {ContestListRow} row
   */
  protected trackByContestId(_i: number, row: ContestListRow): string {
    return row.contestId;
  }

  /**
   * @param {number} _i
   * @param {ContestLiveStandingRow} row
   */
  protected trackByContestStanding(_i: number, row: ContestLiveStandingRow): string {
    return `${row.rank}-${row.uid}`;
  }

  protected formatContestTier(tier: string | undefined): string {
    if (tier === 'full') {
      return 'Full';
    }
    if (tier === 'partial') {
      return 'Partial';
    }
    return tier ? String(tier) : '—';
  }

  /** Shown under the contest table when polling is enabled. */
  protected get contestLivePollHint(): string | null {
    const ms = environment.contestLiveLeaderboardPollIntervalMs ?? 0;
    if (ms <= 0) {
      return null;
    }
    const sec = Math.max(1, Math.round(ms / 1000));
    return `Standings refresh about every ${sec}s while this tab is open.`;
  }

  /**
   * @param {{ silent?: boolean }} [opts]
   */
  private loadContestLiveStandings(opts?: { silent?: boolean }): void {
    const silent = opts?.silent === true;
    const id = this.selectedContestId;
    if (!id || this.surfaceMode !== 'weeklyContest') {
      return;
    }
    const seq = ++this.contestStandingsRequestSeq;
    if (!silent) {
      this.contestStandingsLoading = true;
      this.contestStandingsError = null;
    }
    const url = this.buildContestLiveStandingsUrl(id);
    this.http
      .get<ContestLiveLeaderboardApiResponse>(url)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          if (
            seq !== this.contestStandingsRequestSeq ||
            this.surfaceMode !== 'weeklyContest'
          ) {
            return;
          }
          const rows = Array.isArray(res.standings) ? res.standings : [];
          this.contestStandingsRows = rows;
          this.contestStandingsError = null;
          this.contestStandingsComputedAtLabel = this.formatComputedAtLabel(
            res.computedAt,
          );
          if (!silent) {
            this.contestStandingsLoading = false;
            this.startContestLivePoll();
          }
        },
        error: (err: HttpErrorResponse) => {
          if (
            seq !== this.contestStandingsRequestSeq ||
            this.surfaceMode !== 'weeklyContest'
          ) {
            return;
          }
          if (!silent) {
            this.contestStandingsLoading = false;
            this.contestStandingsError = this.mapContestLiveStandingsError(err);
            this.contestStandingsRows = [];
            this.contestStandingsComputedAtLabel = null;
          }
        },
      });
  }

  private formatComputedAtLabel(iso: string | undefined): string | null {
    if (typeof iso !== 'string' || !iso.trim()) {
      return null;
    }
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleString();
  }

  private buildContestLiveStandingsUrl(contestId: string): string {
    const base = environment.baseUrl || '';
    return `${base}/api/v1/contests/${encodeURIComponent(contestId)}/leaderboard`;
  }

  private mapContestLiveStandingsError(err: HttpErrorResponse): string {
    if (err.status === 0) {
      return 'Could not reach the server. Is the API running?';
    }
    const body = err.error as
      | { error?: { code?: string; message?: string } }
      | null;
    const code = body?.error?.code;
    const msg = body?.error?.message;
    if (typeof msg === 'string' && msg.trim()) {
      return msg;
    }
    if (code === 'contest_not_open') {
      return 'This contest is no longer open. Try another contest or check final results.';
    }
    if (code === 'contest_not_found') {
      return 'Contest not found.';
    }
    if (code === 'rate_limited') {
      return 'Too many requests. Try again shortly.';
    }
    if (err.status === 503) {
      return 'Server is not configured for this request.';
    }
    return 'Could not load contest standings.';
  }

  private stopContestLivePoll(): void {
    if (this.contestLivePollSub) {
      this.contestLivePollSub.unsubscribe();
      this.contestLivePollSub = null;
    }
  }

  private startContestLivePoll(): void {
    this.stopContestLivePoll();
    const ms = environment.contestLiveLeaderboardPollIntervalMs ?? 0;
    if (ms <= 0) {
      return;
    }
    if (this.surfaceMode !== 'weeklyContest' || !this.selectedContestId) {
      return;
    }
    this.contestLivePollSub = timer(ms, ms)
      .pipe(
        takeUntil(this.destroy$),
        filter(
          () =>
            this.surfaceMode === 'weeklyContest' &&
            this.selectedContestId != null,
        ),
      )
      .subscribe(() => this.loadContestLiveStandings({ silent: true }));
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
