import type { User } from 'firebase/auth';

/** Part before `@`; if there is no `@`, returns trimmed `email` (or null if empty). */
export function emailLocalPart(email: string | null | undefined): string | null {
  if (email == null) {
    return null;
  }
  const t = email.trim();
  if (!t) {
    return null;
  }
  const at = t.indexOf('@');
  if (at <= 0) {
    return t;
  }
  const local = t.slice(0, at).trim();
  return local || null;
}

/**
 * Default visible / mirrored name: Auth `displayName` when non-empty, else email local part
 * (e.g. `nickbrinson2` from `nickbrinson2@gmail.com`), never provider ids.
 */
export function resolvedUserDisplayName(user: Pick<User, 'displayName' | 'email'>): string | null {
  const name = user.displayName?.trim();
  if (name) {
    return name;
  }
  return emailLocalPart(user.email);
}
