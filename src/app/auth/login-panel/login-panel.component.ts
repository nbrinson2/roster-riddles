import { Component, EventEmitter, Output } from '@angular/core';
import { FormBuilder, Validators } from '@angular/forms';
import type { EmailVerificationPostSignUpPayload } from '../email-verification-post-signup.types';
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
export class LoginPanelComponent {
  @Output() readonly authSuccess = new EventEmitter<
    AuthSuccessDetail | undefined
  >();

  protected mode: 'signIn' | 'signUp' = 'signIn';
  protected submitting = false;
  protected errorMessage: string | null = null;
  protected resetMessage: string | null = null;

  protected readonly form = this.fb.nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required, Validators.minLength(6)]],
  });

  constructor(
    private readonly auth: AuthService,
    private readonly fb: FormBuilder
  ) {}

  protected setMode(mode: 'signIn' | 'signUp'): void {
    this.mode = mode;
    this.errorMessage = null;
    this.resetMessage = null;
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
