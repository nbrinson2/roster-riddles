import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
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
import { filter, takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/auth/auth.service';
import { getConfiguredFirestore } from 'src/app/config/firestore-instance';
import {
  CONTEST_GAME_MODE_BIO_BALL,
  type ContestDocument,
  type ContestStatus,
} from 'src/app/shared/models/contest.model';
import type { ContestEntryPaymentStatus } from 'src/app/shared/models/contest-entry.model';
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
  buildContestScheduleLine,
  formatPayoutUsdLabel,
} from 'src/app/shared/contest/contest-value-prop';
import {
  CONTEST_DRY_RUN_PAYOUT_COPY,
  CONTEST_FULL_RULES_HREF,
  getContestEligibilityBullets,
  getContestRulesNarrative,
  getContestRulesShortBullets,
} from './contest-rules-copy';
import {
  isPlayWindowLockSoon,
  pipelineCaption,
  pipelineCurrentIndex,
  pipelineLabels,
  primaryCountdownLine,
} from './contest-status-ui';
import {
  CONTEST_HERO_TAGLINE,
  type PaidDelightView,
  openEnteredEngagementLine,
  paidResultDelight,
  scheduledWarmupLine,
} from './contest-engagement-copy';
import {
  type ParsedFinalResultsView,
  formatOrdinalRank,
  formatYourPlaceCardLine,
  humanizeTiePolicyRef,
  initialLoadingResultsView,
  parseFinalResultsForViewer,
} from './contest-results-closure';

/** Per-contest entry doc (signed-in user), for “You’re in” and join UI. */
interface ContestEntryRowState {
  loaded: boolean;
  /** Firestore doc exists (`entries/{uid}`). */
  entered: boolean;
  rulesAcceptedVersion: number | string | null;
  /** Phase 5 — when set, drives paid vs free “you’re in” (webhook writes `paid`). */
  paymentStatus?: ContestEntryPaymentStatus | null;
}

/** Max `paid` contests shown (most recent by window end), in addition to all open + scheduled. */
const MAX_COMPLETED_CONTESTS = 5;

/** Dry-run payout snapshot for one contest card. */
interface ContestPayoutView {
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

interface ContestCheckoutSessionResponse {
  schemaVersion: number;
  url: string;
  sessionId: string;
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
  protected readonly fullRulesHref = CONTEST_FULL_RULES_HREF;
  /** P2 — hero subtitle. */
  protected readonly heroTagline = CONTEST_HERO_TAGLINE;
  /** Placeholder count for loading skeleton cards. */
  protected readonly skeletonPlaceholders = [1, 2, 3] as const;

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

  /**
   * After Stripe Checkout success redirect; cleared when entry shows `paymentStatus === paid`
   * (P5-E webhook) or user starts another checkout.
   */
  private checkoutAwaitPaymentContestId: string | null = null;

  /**
   * Rules version for the expanded contest when the user is entered — backed by
   * {@link entryInfoByContestId}.
   */
  protected get entryRulesVersion(): number | string | null {
    const id = this.expandedContestId;
    if (!id) {
      return null;
    }
    const row = this.rows.find((r) => r.contestId === id);
    if (!row || !this.entryCountsAsConfirmedEntrant(row)) {
      return null;
    }
    const e = this.entryInfoByContestId[id];
    return e?.rulesAcceptedVersion ?? null;
  }

  /** P5-D2 — note under dry-run copy when real Stripe Checkout is enabled. */
  protected get realMoneyPaymentsCopy(): string | null {
    return environment.contestsPaymentsEnabled
      ? 'Entry fees use live Stripe Checkout in this environment (test or live keys per server). Payouts shown above may still be dry-run — check contest details.'
      : null;
  }

  /** For countdowns / lock-soon; updated every second while the panel is active. */
  protected nowMs = Date.now();

  /** `contests/{id}/entries/{uid}` listeners for each listed row. */
  protected entryInfoByContestId: Record<string, ContestEntryRowState> = {};
  private entryRowUnsubs = new Map<string, Unsubscribe>();
  private clockId: ReturnType<typeof setInterval> | null = null;

  private uid: string | null = null;
  private destroy$ = new Subject<void>();
  private listUnsubs: Unsubscribe[] = [];
  private loadedOpen = false;
  private loadedScheduled = false;
  private loadedPaid = false;
  private openSnap: QuerySnapshot | null = null;
  private scheduledSnap: QuerySnapshot | null = null;
  private paidSnap: QuerySnapshot | null = null;

  /** Dry-run payout per listed `paid` contest (`payouts/dryRun`, Story F1). */
  protected paidPayoutByContestId: Record<string, ContestPayoutView> = {};
  private paidPayoutUnsubs = new Map<string, Unsubscribe>();

  /** P1 — `results/final` per paid contest (placement + tie copy). */
  protected finalResultsByContestId: Record<string, ParsedFinalResultsView> = {};
  private finalResultsUnsubs = new Map<string, Unsubscribe>();

  constructor(
    private readonly auth: AuthService,
    private readonly http: HttpClient,
    private readonly weeklyContestSlate: WeeklyContestSlateService,
    private readonly router: Router,
  ) {}

  ngOnInit(): void {
    this.router.events
      .pipe(
        filter((e): e is NavigationEnd => e instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe(() => this.processStripeCheckoutReturnQueryParams());

    this.auth.user$.pipe(takeUntil(this.destroy$)).subscribe((user) => {
      this.loggedIn = !!user;
      this.uid = user?.uid ?? null;
      if (!user) {
        this.stopContestClock();
        this.detachListListeners();
        this.detachAllEntryRowListeners();
        this.rows = [];
        this.loading = false;
        this.listError = null;
        this.expandedContestId = null;
        this.entryInfoByContestId = {};
        this.checkoutAwaitPaymentContestId = null;
        return;
      }
      this.attachListListeners();
      this.startContestClock();
      queueMicrotask(() => this.processStripeCheckoutReturnQueryParams());
    });
  }

  ngOnDestroy(): void {
    this.stopContestClock();
    this.detachListListeners();
    this.detachAllEntryRowListeners();
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

  protected rulesShortBullets(version: number | string): string[] {
    return getContestRulesShortBullets(version);
  }

  protected eligibilityBullets(row: ContestListRow): string[] {
    return getContestEligibilityBullets(row.leagueGamesN, row.maxEntries);
  }

  /**
   * First card line: entry / lock / cap only (pool is on the meta line as `PAYOUT:`).
   */
  protected contestScheduleLine(row: ContestListRow): string {
    return buildContestScheduleLine({
      windowEnd: row.windowEnd,
      prizePoolCents: row.prizePoolCents,
      entryFeeCents: row.entryFeeCents,
      maxEntries: row.maxEntries,
    });
  }

  /** Payout row: `PAYOUT:` (when set on doc) · slate size only — no rules or other copy. */
  protected formatNonPaidCardMeta(row: ContestListRow): string {
    const slate = `${row.leagueGamesN} games in slate`;
    if (
      row.prizePoolCents != null &&
      Number.isFinite(row.prizePoolCents) &&
      row.prizePoolCents >= 0
    ) {
      return `${formatPayoutUsdLabel(row.prizePoolCents)} · ${slate}`;
    }
    return slate;
  }

  /** Paid: same — primary payout line + slate only. */
  protected formatPaidCardMeta(
    row: ContestListRow,
    payout: ContestPayoutView,
  ): string {
    const slate = `${row.leagueGamesN} games in slate`;
    if (payout.loading || !payout.winnerText) {
      return slate;
    }
    return `${payout.winnerText} · ${slate}`;
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
      return;
    }
    this.expandedContestId = row.contestId;
    this.rulesCheckbox = false;
    this.joinError = null;
    this.joinSuccess = null;
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
    if (this.contestRequiresPayment(row)) {
      this.joinError =
        'This contest has an entry fee — use Pay & enter to continue.';
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
          this.entryInfoByContestId[row.contestId] = {
            loaded: true,
            entered: true,
            rulesAcceptedVersion: accepted,
          };
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

  /** Contest charges an entry fee and the app is built for paid Checkout (P5-D2). */
  protected contestRequiresPayment(row: ContestListRow): boolean {
    return (
      environment.contestsPaymentsEnabled &&
      typeof row.entryFeeCents === 'number' &&
      Number.isFinite(row.entryFeeCents) &&
      row.entryFeeCents > 0
    );
  }

  /**
   * “You’re in” / rules banner — free contests: doc exists; paid contests: `paymentStatus === paid`
   * (webhook) unless legacy free row.
   */
  protected entryCountsAsConfirmedEntrant(row: ContestListRow): boolean {
    const e = this.entryInfoByContestId[row.contestId];
    if (!e?.loaded || !e.entered) {
      return false;
    }
    if (!this.contestRequiresPayment(row)) {
      return true;
    }
    return e.paymentStatus === 'paid';
  }

  protected formatEntryFeeUsd(row: ContestListRow): string | null {
    if (
      row.entryFeeCents == null ||
      !Number.isFinite(row.entryFeeCents) ||
      row.entryFeeCents <= 0
    ) {
      return null;
    }
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: 'USD',
    }).format(row.entryFeeCents / 100);
  }

  /** Shown after returning from Stripe until webhook sets `paymentStatus: paid` on the entry doc. */
  protected confirmingPayment(row: ContestListRow): boolean {
    return (
      this.checkoutAwaitPaymentContestId === row.contestId &&
      !this.entryCountsAsConfirmedEntrant(row)
    );
  }

  protected submitPaidCheckout(): void {
    const row = this.selected;
    if (!row || !this.uid || !this.rulesCheckbox || this.joinSubmitting) {
      return;
    }
    if (!this.contestRequiresPayment(row)) {
      return;
    }
    if (!this.canAttemptJoin(row)) {
      this.joinError =
        this.joinDisabledReason(row) ?? 'Checkout is not available right now.';
      return;
    }

    this.joinSubmitting = true;
    this.joinError = null;
    this.joinSuccess = null;
    this.checkoutAwaitPaymentContestId = null;

    const base = environment.baseUrl || '';
    const url = `${base}/api/v1/contests/${encodeURIComponent(row.contestId)}/checkout-session`;
    const body = { clientRequestId: crypto.randomUUID() };

    this.http
      .post<ContestCheckoutSessionResponse>(url, body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.joinSubmitting = false;
          const dest = res.url?.trim();
          if (dest) {
            window.location.href = dest;
            return;
          }
          this.joinError = 'Checkout did not return a redirect URL.';
        },
        error: (err: HttpErrorResponse) => {
          this.joinSubmitting = false;
          this.joinError = this.mapCheckoutError(err);
        },
      });
  }

  private mapCheckoutError(err: HttpErrorResponse): string {
    const body = err.error as { error?: { code?: string; message?: string } };
    const code = body?.error?.code;
    const msg = body?.error?.message;
    if (err.status === 401) {
      return 'Sign in again, then retry.';
    }
    if (err.status === 429) {
      return 'Too many checkout attempts. Wait a moment and try again.';
    }
    if (err.status === 503 && code === 'contest_payments_disabled') {
      return typeof msg === 'string'
        ? msg
        : 'Paid entry is not enabled on this server.';
    }
    if (err.status === 503) {
      return typeof msg === 'string'
        ? msg
        : 'Checkout is unavailable (server configuration).';
    }
    if (err.status === 409 && code === 'already_in_open_contest') {
      return typeof msg === 'string'
        ? msg
        : 'You are already in another open contest for this game type.';
    }
    if (err.status === 409 && code === 'already_entered') {
      return typeof msg === 'string'
        ? msg
        : 'You already have an entry (or checkout in progress) for this contest.';
    }
    if (err.status === 502 && code === 'stripe_checkout_failed') {
      return 'Stripe could not start checkout. Try again in a moment.';
    }
    if (err.status === 0) {
      return 'Could not reach the server. Is the API running?';
    }
    switch (code) {
      case 'contest_no_entry_fee':
        return 'This contest has no entry fee — use the free join button instead.';
      case 'join_window_closed':
        return 'The entry window is closed.';
      case 'contest_not_open':
        return 'This contest is not open for new entries.';
      case 'wrong_game_mode':
        return 'This contest is not available for Bio Ball in this build.';
      case 'contest_not_found':
        return 'That contest no longer exists.';
      case 'validation_error':
        return typeof msg === 'string' ? msg : 'Invalid request.';
      default:
        return typeof msg === 'string'
          ? msg
          : 'Could not start checkout for this contest.';
    }
  }

  /**
   * Stripe redirects to `/bio-ball/mlb?checkout=success|cancel&contestId=…` (see server checkout handler).
   */
  private processStripeCheckoutReturnQueryParams(): void {
    let tree;
    try {
      tree = this.router.parseUrl(this.router.url);
    } catch {
      return;
    }
    const checkout = tree.queryParams['checkout'];
    const rawId = tree.queryParams['contestId'];
    if (checkout !== 'success' && checkout !== 'cancel') {
      return;
    }
    if (typeof rawId !== 'string' || !rawId.trim()) {
      return;
    }
    const contestId = decodeURIComponent(rawId.trim());

    const pathOnly = this.router.url.replace(/\?.*/, '');
    void this.router.navigateByUrl(pathOnly, { replaceUrl: true });

    if (!this.loggedIn) {
      return;
    }

    if (checkout === 'success') {
      this.checkoutAwaitPaymentContestId = contestId;
      this.expandedContestId = contestId;
      this.joinError = null;
      this.joinSuccess = null;
      return;
    }

    this.checkoutAwaitPaymentContestId = null;
    this.expandedContestId = contestId;
    this.joinError =
      'Payment was cancelled. You can review the rules and try again when you’re ready.';
    this.joinSuccess = null;
  }

  private parsePaymentStatus(
    raw: unknown,
  ): ContestEntryPaymentStatus | null {
    if (typeof raw !== 'string' || !raw.trim()) {
      return null;
    }
    const s = raw.trim();
    if (
      s === 'free' ||
      s === 'pending' ||
      s === 'paid' ||
      s === 'failed' ||
      s === 'refunded'
    ) {
      return s;
    }
    return null;
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

    const bios = Array.from(byId.values()).filter(
      (r) => r.gameMode === CONTEST_GAME_MODE_BIO_BALL,
    );
    const paidTop = bios
      .filter((r) => r.status === 'paid')
      .sort((a, b) => b.windowEnd.getTime() - a.windowEnd.getTime())
      .slice(0, MAX_COMPLETED_CONTESTS);
    const paidKeep = new Set(paidTop.map((r) => r.contestId));
    const rowsFiltered = bios.filter(
      (r) => r.status !== 'paid' || paidKeep.has(r.contestId),
    );
    this.rows = rowsFiltered.sort((a, b) => this.sortRows(a, b));

    this.syncPaidListExtras();
    this.syncFinalResultsListeners();
    this.syncEntryRowListeners();

    if (prevExpandedId) {
      const updated = byId.get(prevExpandedId);
      if (!updated) {
        this.expandedContestId = null;
        this.rulesCheckbox = false;
        this.joinError = null;
        this.joinSuccess = null;
        if (this.checkoutAwaitPaymentContestId === prevExpandedId) {
          this.checkoutAwaitPaymentContestId = null;
        }
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

    const prizePoolCents = this.parseOptionalNonNegInt(d.prizePoolCents);
    const entryFeeCents = this.parseOptionalNonNegInt(d.entryFeeCents);
    const maxEntries = this.parseOptionalPositiveInt(d.maxEntries);

    return {
      contestId,
      status,
      gameMode,
      rulesVersion,
      title,
      leagueGamesN,
      windowStart: ws,
      windowEnd: we,
      ...(prizePoolCents !== undefined ? { prizePoolCents } : {}),
      ...(entryFeeCents !== undefined ? { entryFeeCents } : {}),
      ...(maxEntries !== undefined ? { maxEntries } : {}),
    };
  }

  private parseOptionalNonNegInt(raw: unknown): number | undefined {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
      return undefined;
    }
    return Math.floor(raw);
  }

  private parseOptionalPositiveInt(raw: unknown): number | undefined {
    if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) {
      return undefined;
    }
    return Math.floor(raw);
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
    this.detachAllPaidPayoutListeners();
    this.detachAllFinalResultsListeners();
  }

  private detachAllEntryRowListeners(): void {
    for (const unsub of this.entryRowUnsubs.values()) {
      unsub();
    }
    this.entryRowUnsubs.clear();
  }

  private syncEntryRowListeners(): void {
    if (!this.uid) {
      return;
    }
    const ids = new Set(this.rows.map((r) => r.contestId));
    for (const [id, unsub] of [...this.entryRowUnsubs.entries()]) {
      if (!ids.has(id)) {
        unsub();
        this.entryRowUnsubs.delete(id);
        delete this.entryInfoByContestId[id];
      }
    }

    const db = getConfiguredFirestore();
    const uid = this.uid;
    for (const id of ids) {
      if (this.entryRowUnsubs.has(id)) {
        continue;
      }
      const ref = doc(db, 'contests', id, 'entries', uid);
      const unsub = onSnapshot(
        ref,
        (snap) => {
          if (!snap.exists()) {
            this.entryInfoByContestId[id] = {
              loaded: true,
              entered: false,
              rulesAcceptedVersion: null,
              paymentStatus: null,
            };
            return;
          }
          const data = snap.data();
          const v = data['rulesAcceptedVersion'] as number | string | undefined;
          const ps = this.parsePaymentStatus(data['paymentStatus']);
          this.entryInfoByContestId[id] = {
            loaded: true,
            entered: true,
            rulesAcceptedVersion:
              v === undefined || v === null ? null : v,
            paymentStatus: ps,
          };
          if (ps === 'paid') {
            if (this.checkoutAwaitPaymentContestId === id) {
              this.checkoutAwaitPaymentContestId = null;
            }
            const row = this.rows.find((r) => r.contestId === id);
            if (row?.gameMode === CONTEST_GAME_MODE_BIO_BALL) {
              this.weeklyContestSlate.refreshSlateAfterEntryChange();
            }
          }
        },
        () => {
          this.entryInfoByContestId[id] = {
            loaded: true,
            entered: false,
            rulesAcceptedVersion: null,
            paymentStatus: null,
          };
        },
      );
      this.entryRowUnsubs.set(id, unsub);
    }
  }

  private startContestClock(): void {
    this.stopContestClock();
    this.nowMs = Date.now();
    this.clockId = setInterval(() => {
      this.nowMs = Date.now();
    }, 1000);
  }

  private stopContestClock(): void {
    if (this.clockId != null) {
      clearInterval(this.clockId);
      this.clockId = null;
    }
  }

  /** P0: retry after Firestore list error. */
  protected retryLoadContests(): void {
    if (!this.loggedIn) {
      return;
    }
    this.listError = null;
    this.attachListListeners();
  }

  protected readonly pipelineStepLabels = pipelineLabels;

  protected pipelineStepActiveIndex(status: ContestStatus): number {
    return pipelineCurrentIndex(status);
  }

  protected pipelineHelpText(row: ContestListRow): string {
    return pipelineCaption(
      row.status,
      row.windowStart.getTime(),
      row.windowEnd.getTime(),
      this.nowMs,
    );
  }

  protected countdownLine(row: ContestListRow): string | null {
    return primaryCountdownLine(
      row.status,
      row.windowStart.getTime(),
      row.windowEnd.getTime(),
      this.nowMs,
    );
  }

  protected lockSoon(row: ContestListRow): boolean {
    return isPlayWindowLockSoon(
      row.status,
      row.windowStart.getTime(),
      row.windowEnd.getTime(),
      this.nowMs,
    );
  }

  protected showYoureIn(row: ContestListRow): boolean {
    return this.entryCountsAsConfirmedEntrant(row);
  }

  protected statusChipAriaLabel(row: ContestListRow): string {
    return `Contest status: ${this.statusLabel(row.status)}`;
  }

  private detachAllPaidPayoutListeners(): void {
    for (const unsub of this.paidPayoutUnsubs.values()) {
      unsub();
    }
    this.paidPayoutUnsubs.clear();
    this.paidPayoutByContestId = {};
  }

  private detachAllFinalResultsListeners(): void {
    for (const unsub of this.finalResultsUnsubs.values()) {
      unsub();
    }
    this.finalResultsUnsubs.clear();
    this.finalResultsByContestId = {};
  }

  /** `results/final` for each listed `paid` contest (placement narrative, tie copy). */
  private syncFinalResultsListeners(): void {
    if (!this.uid) {
      this.detachAllFinalResultsListeners();
      return;
    }
    const paidIds = new Set(
      this.rows.filter((r) => r.status === 'paid').map((r) => r.contestId),
    );
    for (const [id, unsub] of this.finalResultsUnsubs.entries()) {
      if (!paidIds.has(id)) {
        unsub();
        this.finalResultsUnsubs.delete(id);
        delete this.finalResultsByContestId[id];
      }
    }

    const db = getConfiguredFirestore();
    const myUid = this.uid;
    for (const id of paidIds) {
      if (this.finalResultsUnsubs.has(id)) {
        continue;
      }
      this.finalResultsByContestId[id] = initialLoadingResultsView();
      const ref = doc(db, 'contests', id, 'results', 'final');
      const unsub = onSnapshot(
        ref,
        (snap) => {
          const raw = snap.exists() ? snap.data() : null;
          this.finalResultsByContestId[id] = parseFinalResultsForViewer(
            raw,
            myUid,
          );
        },
        () => {
          this.finalResultsByContestId[id] = parseFinalResultsForViewer(
            null,
            myUid,
          );
        },
      );
      this.finalResultsUnsubs.set(id, unsub);
    }
  }

  /** Subscribe to `payouts/dryRun` for each listed `paid` contest. */
  private syncPaidListExtras(): void {
    if (!this.uid) {
      this.detachAllPaidPayoutListeners();
      return;
    }
    const paidIds = new Set(
      this.rows.filter((r) => r.status === 'paid').map((r) => r.contestId),
    );
    for (const [id, unsub] of this.paidPayoutUnsubs.entries()) {
      if (!paidIds.has(id)) {
        unsub();
        this.paidPayoutUnsubs.delete(id);
        delete this.paidPayoutByContestId[id];
      }
    }

    const db = getConfiguredFirestore();
    for (const id of paidIds) {
      if (this.paidPayoutUnsubs.has(id)) {
        continue;
      }
      this.paidPayoutByContestId[id] = {
        loading: true,
        winnerText: null,
        otherLines: [],
        lineCount: 0,
        currencyLabel: '',
      };

      const payoutRef = doc(db, 'contests', id, 'payouts', 'dryRun');
      const unsub = onSnapshot(
        payoutRef,
        (snap) => {
          const st = this.paidPayoutByContestId[id];
          if (!st) {
            return;
          }
          st.loading = false;
          if (!snap.exists()) {
            st.winnerText = null;
            st.otherLines = [];
            st.lineCount = 0;
            st.currencyLabel = '';
            return;
          }
          const parsed = this.parseDryRunPayout(snap.data());
          if (!parsed) {
            st.winnerText = null;
            st.otherLines = [];
            st.lineCount = 0;
            st.currencyLabel = '';
            return;
          }
          st.winnerText = getWinnerGetsPhrase(parsed);
          st.otherLines = getPlaceAmountLines(parsed);
          st.lineCount = parsed.lines.length;
          st.currencyLabel = this.formatDryRunCurrencyCaption(parsed);
        },
        () => {
          const st = this.paidPayoutByContestId[id];
          if (st) {
            st.loading = false;
            st.winnerText = null;
            st.otherLines = [];
            st.lineCount = 0;
            st.currencyLabel = '';
          }
        },
      );
      this.paidPayoutUnsubs.set(id, unsub);
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

  private formatDryRunCurrencyCaption(
    doc: ContestDryRunPayoutsDocument,
  ): string {
    const c = doc.currency.trim();
    if (doc.notRealMoney) {
      return c ? `${c} (notional, dry-run)` : 'notional dry-run amounts';
    }
    return c || 'USD';
  }

  protected formatOrdinalRank = formatOrdinalRank;

  /** Collapsed card line — your place / entry state (paid contests). */
  protected yourPlaceCardLine(row: ContestListRow): string | null {
    if (row.status !== 'paid') {
      return null;
    }
    const v = this.finalResultsByContestId[row.contestId];
    if (!v) {
      return null;
    }
    const entered = this.entryCountsAsConfirmedEntrant(row);
    return formatYourPlaceCardLine(v, entered);
  }

  /** Slate blurb for expanded paid section. */
  protected slateSummaryLine(row: ContestListRow): string {
    const n = row.leagueGamesN;
    return `This contest’s slate is ${n} league game${n === 1 ? '' : 's'} (your first ${n} Bio Ball results in the play window, in time order).`;
  }

  protected payoutTransparencyLine(
    px: ContestPayoutView,
  ): string | null {
    if (px.loading) {
      return null;
    }
    if (!px.winnerText && px.lineCount === 0) {
      return null;
    }
    const n = px.lineCount;
    const places =
      n === 0
        ? 'No payout lines were published for this dry-run yet.'
        : `This dry-run lists ${n} paid place${n === 1 ? '' : 's'}.`;
    const cur = px.currencyLabel.trim();
    const curPart = cur
      ? ` Amounts use ${cur}; figures are rounded to whole cents.`
      : ' Amounts are rounded to whole cents.';
    return `${places}${curPart}`;
  }

  protected closureWhyHeading(row: ContestListRow): string {
    const v = this.finalResultsByContestId[row.contestId];
    if (!v || v.loading) {
      return 'Results & tie-breaks';
    }
    if (v.youMissingFromStandings) {
      return 'Why you’re not listed';
    }
    if (v.yourRank === 1) {
      return 'How placements were decided';
    }
    return 'Why didn’t I win?';
  }

  protected closureWhyLines(row: ContestListRow): string[] {
    const v = this.finalResultsByContestId[row.contestId];
    if (!v || v.loading) {
      return [];
    }
    const lines: string[] = [];
    if (v.yourRank != null && v.yourRank > 1) {
      lines.push(
        'Simulated payouts go to the top ranks only. Your finish reflects contest wins on this slate, then tie-breakers when wins tie.',
      );
    }
    if (v.youMissingFromStandings) {
      lines.push(
        'If you entered, you may be missing because results are still processing, the slate was partial, or the published list excludes your row — see full rules.',
      );
    }
    if (v.tieSummary) {
      lines.push(v.tieSummary);
    }
    const pol = humanizeTiePolicyRef(v.tiePolicyRef);
    if (pol) {
      lines.push(pol);
    }
    return lines;
  }

  protected closureWhyBlockVisible(row: ContestListRow): boolean {
    if (row.status !== 'paid') {
      return false;
    }
    if (!this.entryCountsAsConfirmedEntrant(row)) {
      return false;
    }
    const v = this.finalResultsByContestId[row.contestId];
    if (!v || v.loading) {
      return false;
    }
    if (v.youMissingFromStandings) {
      return true;
    }
    if (v.yourRank != null && v.yourRank > 1) {
      return true;
    }
    return v.tieSummary != null || v.tiePolicyRef != null;
  }

  protected enteredContest(row: ContestListRow): boolean {
    return this.entryCountsAsConfirmedEntrant(row);
  }

  /** P2 — contextual cheer / urgency on the card (open, scheduled, scoring). */
  protected engagementCardLine(row: ContestListRow): string | null {
    const entered = this.entryCountsAsConfirmedEntrant(row);
    const openLine = openEnteredEngagementLine(
      row.status,
      entered,
      row.windowEnd.getTime(),
      this.nowMs,
    );
    if (openLine) {
      return openLine;
    }
    const sched = scheduledWarmupLine(
      row.status,
      row.windowStart.getTime(),
      this.nowMs,
    );
    if (sched) {
      return sched;
    }
    return null;
  }

  /** P2 — celebration strip for paid contests (dry-run honest). */
  protected paidDelight(row: ContestListRow): PaidDelightView | null {
    if (row.status !== 'paid') {
      return null;
    }
    return paidResultDelight(
      this.finalResultsByContestId[row.contestId],
      this.enteredContest(row),
    );
  }

  /** Icon for {@link engagementCardLine} (Material Symbols name). */
  protected engagementCardIcon(row: ContestListRow): string {
    switch (row.status) {
      case 'open':
        return 'sports_esports';
      case 'scheduled':
        return 'event';
      default:
        return 'rocket_launch';
    }
  }
}
