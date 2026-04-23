import { Component, EventEmitter, OnDestroy, OnInit, Output } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import { MatButtonToggleChange } from '@angular/material/button-toggle';
import { ActivatedRoute, Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';
import type { EmailVerificationPostSignUpPayload } from '../email-verification-post-signup.types';
import {
  SIGNUP_PASSWORD_MIN_LENGTH,
  signupConfirmMatchesPasswordValidator,
  signupPasswordChecklist,
  signupPasswordRulesValidator,
} from '../password-signup.util';
import { AuthService, type EmailSignUpOutcome } from '../auth.service';

/** Passed to the parent on successful auth so it can show post–sign-up messaging. */
export interface AuthSuccessDetail {
  postSignUpEmailVerification?: EmailVerificationPostSignUpPayload;
}

@Component({
  selector: 'login-panel',
  templateUrl: './login-panel.component.html',
  styleUrls: ['./login-panel.component.scss'],
  standalone: false,
})
export class LoginPanelComponent implements OnInit, OnDestroy {
  @Output() readonly authSuccess = new EventEmitter<
    AuthSuccessDetail | undefined
  >();

  protected mode: 'signIn' | 'signUp' = 'signIn';
  protected submitting = false;
  protected errorMessage: string | null = null;
  protected resetMessage: string | null = null;
  /** Sign-up only: reveal password fields. */
  protected showPassword = false;

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: [''],
  });

  protected readonly signupChecklist = signupPasswordChecklist;
  protected readonly signupMinLen = SIGNUP_PASSWORD_MIN_LENGTH;

  private readonly destroy$ = new Subject<void>();

  constructor(
    private readonly auth: AuthService,
    private readonly fb: FormBuilder,
    private readonly router: Router,
    private readonly route: ActivatedRoute,
  ) {}

  ngOnInit(): void {
    const signup = this.route.snapshot.queryParamMap.get('signup');
    if (signup === '1' || signup === 'true') {
      this.setMode('signUp', { syncUrl: false });
    }

    this.form.controls.password.valueChanges
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        if (this.mode === 'signUp') {
          this.form.controls.confirmPassword.updateValueAndValidity({
            emitEvent: false,
          });
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected onAuthModeChange(ev: MatButtonToggleChange): void {
    const v = ev.value as 'signIn' | 'signUp' | undefined;
    if (v && v !== this.mode) {
      this.setMode(v);
    }
  }

  protected setMode(
    mode: 'signIn' | 'signUp',
    opts: { syncUrl?: boolean } = {},
  ): void {
    const syncUrl = opts.syncUrl !== false;
    this.mode = mode;
    this.errorMessage = null;
    this.resetMessage = null;

    const pwd = this.form.controls.password;
    const confirm = this.form.controls.confirmPassword;

    if (mode === 'signUp') {
      pwd.setValidators([
        Validators.required,
        signupPasswordRulesValidator(),
      ]);
      confirm.setValidators([
        Validators.required,
        signupConfirmMatchesPasswordValidator(),
      ]);
    } else {
      pwd.setValidators([Validators.required, Validators.minLength(6)]);
      confirm.clearValidators();
      confirm.setValue('', { emitEvent: false });
      this.showPassword = false;
    }

    pwd.updateValueAndValidity({ emitEvent: false });
    confirm.updateValueAndValidity({ emitEvent: false });

    if (syncUrl) {
      void this.router.navigate([], {
        relativeTo: this.route,
        queryParams: { signup: mode === 'signUp' ? '1' : null },
        queryParamsHandling: 'merge',
        replaceUrl: true,
      });
    }
  }

  protected async submitEmailPassword(): Promise<void> {
    if (this.form.invalid || this.submitting) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage = null;
    this.resetMessage = null;
    this.submitting = true;

    const { email, password } = this.form.getRawValue();

    try {
      if (this.mode === 'signIn') {
        await this.auth.signInWithEmail(email, password);
        this.authSuccess.emit(undefined);
      } else {
        const outcome: EmailSignUpOutcome = await this.auth.signUpWithEmail(
          email,
          password,
        );
        this.authSuccess.emit({
          postSignUpEmailVerification: {
            verificationEmailSent: outcome === 'ok',
            email: email.trim(),
          },
        });
      }
    } catch (err) {
      this.errorMessage = this.auth.mapAuthError(err);
    } finally {
      this.submitting = false;
    }
  }

  protected async signInWithGoogle(): Promise<void> {
    this.errorMessage = null;
    this.resetMessage = null;
    this.submitting = true;
    try {
      await this.auth.signInWithGoogle();
      this.authSuccess.emit(undefined);
    } catch (err) {
      this.errorMessage = this.auth.mapAuthError(err);
    } finally {
      this.submitting = false;
    }
  }

  protected async sendReset(): Promise<void> {
    const email = this.form.controls.email.value?.trim();
    if (!email) {
      this.form.controls.email.markAsTouched();
      this.errorMessage = 'Enter your email above, then tap Forgot password.';
      return;
    }

    this.errorMessage = null;
    this.resetMessage = null;
    this.submitting = true;
    try {
      await this.auth.sendPasswordResetEmail(email);
      this.resetMessage = 'Check your email for a reset link.';
    } catch (err) {
      this.errorMessage = this.auth.mapAuthError(err);
    } finally {
      this.submitting = false;
    }
  }
}
