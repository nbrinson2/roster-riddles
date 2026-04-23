import { Injectable, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { getIdTokenResult, onIdTokenChanged, signOut, type User } from 'firebase/auth';
import { environment } from 'src/environment';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

/**
 * Signs the user out when their Firebase session exceeds `environment.authSessionMaxMs`
 * (measured from the ID token `authTime`, i.e. when they last authenticated).
 *
 * `authSessionMaxMs === 0` disables this behavior (local dev default).
 */
@Injectable({ providedIn: 'root' })
export class AuthSessionExpiryService {
  private readonly auth = inject(Auth);
  private intervalId: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const maxMs = environment.authSessionMaxMs ?? 0;
    if (maxMs <= 0) {
      return;
    }

    onIdTokenChanged(this.auth, (user) => {
      if (user) {
        void this.enforceMaxSession(user, maxMs);
      }
    });

    this.intervalId = setInterval(() => {
      const u = this.auth.currentUser;
      if (u) {
        void this.enforceMaxSession(u, maxMs);
      }
    }, CHECK_INTERVAL_MS);
  }

  private async enforceMaxSession(user: User, maxMs: number): Promise<void> {
    try {
      const result = await getIdTokenResult(user, false);
      const authTimeMs = Date.parse(result.authTime);
      if (!Number.isFinite(authTimeMs)) {
        return;
      }
      if (Date.now() - authTimeMs <= maxMs) {
        return;
      }
      console.info(
        JSON.stringify({
          component: 'auth_session_expiry',
          action: 'sign_out_max_session',
          maxSessionMs: maxMs,
        }),
      );
      await signOut(this.auth);
    } catch {
      /* ignore — transient token errors */
    }
  }
}
