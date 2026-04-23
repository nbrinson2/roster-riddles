import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import type { Observable } from 'rxjs';
import { environment } from 'src/environment';

export interface AdminUserLookupResponse {
  uid: string;
  email: string | null;
  emailVerified: boolean;
  disabled: boolean;
  admin: boolean;
}

export interface AdminUserClaimPatchResponse {
  uid: string;
  email: string | null;
  admin: boolean;
}

export interface AdminListEntry {
  uid: string;
  email: string | null;
  disabled: boolean;
}

export interface AdminUsersListResponse {
  schemaVersion: number;
  admins: AdminListEntry[];
}

export interface RecentRegistrationEntry {
  uid: string;
  email: string | null;
  disabled: boolean;
  /** Account creation instant (ISO 8601). */
  createdAt: string;
}

export interface RecentRegistrationsResponse {
  schemaVersion: number;
  users: RecentRegistrationEntry[];
}

@Injectable({ providedIn: 'root' })
export class AdminUserClaimsApiService {
  private readonly http = inject(HttpClient);

  private apiUrl(path: string): string {
    return `${environment.baseUrl.replace(/\/$/, '')}${path}`;
  }

  listAdmins(): Observable<AdminUsersListResponse> {
    return this.http.get<AdminUsersListResponse>(
      this.apiUrl('/api/v1/admin/users/admins'),
    );
  }

  listRecentRegistrations(): Observable<RecentRegistrationsResponse> {
    return this.http.get<RecentRegistrationsResponse>(
      this.apiUrl('/api/v1/admin/users/recent-registrations'),
    );
  }

  getUser(targetUid: string): Observable<AdminUserLookupResponse> {
    const id = encodeURIComponent(targetUid);
    return this.http.get<AdminUserLookupResponse>(
      this.apiUrl(`/api/v1/admin/users/${id}`),
    );
  }

  updateAdminClaim(
    targetUid: string,
    grant: boolean,
  ): Observable<AdminUserClaimPatchResponse> {
    const id = encodeURIComponent(targetUid);
    return this.http.patch<AdminUserClaimPatchResponse>(
      this.apiUrl(`/api/v1/admin/users/${id}/admin-claim`),
      { grant },
    );
  }
}
