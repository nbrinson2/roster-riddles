import {
  AbstractControl,
  ValidationErrors,
  ValidatorFn,
} from '@angular/forms';

/** App sign-up bar: stricter than Firebase’s 6-character minimum. */
export const SIGNUP_PASSWORD_MIN_LENGTH = 8;

/** At least this many character classes (lower, upper, digit, symbol) must be present. */
const SIGNUP_MIN_CHARACTER_CLASSES = 2;

export function signupPasswordCharacterClassCount(value: string): number {
  const v = value ?? '';
  return [
    /[a-z]/.test(v),
    /[A-Z]/.test(v),
    /\d/.test(v),
    /[^A-Za-z0-9]/.test(v),
  ].filter(Boolean).length;
}

/**
 * Sign-up password: length ≥ {@link SIGNUP_PASSWORD_MIN_LENGTH} and
 * {@link SIGNUP_MIN_CHARACTER_CLASSES}+ distinct character classes.
 */
export function signupPasswordRulesValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const v = String(control.value ?? '');
    if (v.length < SIGNUP_PASSWORD_MIN_LENGTH) {
      return {
        signupMinLength: {
          requiredLength: SIGNUP_PASSWORD_MIN_LENGTH,
          actualLength: v.length,
        },
      };
    }
    if (
      signupPasswordCharacterClassCount(v) < SIGNUP_MIN_CHARACTER_CLASSES
    ) {
      return { signupCharClasses: true };
    }
    return null;
  };
}

/** Compares confirm field to sibling `password` (same parent FormGroup). */
export function signupConfirmMatchesPasswordValidator(): ValidatorFn {
  return (control: AbstractControl): ValidationErrors | null => {
    const parent = control.parent;
    if (!parent) {
      return null;
    }
    const pw = String(parent.get('password')?.value ?? '');
    const cf = String(control.value ?? '');
    if (!cf) {
      return null;
    }
    return pw === cf ? null : { mismatch: true };
  };
}

export interface SignupPasswordChecklistItem {
  id: string;
  met: boolean;
  label: string;
}

/** Inline checklist for sign-up (expectations before submit). */
export function signupPasswordChecklist(password: string): SignupPasswordChecklistItem[] {
  const v = password ?? '';
  const classes = signupPasswordCharacterClassCount(v);
  return [
    {
      id: 'len',
      met: v.length >= SIGNUP_PASSWORD_MIN_LENGTH,
      label: `At least ${SIGNUP_PASSWORD_MIN_LENGTH} characters`,
    },
    {
      id: 'classes',
      met: classes >= SIGNUP_MIN_CHARACTER_CLASSES,
      label:
        'At least two of: lowercase, uppercase, numbers, symbols',
    },
  ];
}
