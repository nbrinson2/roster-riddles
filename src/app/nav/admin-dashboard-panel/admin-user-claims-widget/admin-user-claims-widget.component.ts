import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { AuthService } from 'src/app/auth/auth.service';
import {
  AdminUserClaimsApiService,
  type AdminListEntry,
  type AdminUserLookupResponse,
} from 'src/app/shared/services/admin-user-claims-api.service';

@Component({
  selector: 'app-admin-user-claims-widget',
  templateUrl: './admin-user-claims-widget.component.html',
  styleUrls: ['./admin-user-claims-widget.component.scss'],
  standalone: false,
})
export class AdminUserClaimsWidgetComponent implements OnInit, OnDestroy {
  /** Firebase Auth UID to look up. */
  protected targetUidInput = '';

  protected loading = false;
  protected patchSubmitting = false;
  protected lookupError: string | null = null;
  protected patchError: string | null = null;
  protected patchSuccess: string | null = null;

  protected loaded: AdminUserLookupResponse | null = null;

  protected adminRows: AdminListEntry[] = [];
  protected listLoading = false;
  protected listError: string | null = null;

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
    this.loadAdminList();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected isSelfTarget(): boolean {
    const t = this.targetUidInput.trim();
    return Boolean(t && this.currentUid && t === this.currentUid);
  }

  protected isRowYou(uid: string): boolean {
    return Boolean(this.currentUid && uid === this.currentUid);
  }

  protected loadAdminList(): void {
    this.listError = null;
    this.listLoading = true;
    this.api
      .listAdmins()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.listLoading = false;
          this.adminRows = res.admins ?? [];
        },
        error: (err: HttpErrorResponse) => {
          this.listLoading = false;
          this.adminRows = [];
          this.listError = this.mapListError(err);
        },
      });
  }

  protected useAdminRow(row: AdminListEntry): void {
    this.targetUidInput = row.uid;
    this.loadUser();
  }

  protected loadUser(): void {
    const uid = this.targetUidInput.trim();
    this.lookupError = null;
    this.patchError = null;
    this.patchSuccess = null;
    this.loaded = null;

    if (!uid) {
      this.lookupError = 'Enter a Firebase Auth user id (uid).';
      return;
    }

    this.loading = true;
    this.api
      .getUser(uid)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (row) => {
          this.loading = false;
          this.loaded = row;
        },
        error: (err: HttpErrorResponse) => {
          this.loading = false;
          this.lookupError = this.mapLookupError(err);
        },
      });
  }

  protected grantAdmin(): void {
    this.applyClaim(true);
  }

  protected revokeAdmin(): void {
    this.applyClaim(false);
  }

  private applyClaim(grant: boolean): void {
    const uid = this.targetUidInput.trim();
    const prevLoaded = this.loaded;
    if (!uid || !prevLoaded || prevLoaded.uid !== uid) {
      this.patchError = 'Load the user first.';
      return;
    }
    if (this.isSelfTarget()) {
      this.patchError =
        'You cannot change your own admin claim here. Use the repo script if needed.';
      return;
    }

    this.patchSubmitting = true;
    this.patchError = null;
    this.patchSuccess = null;

    this.api
      .updateAdminClaim(uid, grant)
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (res) => {
          this.patchSubmitting = false;
          this.patchSuccess = grant
            ? 'Admin claim granted. The user should refresh their session (or sign out and in) to see the admin UI.'
            : 'Admin claim revoked.';
          this.loaded = {
            uid: res.uid,
            email: res.email,
            emailVerified: prevLoaded.emailVerified,
            disabled: prevLoaded.disabled,
            admin: res.admin,
          };
          this.loadAdminList();
        },
        error: (err: HttpErrorResponse) => {
          this.patchSubmitting = false;
          this.patchError = this.mapPatchError(err);
        },
      });
  }

  private mapListError(err: HttpErrorResponse): string {
    if (err.status === 403) {
      return 'Admin access required.';
    }
    const body = err.error as { error?: { message?: string } } | null;
    const msg = body?.error?.message;
    return typeof msg === 'string' ? msg : 'Could not load admin list.';
  }

  private mapLookupError(err: HttpErrorResponse): string {
    if (err.status === 403) {
      return 'Admin access required.';
    }
    if (err.status === 404) {
      return 'No user with that id.';
    }
    const body = err.error as { error?: { message?: string } } | null;
    const msg = body?.error?.message;
    return typeof msg === 'string' ? msg : 'Could not load user.';
  }

  private mapPatchError(err: HttpErrorResponse): string {
    if (err.status === 403) {
      return 'Admin access required.';
    }
    if (err.status === 400) {
      const body = err.error as { error?: { message?: string } } | null;
      const msg = body?.error?.message;
      if (typeof msg === 'string') {
        return msg;
      }
    }
    const body = err.error as { error?: { message?: string } } | null;
    const msg = body?.error?.message;
    return typeof msg === 'string' ? msg : 'Could not update admin claim.';
  }
}
