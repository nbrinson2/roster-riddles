import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import {
  AdminContestPublicRow,
  AdminWeeklyContestsApiService,
} from 'src/app/shared/services/admin-weekly-contests-api.service';
import type { ContestStatus } from 'src/app/shared/models/contest.model';

const TRANSITION_TARGETS: Array<'open' | 'scoring' | 'paid' | 'cancelled'> = [
  'open',
  'scoring',
  'paid',
  'cancelled',
];

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

  protected readonly transitionTargets = TRANSITION_TARGETS;

  private destroy$ = new Subject<void>();

  constructor(private readonly api: AdminWeeklyContestsApiService) {}

  ngOnInit(): void {
    this.loadList();
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
          this.loadList();
        },
        error: (err: HttpErrorResponse) => {
          this.transitionSubmitting = false;
          this.transitionError = this.mapTransitionError(err);
        },
      });
  }

  private loadList(): void {
    this.loading = true;
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
}
