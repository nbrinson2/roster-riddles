import { inject, Injectable } from '@angular/core';
import { Firestore } from '@angular/fire/firestore';
import type { User } from 'firebase/auth';
import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore';
import { AuthService } from './auth.service';

const USERS = 'users';

/**
 * Ensures a `users/{uid}` profile exists after sign-in (contests / stats foundation).
 * First session: creates the document. Later sessions: updates auth-mirrored fields only
 * (never overwrites `createdAt`).
 */
@Injectable({ providedIn: 'root' })
export class UserBootstrapService {
  private readonly auth = inject(AuthService);
  private readonly firestore = inject(Firestore);

  constructor() {
    this.auth.user$.subscribe((user) => {
      if (user) {
        void this.syncUserDocument(user);
      }
    });
  }

  private async syncUserDocument(user: User): Promise<void> {
    const ref = doc(this.firestore, USERS, user.uid);
    try {
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        await setDoc(ref, {
          createdAt: serverTimestamp(),
          displayName: user.displayName ?? null,
          email: user.email ?? null,
          emailVerified: user.emailVerified,
          /** US-only contests: set later (self-attest, IP, or prompt). */
          region: null,
        });
        return;
      }
      await updateDoc(ref, {
        displayName: user.displayName ?? null,
        email: user.email ?? null,
        emailVerified: user.emailVerified,
      });
    } catch (err) {
      console.error('[UserBootstrapService] Failed to sync users/%s', user.uid, err);
    }
  }
}
