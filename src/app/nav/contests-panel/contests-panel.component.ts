import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  type QuerySnapshot,
  Timestamp,
  type Unsubscribe,
  where,
} from 'firebase/firestore';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/auth/auth.service';
import { getConfiguredFirestore } from 'src/app/config/firestore-instance';
import {
  CONTEST_GAME_MODE_BIO_BALL,
  type ContestDocument,
  type ContestStatus,
} from 'src/app/shared/models/contest.model';
import { environment } from 'src/environment';
import {
  CONTEST_DRY_RUN_PAYOUT_COPY,
  getContestRulesNarrative,
} from './contest-rules-copy';

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
}

interface ContestJoinResponse {
  idempotentReplay: boolean;
  entry: {
    schemaVersion: number;
    contestId: string;
    uid: string;
    rulesAcceptedVersion: number | string;
    joinedAt: string;
    displayNameSnapshot?: string | null;
    clientRequestId?: string;
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

@Component({
  selector: 'contests-panel',
  templateUrl: './contests-panel.component.html',
  styleUrls: ['./contests-panel.component.scss'],
  standalone: false,
})
export class ContestsPanelComponent implements OnInit, OnDestroy {
  @Output() readonly requestSignIn = new EventEmitter<void>();

  protected readonly dryRunCopy = CONTEST_DRY_RUN_PAYOUT_COPY;

  protected loggedIn = false;
  protected loading = true;
  protected listError: string | null = null;
  protected rows: ContestListRow[] = [];

  protected selected: ContestListRow | null = null;
  protected rulesCheckbox = false;
  protected joinSubmitting = false;
  protected joinError: string | null = null;
  protected joinSuccess: string | null = null;

  /** Own entry rules version when doc exists (Firestore). */
  protected entryRulesVersion: number | string | null = null;

  private uid: string | null = null;
  private destroy$ = new Subject<void>();
  private listUnsubs: Unsubscribe[] = [];
  private entryUnsub: Unsubscribe | null = null;
  private loadedOpen = false;
  private loadedScheduled = false;
  private openSnap: QuerySnapshot | null = null;
  private scheduledSnap: QuerySnapshot | null = null;

  constructor(
    private readonly auth: AuthService,
    private readonly http: HttpClient,
  ) {}

  ngOnInit(): void {
    this.auth.user$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.loggedIn = !!user;
      this.uid = user?.uid ?? null;
      if (!user) {
        this.detachListListeners();
        this.detachEntryListener();
        this.rows = [];
        this.loading = false;
        this.listError = null;
        this.selected = null;
        this.entryRulesVersion = null;
        return;
      }
      this.attachListListeners();
      this.refreshEntryListener();
    });
  }

  ngOnDestroy(): void {
    this.detachListListeners();
    this.detachEntryListener();
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected formatWindowLocal(start: Date, end: Date): string {
    const opts: Intl.DateTimeFormatOptions = {
      dateStyle: 'medium',
      timeStyle: 'short',
    };
    return `${start.toLocaleString(undefined, opts)} — ${end.toLocaleString(undefined, opts)}`;
  }

  protected statusLabel(status: ContestStatus): string {
    switch (status) {
      case 'open':
        return 'Open';
      case 'scheduled':
        return 'Upcoming';
      case 'scoring':
        return 'Scoring';
      case 'paid':
        return 'Complete';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }

  protected ruleParagraphs(version: number | string): string[] {
    return getContestRulesNarrative(version)
      .split('\n\n')
      .map((s) => s.trim())
      .filter(Boolean);
  }

  protected selectRow(row: ContestListRow): void {
    this.selected = row;
    this.rulesCheckbox = false;
    this.joinError = null;
    this.joinSuccess = null;
    this.refreshEntryListener();
  }

  protected clearSelection(): void {
    this.selected = null;
    this.rulesCheckbox = false;
    this.joinError = null;
    this.joinSuccess = null;
    this.detachEntryListener();
    this.entryRulesVersion = null;
  }

  protected canAttemptJoin(row: ContestListRow): boolean {
    if (row.status !== 'open') {
      return false;
    }
    const now = Date.now();
    return (
      now >= row.windowStart.getTime() && now < row.windowEnd.getTime()
    );
  }

  protected joinDisabledReason(row: ContestListRow): string | null {
    if (row.status === 'scheduled') {
      return 'This contest is not open for entry yet.';
    }
    if (row.status !== 'open') {
      return 'Join is not available for this contest.';
    }
    const now = Date.now();
    if (now < row.windowStart.getTime()) {
      return 'The entry window has not started.';
    }
    if (now >= row.windowEnd.getTime()) {
      return 'The entry window has ended.';
    }
    return null;
  }

  protected onRequestSignIn(): void {
    this.requestSignIn.emit();
  }

  protected submitJoin(): void {
    const row = this.selected;
    if (!row || !this.uid || !this.rulesCheckbox || this.joinSubmitting) {
      return;
    }
    if (!this.canAttemptJoin(row)) {
      this.joinError =
        this.joinDisabledReason(row) ?? 'Join is not available right now.';
      return;
    }

    this.joinSubmitting = true;
    this.joinError = null;
    this.joinSuccess = null;

    const base = environment.baseUrl || '';
    const url = `${base}/api/v1/contests/${encodeURIComponent(row.contestId)}/join`;
    const body = { clientRequestId: crypto.randomUUID() };

    this.http
      .post<ContestJoinResponse>(url, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.joinSubmitting = false;
          const accepted = res.entry.rulesAcceptedVersion;
          const contestRules = res.contest.rulesVersion;
          this.joinSuccess = res.idempotentReplay
            ? `You are already entered. Rules accepted version ${String(accepted)} (matches contest rules ${String(contestRules)}).`
            : `You are in. Rules accepted version ${String(accepted)} (stored on your entry; contest rules ${String(contestRules)}).`;
          this.entryRulesVersion = accepted;
        },
        error: (err: HttpErrorResponse) => {
          this.joinSubmitting = false;
          this.joinError = this.mapJoinError(err);
        },
      });
  }

  private mapJoinError(err: HttpErrorResponse): string {
    const body = err.error as { error?: { code?: string; message?: string } };
    const code = body?.error?.code;
    const msg = body?.error?.message;
    if (err.status === 401) {
      return 'Sign in again, then retry.';
    }
    if (err.status === 429) {
      return 'Too many join attempts. Wait a moment and try again.';
    }
    if (err.status === 503) {
      return 'Contest join is unavailable (server not configured).';
    }
    if (err.status === 0) {
      return 'Could not reach the server. Is the API running?';
    }
    switch (code) {
      case 'join_window_closed':
        return 'The join window is closed.';
      case 'contest_not_open':
        return 'This contest is not open for new entries.';
      case 'wrong_game_mode':
        return 'This contest is not available for Bio Ball in this build.';
      case 'contest_not_found':
        return 'That contest no longer exists.';
      case 'validation_error':
        return typeof msg === 'string' ? msg : 'Invalid request.';
      case 'rate_limited':
        return 'Too many join attempts. Try again shortly.';
      default:
        return typeof msg === 'string' ? msg : 'Could not join this contest.';
    }
  }

  private attachListListeners(): void {
    this.detachListListeners();
    this.loading = true;
    this.listError = null;
    this.loadedOpen = false;
    this.loadedScheduled = false;
    this.openSnap = null;
    this.scheduledSnap = null;

    const db = getConfiguredFirestore();
    const qOpen = query(
      collection(db, 'contests'),
      where('status', '==', 'open'),
      orderBy('windowStart', 'desc'),
      limit(40),
    );
    /** No `orderBy` — composite index for scheduled+windowStart asc is not deployed; we sort client-side. */
    const qScheduled = query(
      collection(db, 'contests'),
      where('status', '==', 'scheduled'),
      limit(40),
    );

    this.listUnsubs.push(
      onSnapshot(
        qOpen,
        (snap) => {
          this.openSnap = snap;
          this.loadedOpen = true;
          this.mergeList();
          this.updateLoadingFlag();
        },
        (e: Error) => this.onListError(e),
      ),
      onSnapshot(
        qScheduled,
        (snap) => {
          this.scheduledSnap = snap;
          this.loadedScheduled = true;
          this.mergeList();
          this.updateLoadingFlag();
        },
        (e: Error) => this.onListError(e),
      ),
    );
  }

  private onListError(err: Error): void {
    this.listError =
      typeof err?.message === 'string'
        ? err.message
        : 'Could not load contests.';
    this.loading = false;
  }

  private updateLoadingFlag(): void {
    this.loading = !(this.loadedOpen && this.loadedScheduled);
  }

  private mergeList(): void {
    const byId = new Map<string, ContestListRow>();

    const ingest = (snap: QuerySnapshot | null) => {
      if (!snap) {
        return;
      }
      snap.forEach((d) => {
        const parsed = this.parseContestDoc(d.id, d.data());
        if (parsed) {
          byId.set(parsed.contestId, parsed);
        }
      });
    };

    ingest(this.openSnap);
    ingest(this.scheduledSnap);

    this.rows = Array.from(byId.values())
      .filter((r) => r.gameMode === CONTEST_GAME_MODE_BIO_BALL)
      .sort((a, b) => this.sortRows(a, b));

    if (this.selected) {
      const updated = byId.get(this.selected.contestId);
      this.selected = updated ?? null;
    }
  }

  private sortRows(a: ContestListRow, b: ContestListRow): number {
    const pri = (s: ContestListRow) =>
      s.status === 'open' ? 0 : s.status === 'scheduled' ? 1 : 2;
    const dp = pri(a) - pri(b);
    if (dp !== 0) {
      return dp;
    }
    if (a.status === 'open' && b.status === 'open') {
      return a.windowEnd.getTime() - b.windowEnd.getTime();
    }
    return a.windowStart.getTime() - b.windowStart.getTime();
  }

  private parseContestDoc(
    contestId: string,
    raw: unknown,
  ): ContestListRow | null {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const d = raw as ContestDocument & Record<string, unknown>;
    const status = d.status as ContestStatus;
    const gameMode = typeof d.gameMode === 'string' ? d.gameMode : '';
    const rulesVersion = d.rulesVersion as number | string;
    const leagueGamesN =
      typeof d.leagueGamesN === 'number' && Number.isFinite(d.leagueGamesN)
        ? d.leagueGamesN
        : NaN;
    const title =
      typeof d.title === 'string' && d.title.trim()
        ? d.title.trim()
        : contestId;

    const ws = this.toDate(d.windowStart);
    const we = this.toDate(d.windowEnd);
    if (!ws || !we || !status || Number.isNaN(leagueGamesN)) {
      return null;
    }

    return {
      contestId,
      status,
      gameMode,
      rulesVersion,
      title,
      leagueGamesN,
      windowStart: ws,
      windowEnd: we,
    };
  }

  private toDate(value: unknown): Date | null {
    if (value instanceof Timestamp) {
      return value.toDate();
    }
    if (value && typeof value === 'object' && 'toDate' in value) {
      const fn = (value as { toDate?: () => Date }).toDate;
      if (typeof fn === 'function') {
        try {
          return fn.call(value);
        } catch {
          return null;
        }
      }
    }
    return null;
  }

  private detachListListeners(): void {
    for (const u of this.listUnsubs) {
      u();
    }
    this.listUnsubs = [];
  }

  private refreshEntryListener(): void {
    this.detachEntryListener();
    const id = this.selected?.contestId;
    const uid = this.uid;
    if (!id || !uid) {
      this.entryRulesVersion = null;
      return;
    }

    const db = getConfiguredFirestore();
    const ref = doc(db, 'contests', id, 'entries', uid);
    this.entryUnsub = onSnapshot(
      ref,
      (snap) => {
        if (!snap.exists()) {
          this.entryRulesVersion = null;
          return;
        }
        const v = snap.data()['rulesAcceptedVersion'] as number | string | undefined;
        this.entryRulesVersion =
          v === undefined || v === null ? null : v;
      },
      () => {
        this.entryRulesVersion = null;
      },
    );
  }

  private detachEntryListener(): void {
    if (this.entryUnsub) {
      this.entryUnsub();
      this.entryUnsub = null;
    }
  }
}
