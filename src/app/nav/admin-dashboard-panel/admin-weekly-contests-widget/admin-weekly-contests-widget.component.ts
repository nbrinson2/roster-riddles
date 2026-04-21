import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  AdminContestPublicRow,
  AdminWeeklyContestsApiService,
} from 'src/app/shared/services/admin-weekly-contests-api.service';
import {
  CONTEST_DEFAULT_LEAGUE_GAMES_N,
  type ContestStatus,
} from 'src/app/shared/models/contest.model';

const TRANSITION_TARGETS: Array<'open' | 'scoring' | 'paid' | 'cancelled'> = [
  'open',
  'scoring',
  'paid',
  'cancelled',
];

/** `bio-ball` → `Bio Ball`; unknown slugs become Title Case segments. */
function formatGameModeAsTitle(raw: string | undefined): string {
  if (!raw?.trim()) {
    return '';
  }
  return raw
    .trim()
    .toLowerCase()
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

@Component({
  selector: 'app-admin-weekly-contests-widget',
  templateUrl: './admin-weekly-contests-widget.component.html',
  styleUrls: ['./admin-weekly-contests-widget.component.scss'],
  standalone: false,
})
export class AdminWeeklyContestsWidgetComponent implements OnInit, OnDestroy {
  protected loading = true;
  protected listError: string | null = null;
  protected rows: AdminContestPublicRow[] = [];

  /** `contestId` currently expanded for transition form. */
  protected managingId: string | null = null;
  protected targetStatus: 'open' | 'scoring' | 'paid' | 'cancelled' = 'scoring';
  protected forceTransition = false;
  protected reason = '';
  protected transitionSubmitting = false;
  protected transitionError: string | null = null;

  /** E2 scoring job (contest must be `scoring`). */
  protected runScoringBusyId: string | null = null;
  protected runScoringError: string | null = null;
  protected runScoringErrorContestId: string | null = null;
  protected runScoringOk: { contestId: string; text: string } | null = null;

  /** Shown after a successful create (server-assigned id). */
  protected lastCreatedContestId: string | null = null;

  protected createTitle = '';
  protected createStatus: 'scheduled' | 'open' = 'scheduled';
  protected createWindowStart = '';
  protected createWindowEnd = '';
  protected createLeagueGamesN = CONTEST_DEFAULT_LEAGUE_GAMES_N;
  protected createRulesVersion = 1;
  protected createSubmitting = false;
  protected createError: string | null = null;

  protected readonly transitionTargets = TRANSITION_TARGETS;

  private destroy$ = new Subject<void>();

  constructor(private readonly api: AdminWeeklyContestsApiService) {}

  ngOnInit(): void {
    this.loadList(true);
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected statusLabel(status: ContestStatus): string {
    switch (status) {
      case 'open':
        return 'Open';
      case 'scheduled':
        return 'Scheduled';
      case 'scoring':
        return 'Scoring';
      case 'paid':
        return 'Paid';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status;
    }
  }

  protected formatWindow(row: AdminContestPublicRow): string {
    const a = row.windowStart ? new Date(row.windowStart) : null;
    const b = row.windowEnd ? new Date(row.windowEnd) : null;
    if (!a || !b || Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) {
      return '—';
    }
    const opts: Intl.DateTimeFormatOptions = {
      dateStyle: 'medium',
      timeStyle: 'short',
    };
    return `${a.toLocaleString(undefined, opts)} — ${b.toLocaleString(undefined, opts)}`;
  }

  /**
   * Card heading: custom title if set; else human-readable game type (e.g. `bio-ball` → Bio Ball).
   * Admin create stores `title` as the contest id when omitted (`titleTrim || contestId`), so we
   * treat `title === contestId` as “no custom title.”
   */
  protected contestDisplayTitle(row: AdminContestPublicRow): string {
    const t = row.title?.trim();
    if (t && t !== row.contestId) {
      return t;
    }
    const fromMode = formatGameModeAsTitle(row.gameMode);
    return fromMode || row.contestId;
  }

  protected toggleManage(row: AdminContestPublicRow): void {
    if (this.managingId === row.contestId) {
      this.managingId = null;
      this.transitionError = null;
      return;
    }
    this.managingId = row.contestId;
    this.transitionError = null;
    this.reason = '';
    this.forceTransition = false;
    this.pickDefaultTarget(row.status);
  }

  private pickDefaultTarget(from: ContestStatus): void {
    const order: ContestStatus[] = [
      'scheduled',
      'open',
      'scoring',
      'paid',
      'cancelled',
    ];
    const i = order.indexOf(from);
    const next = i >= 0 && i < order.length - 1 ? order[i + 1] : from;
    if (
      next === 'open' ||
      next === 'scoring' ||
      next === 'paid' ||
      next === 'cancelled'
    ) {
      this.targetStatus = next;
    } else {
      this.targetStatus = 'scoring';
    }
  }

  protected submitTransition(contestId: string): void {
    this.transitionSubmitting = true;
    this.transitionError = null;
    this.api
      .transition(contestId, {
        to: this.targetStatus,
        force: this.forceTransition || undefined,
        reason: this.reason.trim() ? this.reason.trim().slice(0, 500) : undefined,
      })
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: () => {
          this.transitionSubmitting = false;
          this.managingId = null;
          this.loadList(false);
        },
        error: (err: HttpErrorResponse) => {
          this.transitionSubmitting = false;
          this.transitionError = this.mapTransitionError(err);
        },
      });
  }

  protected submitRunScoring(contestId: string): void {
    this.runScoringBusyId = contestId;
    this.runScoringError = null;
    this.runScoringErrorContestId = null;
    this.runScoringOk = null;
    this.api
      .runScoring(contestId)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.runScoringBusyId = null;
          const paid = res.transitioned ? ' Contest status is now Paid.' : '';
          this.runScoringOk = {
            contestId,
            text: `Scoring job finished (${res.standingsCount} ranked).${paid}`,
          };
          this.loadList(false);
        },
        error: (err: HttpErrorResponse) => {
          this.runScoringBusyId = null;
          this.runScoringErrorContestId = contestId;
          this.runScoringError = this.mapRunScoringError(err);
        },
      });
  }

  protected submitCreate(): void {
    this.createError = null;
    this.lastCreatedContestId = null;
    const ws = this.localDateTimeToIso(this.createWindowStart);
    const we = this.localDateTimeToIso(this.createWindowEnd);
    if (!ws || !we) {
      this.createError = 'Window start and end are required (valid dates).';
      return;
    }
    if (ws >= we) {
      this.createError = 'Window start must be before window end.';
      return;
    }
    const n = Number(this.createLeagueGamesN);
    if (!Number.isFinite(n) || n < 1 || n > 100) {
      this.createError = 'League games (N) must be between 1 and 100.';
      return;
    }

    this.createSubmitting = true;
    const titleTrim = this.createTitle.trim();
    const rulesN = Number(this.createRulesVersion);
    const body = {
      status: this.createStatus,
      windowStart: ws,
      windowEnd: we,
      leagueGamesN: Math.floor(n),
      rulesVersion: Number.isFinite(rulesN) && rulesN > 0 ? rulesN : 1,
      ...(titleTrim ? { title: titleTrim.slice(0, 200) } : {}),
    };

    this.api
      .createContest(body)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.createSubmitting = false;
          this.lastCreatedContestId = res.contest?.contestId ?? null;
          this.resetCreateForm();
          this.loadList(false);
        },
        error: (err: HttpErrorResponse) => {
          this.createSubmitting = false;
          this.createError = this.mapCreateError(err);
        },
      });
  }

  private localDateTimeToIso(value: string): string | null {
    if (!value?.trim()) {
      return null;
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
      return null;
    }
    return d.toISOString();
  }

  private resetCreateForm(): void {
    this.createTitle = '';
    this.createStatus = 'scheduled';
    this.createWindowStart = '';
    this.createWindowEnd = '';
    this.createLeagueGamesN = CONTEST_DEFAULT_LEAGUE_GAMES_N;
    this.createRulesVersion = 1;
  }

  private loadList(showSpinner: boolean): void {
    if (showSpinner) {
      this.loading = true;
    }
    this.listError = null;
    this.api
      .listContests(80)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.rows = res.contests ?? [];
          this.loading = false;
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.listError = this.mapListError(err);
        },
      });
  }

  private mapListError(err: HttpErrorResponse): string {
    if (err.status === 403) {
      return 'Admin access required (refresh after grant, or sign in again).';
    }
    if (err.status === 401) {
      return 'Sign in required.';
    }
    const body = err.error as { error?: { message?: string } } | null;
    const msg = body?.error?.message;
    return typeof msg === 'string' ? msg : 'Could not load contests.';
  }

  private mapTransitionError(err: HttpErrorResponse): string {
    if (err.status === 403) {
      return 'Admin access required.';
    }
    const body = err.error as { error?: { message?: string; code?: string } } | null;
    const msg = body?.error?.message;
    return typeof msg === 'string' ? msg : 'Transition failed.';
  }

  private mapCreateError(err: HttpErrorResponse): string {
    if (err.status === 403) {
      return 'Admin access required.';
    }
    if (err.status === 409) {
      return 'That contest id already exists. Try creating again.';
    }
    const body = err.error as { error?: { message?: string } } | null;
    const msg = body?.error?.message;
    return typeof msg === 'string' ? msg : 'Could not create contest.';
  }

  private mapRunScoringError(err: HttpErrorResponse): string {
    if (err.status === 403) {
      return 'Admin access required.';
    }
    if (err.status === 401) {
      return 'Sign in required.';
    }
    const body = err.error as { error?: { message?: string; code?: string } } | null;
    const code = body?.error?.code;
    const msg = body?.error?.message;
    if (code === 'contest_not_scoring') {
      return typeof msg === 'string'
        ? msg
        : 'Contest must be in Scoring state (move it from Open first).';
    }
    return typeof msg === 'string' ? msg : 'Scoring job failed.';
  }
}
