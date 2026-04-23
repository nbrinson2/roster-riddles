/** Payload for the post–sign-up “verify your email” callout in the shell nav. */
export interface EmailVerificationPostSignUpPayload {
  verificationEmailSent: boolean;
  email: string;
}
