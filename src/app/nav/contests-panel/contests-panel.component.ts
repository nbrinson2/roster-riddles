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
  type Unsubscribe,
  where,
} from 'firebase/firestore';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/auth/auth.service';
import { getConfiguredFirestore } from 'src/app/config/firestore-instance';
import {
  CONTEST_GAME_MODE_BIO_BALL,
  type ContestStatus,
} from 'src/app/shared/models/contest.model';
import { environment } from 'src/environment';
import { WeeklyContestSlateService } from 'src/app/shared/services/weekly-contest-slate.service';
import {
  getPlaceAmountLines,
  getWinnerGetsPhrase,
} from './contest-payout-display';
import { buildContestScheduleLine } from 'src/app/shared/contest/contest-value-prop';
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
  initialLoadingResultsView,
  parseFinalResultsForViewer,
} from './contest-results-closure';
import {
  mapContestCheckoutErrorMessage,
  mapContestJoinErrorMessage,
} from './contests-panel-api-messages';
import { formatDryRunCurrencyCaption, parseDryRunPayoutDocument } from './contests-panel-dry-run-payout';
import {
  contestRowRequiresPayment,
  entryRowCountsAsConfirmedEntrant,
  formatContestEntryFeeUsd,
  parseEntryPaymentStatus,
} from './contests-panel-entry.util';
import {
  contestRowsByIdFromSnapshots,
  filterRowsForContestsPanel,
} from './contests-panel-list.util';
import {
  CONTEST_JOIN_USE_CHECKOUT_WHEN_FEE,
  formatContestJoinSuccessMessage,
} from './contests-panel-join-messages';
import {
  canAttemptJoinContest,
  joinDisabledReasonForContest,
} from './contests-panel-join-window.util';
import {
  contestClosureWhyBlockVisible,
  contestClosureWhyHeading,
  contestClosureWhyLines,
  contestSlateSummaryLine,
  contestStatusChipLabel,
  engagementCardIconName,
  formatContestWindowLocal,
  formatNonPaidContestCardMeta,
  formatPaidContestCardMeta,
  payoutDryRunTransparencyLine,
} from './contests-panel-presenters';
import {
  parseStripeCheckoutReturnQuery,
  STRIPE_CHECKOUT_CANCELLED_USER_MESSAGE,
} from './contests-panel-stripe-return';
import {
  MAX_COMPLETED_CONTESTS,
  type ContestCheckoutSessionResponse,
  type ContestEntryRowState,
  type ContestJoinResponse,
  type ContestListRow,
  type ContestPayoutView,
} from './contests-panel.types';

export type { ContestListRow } from './contests-panel.types';

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
    return formatContestWindowLocal(start, end);
  }

  protected statusLabel(status: ContestStatus): string {
    return contestStatusChipLabel(status);
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
    return formatNonPaidContestCardMeta(row);
  }

  /** Paid: same — primary payout line + slate only. */
  protected formatPaidCardMeta(
    row: ContestListRow,
    payout: ContestPayoutView,
  ): string {
    return formatPaidContestCardMeta(row, payout);
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
    return canAttemptJoinContest(row, Date.now());
  }

  protected joinDisabledReason(row: ContestListRow): string | null {
    return joinDisabledReasonForContest(row, Date.now());
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
      this.joinError = CONTEST_JOIN_USE_CHECKOUT_WHEN_FEE;
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
          this.joinSuccess = formatContestJoinSuccessMessage(res);
          this.entryInfoByContestId[row.contestId] = {
            loaded: true,
            entered: true,
            rulesAcceptedVersion: res.entry.rulesAcceptedVersion,
          };
          if (res.contest.gameMode === CONTEST_GAME_MODE_BIO_BALL) {
            this.weeklyContestSlate.refreshSlateAfterEntryChange();
          }
        },
        error: (err: HttpErrorResponse) => {
          this.joinSubmitting = false;
          this.joinError = mapContestJoinErrorMessage(err);
        },
      });
  }

  /** Contest charges an entry fee and the app is built for paid Checkout (P5-D2). */
  protected contestRequiresPayment(row: ContestListRow): boolean {
    return contestRowRequiresPayment(row, environment.contestsPaymentsEnabled);
  }

  /**
   * “You’re in” / rules banner — free contests: doc exists; paid contests: `paymentStatus === paid`
   * (webhook) unless legacy free row.
   */
  protected entryCountsAsConfirmedEntrant(row: ContestListRow): boolean {
    return entryRowCountsAsConfirmedEntrant(
      row,
      this.entryInfoByContestId[row.contestId],
      environment.contestsPaymentsEnabled,
    );
  }

  protected formatEntryFeeUsd(row: ContestListRow): string | null {
    return formatContestEntryFeeUsd(row);
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
          this.joinError = mapContestCheckoutErrorMessage(err);
        },
      });
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
    const ret = parseStripeCheckoutReturnQuery(tree.queryParams);
    if (ret.kind === 'none') {
      return;
    }
    const contestId = ret.contestId;

    const pathOnly = this.router.url.replace(/\?.*/, '');
    void this.router.navigateByUrl(pathOnly, { replaceUrl: true });

    if (!this.loggedIn) {
      return;
    }

    if (ret.kind === 'success') {
      this.checkoutAwaitPaymentContestId = contestId;
      this.expandedContestId = contestId;
      this.joinError = null;
      this.joinSuccess = null;
      return;
    }

    this.checkoutAwaitPaymentContestId = null;
    this.expandedContestId = contestId;
    this.joinError = STRIPE_CHECKOUT_CANCELLED_USER_MESSAGE;
    this.joinSuccess = null;
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
    const byId = contestRowsByIdFromSnapshots([
      this.openSnap,
      this.scheduledSnap,
      this.paidSnap,
    ]);

    const prevExpandedId = this.expandedContestId;

    this.rows = filterRowsForContestsPanel(byId, {
      gameMode: CONTEST_GAME_MODE_BIO_BALL,
      maxCompletedContests: MAX_COMPLETED_CONTESTS,
    });

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
          const ps = parseEntryPaymentStatus(data['paymentStatus']);
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
          const parsed = parseDryRunPayoutDocument(snap.data());
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
          st.currencyLabel = formatDryRunCurrencyCaption(parsed);
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
    return contestSlateSummaryLine(row);
  }

  protected payoutTransparencyLine(
    px: ContestPayoutView,
  ): string | null {
    return payoutDryRunTransparencyLine(px);
  }

  protected closureWhyHeading(row: ContestListRow): string {
    return contestClosureWhyHeading(
      this.finalResultsByContestId[row.contestId],
    );
  }

  protected closureWhyLines(row: ContestListRow): string[] {
    return contestClosureWhyLines(
      this.finalResultsByContestId[row.contestId],
    );
  }

  protected closureWhyBlockVisible(row: ContestListRow): boolean {
    return contestClosureWhyBlockVisible({
      status: row.status,
      entered: this.entryCountsAsConfirmedEntrant(row),
      v: this.finalResultsByContestId[row.contestId],
    });
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
    return engagementCardIconName(row.status);
  }
}
