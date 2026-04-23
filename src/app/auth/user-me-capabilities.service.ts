import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { Observable, of } from 'rxjs';
import {
  catchError,
  distinctUntilChanged,
  map,
  shareReplay,
  switchMap,
} from 'rxjs/operators';
import { onIdTokenChanged, type User } from 'firebase/auth';
import { environment } from 'src/environment';

interface MeResponse {
  isAdmin?: boolean;
}

/**
 * Server-verified capabilities from `GET /api/v1/me` (Story AD-2).
 * Subscribes to Firebase `onIdTokenChanged` so `isAdmin` updates after token refresh
 * (e.g. claim grant/revoke + `getIdToken(true)` or natural refresh).
 */
@Injectable({ providedIn: 'root' })
export class UserMeCapabilitiesService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(Auth);

  /**
   * Whether the signed-in user is an admin per **`GET /api/v1/me`** (`isAdmin`).
   * **`false`** when logged out or on request failure.
   * Combine with **`environment.adminDashboardUiEnabled`** for UI (Story AD-4).
   */
  readonly isAdmin$: Observable<boolean> = new Observable<User | null>((sub) => {
    const unsub = onIdTokenChanged(this.auth, (u) => sub.next(u));
    return () => unsub();
  }).pipe(
    switchMap((user) => {
      if (!user) {
        return of(false);
      }
      const url = `${environment.baseUrl.replace(/\/$/, '')}/api/v1/me`;
      return this.http.get<MeResponse>(url).pipe(
        map((r) => r.isAdmin === true),
        catchError(() => of(false)),
      );
    }),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );
}
