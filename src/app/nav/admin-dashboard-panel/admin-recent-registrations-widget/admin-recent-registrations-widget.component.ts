import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/auth/auth.service';
import {
  AdminUserClaimsApiService,
  type RecentRegistrationEntry,
} from 'src/app/shared/services/admin-user-claims-api.service';

@Component({
  selector: 'app-admin-recent-registrations-widget',
  templateUrl: './admin-recent-registrations-widget.component.html',
  styleUrls: ['./admin-recent-registrations-widget.component.scss'],
  standalone: false,
})
export class AdminRecentRegistrationsWidgetComponent implements OnInit, OnDestroy {
  @Output() readonly uidSelected = new EventEmitter<string>();

  protected rows: RecentRegistrationEntry[] = [];
  protected loading = false;
  protected error: string | null = null;
  protected currentUid: string | null = null;

  private destroy$ = new Subject<void>();

  constructor(
    private readonly api: AdminUserClaimsApiService,
    private readonly auth: AuthService,
  ) {}

  ngOnInit(): void {
    this.auth.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe((u) => {
        this.currentUid = u?.uid ?? null;
      });
    this.load();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected load(): void {
    this.error = null;
    this.loading = true;
    this.api
      .listRecentRegistrations()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.loading = false;
          this.rows = res.users ?? [];
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.rows = [];
          this.error = this.mapError(err);
        },
      });
  }

  protected openRow(row: RecentRegistrationEntry): void {
    this.uidSelected.emit(row.uid);
  }

  protected isRowYou(uid: string): boolean {
    return Boolean(this.currentUid && uid === this.currentUid);
  }

  private mapError(err: HttpErrorResponse): string {
    if (err.status === 403) {
      return 'Admin access required.';
    }
    const body = err.error as { error?: { message?: string } } | null;
    const msg = body?.error?.message;
    return typeof msg === 'string' ? msg : 'Could not load recent registrations.';
  }
}
