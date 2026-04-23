import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { from, switchMap } from 'rxjs';
import { environment } from 'src/environment';

/**
 * Requests that hit our Express API (same-origin `/api/...` or `environment.baseUrl`).
 * External hosts (e.g. statsapi.mlb.com) are excluded so we never send Firebase tokens there.
 */
function isRosterRiddlesApiUrl(requestUrl: string): boolean {
  if (requestUrl.startsWith('/api/')) {
    return true;
  }
  if (environment.baseUrl && requestUrl.startsWith(environment.baseUrl)) {
    return true;
  }
  try {
    return new URL(requestUrl).pathname.startsWith('/api/');
  } catch {
    return false;
  }
}

/** `GET /api/v1/me` must use a **fresh** ID token so custom claims (e.g. `admin`) match Admin SDK updates. */
function isApiV1MeUrl(requestUrl: string): boolean {
  try {
    const path = requestUrl.startsWith('http')
      ? new URL(requestUrl).pathname
      : requestUrl.split(/[?#]/)[0];
    return path === '/api/v1/me';
  } catch {
    return false;
  }
}

/** `/api/v1/admin/*` requires a token that includes the **`admin`** claim (same as `/me`). */
function isApiV1AdminUrl(requestUrl: string): boolean {
  try {
    const path = requestUrl.startsWith('http')
      ? new URL(requestUrl).pathname
      : requestUrl.split(/[?#]/)[0];
    return path.startsWith('/api/v1/admin/');
  } catch {
    return false;
  }
}

/**
 * Attaches `Authorization: Bearer <idToken>` for our API only.
 *
 * **Token refresh:** Firebase `User#getIdToken()` returns a valid JWT and refreshes it
 * automatically when expired (no separate refresh step needed for typical calls).
 * For **`GET /api/v1/me`** and **`/api/v1/admin/*`**, **`getIdToken(true)`** is used so claim changes from Admin SDK
 * appear without waiting for natural expiry (see `docs/admin/admin-dashboard-security.md`).
 * Logged-out users (`currentUser` null) send the request unchanged — no stale header.
 */
export const authHttpInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isRosterRiddlesApiUrl(req.url)) {
    return next(req);
  }

  const auth = inject(Auth);
  const user = auth.currentUser;
  if (!user) {
    return next(req);
  }

  const forceRefresh = isApiV1MeUrl(req.url) || isApiV1AdminUrl(req.url);
  return from(user.getIdToken(forceRefresh)).pipe(
    switchMap((token) =>
      next(
        req.clone({
          setHeaders: { Authorization: `Bearer ${token}` },
        })
      )
    )
  );
};
