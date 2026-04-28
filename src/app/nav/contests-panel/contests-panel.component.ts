import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import {
  Component,
  EventEmitter,
  OnDestroy,
  OnInit,
  Output,
} from '@angular/core';
import { NavigationEnd, Router } from '@angular/router';
import { Subject } from 'rxjs';
import { filter, takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/auth/auth.service';
import { CONTEST_GAME_MODE_BIO_BALL } from 'src/app/shared/models/contest.model';
import { environment } from 'src/environment';
import { WeeklyContestSlateService } from 'src/app/shared/services/weekly-contest-slate.service';
import { CONTEST_FULL_RULES_HREF } from './shared/contest-rules-copy';
import {
  buildContestHeroUnifiedNote,
  CONTEST_HERO_TAGLINE,
} from './shared/contest-engagement-copy';
import type { ParsedFinalResultsView } from './shared/contest-results-closure';
import {
  mapContestCheckoutErrorMessage,
  mapContestJoinErrorMessage,
} from './lib/contests-panel-api-messages';
import {
  contestRowRequiresPayment,
  entryRowCountsAsConfirmedEntrant,
} from './lib/contests-panel-entry.util';
import {
  ContestsPanelFirestoreSyncService,
  type ContestsPanelFirestoreUiState,
} from './services/contests-panel-firestore-sync.service';
import {
  CONTEST_JOIN_USE_CHECKOUT_WHEN_FEE,
  formatContestJoinSuccessView,
} from './lib/contests-panel-join-messages';
import {
  canAttemptJoinContest,
  joinDisabledReasonForContest,
} from './lib/contests-panel-join-window.util';
import {
  parseStripeCheckoutReturnQuery,
  STRIPE_CHECKOUT_CANCELLED_USER_MESSAGE,
} from './lib/contests-panel-stripe-return';
import {
  type ContestCheckoutSessionResponse,
  type ContestEntryRowState,
  type ContestJoinResponse,
  type ContestJoinSuccessView,
  type ContestListRow,
  type ContestPayoutView,
} from './lib/contests-panel.types';

export type { ContestListRow } from './lib/contests-panel.types';

@Component({
  selector: 'contests-panel',
  templateUrl: './contests-panel.component.html',
  styleUrls: ['./contests-panel.component.scss'],
  standalone: false,
  providers: [ContestsPanelFirestoreSyncService],
})
export class ContestsPanelComponent implements OnInit, OnDestroy {
  @Output() readonly requestSignIn = new EventEmitter<void>();

  protected get contestHeroUnifiedNote(): string {
    return buildContestHeroUnifiedNote({
      simulatedContestsUiEnabled: environment.simulatedContestsUiEnabled,
      contestsPaymentsEnabled: environment.contestsPaymentsEnabled,
    });
  }

  protected readonly simulatedContestsUiEnabled =
    environment.simulatedContestsUiEnabled;
  protected readonly fullRulesHref = CONTEST_FULL_RULES_HREF;
  protected readonly heroTagline = CONTEST_HERO_TAGLINE;

  protected loggedIn = false;
  /** Firebase `emailVerified`; required to join or start paid checkout (server-enforced). */
  protected emailVerified = false;
  protected loading = true;
  protected listError: string | null = null;
  protected rows: ContestListRow[] = [];
  /** Filled by {@link ContestsPanelFirestoreSyncService} when the list is empty (optional “next opens” line). */
  protected emptyListNextPlayHint: string | null = null;

  protected expandedContestId: string | null = null;
  protected rulesCheckbox = false;
  protected joinSubmitting = false;
  protected joinError: string | null = null;
  protected joinSuccess: ContestJoinSuccessView | null = null;

  /**
   * After Stripe Checkout success redirect; cleared when entry shows `paymentStatus === paid`
   * (P5-E webhook) or user starts another checkout.
   */
  protected checkoutAwaitPaymentContestId: string | null = null;

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

  protected get contestsPaymentsEnabled(): boolean {
    return environment.contestsPaymentsEnabled;
  }

  protected nowMs = Date.now();

  protected entryInfoByContestId: Record<string, ContestEntryRowState> = {};
  private clockId: ReturnType<typeof setInterval> | null = null;

  private uid: string | null = null;
  private destroy$ = new Subject<void>();

  protected paidPayoutByContestId: Record<string, ContestPayoutView> = {};

  protected finalResultsByContestId: Record<string, ParsedFinalResultsView> = {};

  constructor(
    private readonly auth: AuthService,
    private readonly http: HttpClient,
    private readonly weeklyContestSlate: WeeklyContestSlateService,
    private readonly router: Router,
    private readonly firestoreSync: ContestsPanelFirestoreSyncService,
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
      this.emailVerified = user?.emailVerified === true;
      this.uid = user?.uid ?? null;
      if (!user) {
        this.emailVerified = false;
        this.stopContestClock();
        this.firestoreSync.stopAll(this.firestoreUi());
        this.rows = [];
        this.emptyListNextPlayHint = null;
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
    this.firestoreSync.stopAll(this.firestoreUi());
    this.destroy$.next();
    this.destroy$.complete();
  }

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
    if (!this.emailVerified) {
      this.joinError =
        'Verify your email before joining. Open Profile (person icon) to resend the verification link.';
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
          this.joinSuccess = formatContestJoinSuccessView(res);
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

  protected contestRequiresPayment(row: ContestListRow): boolean {
    return contestRowRequiresPayment(row, environment.contestsPaymentsEnabled);
  }

  protected entryCountsAsConfirmedEntrant(row: ContestListRow): boolean {
    return entryRowCountsAsConfirmedEntrant(
      row,
      this.entryInfoByContestId[row.contestId],
      environment.contestsPaymentsEnabled,
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
    if (!this.emailVerified) {
      this.joinError =
        'Verify your email before paid entry. Open Profile (person icon) to resend the verification link.';
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

  private firestoreUi(): ContestsPanelFirestoreUiState {
    return this as unknown as ContestsPanelFirestoreUiState;
  }

  private attachListListeners(): void {
    this.firestoreSync.attachContestList(this.firestoreUi(), this.uid);
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

  protected retryLoadContests(): void {
    if (!this.loggedIn) {
      return;
    }
    this.listError = null;
    this.attachListListeners();
  }
}
