import { Injectable, inject } from '@angular/core';
import { Auth, authState } from '@angular/fire/auth';
import type { ActionCodeSettings, User } from 'firebase/auth';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
} from 'firebase/auth';
import { Observable, shareReplay } from 'rxjs';

/** Result of email/password sign-up after `createUserWithEmailAndPassword`. */
export type EmailSignUpOutcome = 'ok' | 'verification_email_failed';

/**
 * Firebase Authentication wrapper. Use `user$` for app-wide session state.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly auth = inject(Auth);

  /** Emits the current user or null; shared so subscribers do not multiply listeners. */
  readonly user$: Observable<User | null> = authState(this.auth).pipe(
    shareReplay({ bufferSize: 1, refCount: true })
  );

  signInWithEmail(email: string, password: string): Promise<void> {
    return signInWithEmailAndPassword(this.auth, email.trim(), password).then(
      () => undefined
    );
  }

  /**
   * Creates the account then asks Firebase to send a verification email.
   * Sign-up still succeeds if the verification send fails (e.g. rate limit); caller may show a warning.
   */
  async signUpWithEmail(
    email: string,
    password: string,
  ): Promise<EmailSignUpOutcome> {
    const cred = await createUserWithEmailAndPassword(
      this.auth,
      email.trim(),
      password,
    );
    try {
      await sendEmailVerification(cred.user, this.emailActionCodeSettings());
      return 'ok';
    } catch (err) {
      console.error(
        JSON.stringify({
          component: 'auth_service',
          action: 'sendEmailVerification',
          message: err instanceof Error ? err.message.slice(0, 200) : String(err),
        }),
      );
      return 'verification_email_failed';
    }
  }

  /** Resend verification for the signed-in email/password user (no-op if already verified). */
  async resendEmailVerification(): Promise<void> {
    const u = this.auth.currentUser;
    if (!u?.email || u.emailVerified) {
      return;
    }
    await sendEmailVerification(u, this.emailActionCodeSettings());
  }

  private emailActionCodeSettings(): ActionCodeSettings | undefined {
    if (typeof window === 'undefined') {
      return undefined;
    }
    const origin = window.location?.origin;
    if (typeof origin === 'string' && /^https?:\/\//.test(origin)) {
      const base = origin.replace(/\/$/, '');
      return {
        /** Must be listed under Firebase Auth → Authorized domains (same host as `base`). */
        url: `${base}/email-verified`,
        handleCodeInApp: false,
      };
    }
    return undefined;
  }

  signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    return signInWithPopup(this.auth, provider).then(() => undefined);
  }

  sendPasswordResetEmail(email: string): Promise<void> {
    return sendPasswordResetEmail(this.auth, email.trim());
  }

  signOut(): Promise<void> {
    return signOut(this.auth);
  }

  /** Maps Firebase Auth errors to short, user-facing messages (English). */
  mapAuthError(err: unknown): string {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? String((err as { code?: string }).code)
        : '';

    switch (code) {
      case 'auth/invalid-email':
        return 'That email address does not look valid.';
      case 'auth/user-disabled':
        return 'This account has been disabled.';
      case 'auth/user-not-found':
        return 'No account found with that email.';
      case 'auth/wrong-password':
        return 'Incorrect password.';
      case 'auth/invalid-credential':
      case 'auth/invalid-login-credentials':
        return 'Email or password is incorrect.';
      case 'auth/email-already-in-use':
        return 'An account already exists with that email.';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Try again later.';
      case 'auth/popup-closed-by-user':
        return 'Sign-in was cancelled.';
      case 'auth/account-exists-with-different-credential':
        return 'An account already exists with this email using a different sign-in method.';
      case 'auth/network-request-failed':
        return 'Network error. Check your connection and try again.';
      case 'auth/unauthorized-continue-uri':
        return 'Email link is misconfigured. Ask the site admin to add this domain in Firebase Auth authorized domains.';
      default:
        return 'Something went wrong. Please try again.';
    }
  }
}
