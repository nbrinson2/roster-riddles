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
import type {
  ContestDryRunPayoutsDocument,
  ContestPayoutLine,
} from 'src/app/shared/models/contest-payouts-dry-run.model';
import { environment } from 'src/environment';
import { WeeklyContestSlateService } from 'src/app/shared/services/weekly-contest-slate.service';
import {
  getPlaceAmountLines,
  getWinnerGetsPhrase,
} from './contest-payout-display';
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

  /** Contest id with expanded details (rules, join, payout). */
  protected expandedContestId: string | null = null;
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
  private payoutUnsub: Unsubscribe | null = null;
  private loadedOpen = false;
  private loadedScheduled = false;
  private loadedPaid = false;
  private openSnap: QuerySnapshot | null = null;
  private scheduledSnap: QuerySnapshot | null = null;
  private paidSnap: QuerySnapshot | null = null;

  /** When status is `paid`, snapshot of `payouts/dryRun` (Story F1). */
  protected payoutLoading = false;
  protected payoutWinnerText: string | null = null;
  protected payoutOtherLines: string[] = [];

  constructor(
    private readonly auth: AuthService,
    private readonly http: HttpClient,
    private readonly weeklyContestSlate: WeeklyContestSlateService,
  ) {}

  ngOnInit(): void {
    this.auth.user$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.loggedIn = !!user;
      this.uid = user?.uid ?? null;
      if (!user) {
        this.detachListListeners();
        this.detachEntryListener();
        this.detachPayoutListener();
        this.rows = [];
        this.loading = false;
        this.listError = null;
        this.expandedContestId = null;
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
    this.detachPayoutListener();
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

  /** Row for join / snapshot listeners (expanded card). */
  protected get selected(): ContestListRow | null {
    if (!this.expandedContestId) {
      return null;
    }
    return (
      this.rows.find((r) => r.contestId === this.expandedContestId) ?? null
    );
  }

  protected toggleExpand(row: ContestListRow): void {
    if (this.expandedContestId === row.contestId) {
      this.expandedContestId = null;
      this.rulesCheckbox = false;
      this.joinError = null;
      this.joinSuccess = null;
      this.detachEntryListener();
      this.detachPayoutListener();
      this.entryRulesVersion = null;
      return;
    }
    this.expandedContestId = row.contestId;
    this.rulesCheckbox = false;
    this.joinError = null;
    this.joinSuccess = null;
    this.refreshEntryListener();
    this.refreshPayoutListener();
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
          if (res.contest.gameMode === CONTEST_GAME_MODE_BIO_BALL) {
            this.weeklyContestSlate.refreshSlateAfterEntryChange();
          }
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
    if (err.status === 409 && code === 'already_in_open_contest') {
      return typeof msg === 'string'
        ? msg
        : 'You are already in another open contest for this game type. Finish or wait until it closes before joining a different one.';
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
    this.loadedPaid = false;
    this.openSnap = null;
    this.scheduledSnap = null;
    this.paidSnap = null;

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
    const qPaid = query(
      collection(db, 'contests'),
      where('status', '==', 'paid'),
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
      onSnapshot(
        qPaid,
        (snap) => {
          this.paidSnap = snap;
          this.loadedPaid = true;
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
    this.loading = !(this.loadedOpen && this.loadedScheduled && this.loadedPaid);
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
    ingest(this.paidSnap);

    const prevExpandedId = this.expandedContestId;
    const prevExpandedStatus = prevExpandedId
      ? this.rows.find((r) => r.contestId === prevExpandedId)?.status ?? null
      : null;

    this.rows = Array.from(byId.values())
      .filter((r) => r.gameMode === CONTEST_GAME_MODE_BIO_BALL)
      .sort((a, b) => this.sortRows(a, b));

    if (prevExpandedId) {
      const updated = byId.get(prevExpandedId);
      if (!updated) {
        this.expandedContestId = null;
        this.rulesCheckbox = false;
        this.joinError = null;
        this.joinSuccess = null;
        this.entryRulesVersion = null;
        this.detachEntryListener();
        this.detachPayoutListener();
      } else if (updated.status !== prevExpandedStatus) {
        this.refreshEntryListener();
        this.refreshPayoutListener();
      }
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
    if (a.status === 'paid' && b.status === 'paid') {
      return b.windowEnd.getTime() - a.windowEnd.getTime();
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
    const rawTitle =
      typeof d.title === 'string' ? d.title.trim() : '';
    const title =
      rawTitle && rawTitle !== contestId ? rawTitle : 'Bio Ball';

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
    const id = this.expandedContestId;
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

  private refreshPayoutListener(): void {
    this.detachPayoutListener();
    const row = this.selected;
    const id = this.expandedContestId;
    if (!row || row.status !== 'paid' || !this.uid || !id) {
      this.payoutLoading = false;
      this.payoutWinnerText = null;
      this.payoutOtherLines = [];
      return;
    }

    this.payoutLoading = true;
    this.payoutWinnerText = null;
    this.payoutOtherLines = [];

    const db = getConfiguredFirestore();
    const ref = doc(db, 'contests', id, 'payouts', 'dryRun');
    this.payoutUnsub = onSnapshot(
      ref,
      (snap) => {
        this.payoutLoading = false;
        if (!snap.exists()) {
          this.payoutWinnerText = null;
          this.payoutOtherLines = [];
          return;
        }
        const parsed = this.parseDryRunPayout(snap.data());
        this.payoutWinnerText = getWinnerGetsPhrase(parsed);
        this.payoutOtherLines = getPlaceAmountLines(parsed);
      },
      () => {
        this.payoutLoading = false;
        this.payoutWinnerText = null;
        this.payoutOtherLines = [];
      },
    );
  }

  private detachPayoutListener(): void {
    if (this.payoutUnsub) {
      this.payoutUnsub();
      this.payoutUnsub = null;
    }
  }

  private parseDryRunPayout(raw: unknown): ContestDryRunPayoutsDocument | null {
    if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
      return null;
    }
    const o = raw as Record<string, unknown>;
    const linesRaw = o['lines'];
    if (!Array.isArray(linesRaw)) {
      return null;
    }
    const lines: ContestPayoutLine[] = [];
    for (const item of linesRaw) {
      if (item == null || typeof item !== 'object' || Array.isArray(item)) {
        continue;
      }
      const L = item as Record<string, unknown>;
      const uid = typeof L['uid'] === 'string' ? L['uid'] : '';
      const rank =
        typeof L['rank'] === 'number' && Number.isFinite(L['rank'])
          ? L['rank']
          : typeof L['place'] === 'number' && Number.isFinite(L['place'])
            ? L['place']
            : NaN;
      const amountCents =
        typeof L['amountCents'] === 'number' &&
        Number.isFinite(L['amountCents'])
          ? L['amountCents']
          : NaN;
      if (!uid || !Number.isFinite(rank) || !Number.isFinite(amountCents)) {
        continue;
      }
      lines.push({ uid, rank, amountCents });
    }

    return {
      schemaVersion:
        typeof o['schemaVersion'] === 'number' ? o['schemaVersion'] : 0,
      notRealMoney: o['notRealMoney'] === true,
      currency: typeof o['currency'] === 'string' ? o['currency'] : '',
      lines,
      finalizedAt: o['finalizedAt'],
      payoutJobId:
        typeof o['payoutJobId'] === 'string' ? o['payoutJobId'] : undefined,
    };
  }
}
