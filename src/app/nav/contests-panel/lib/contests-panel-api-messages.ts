import { HttpErrorResponse } from '@angular/common/http';

function apiErrorBody(err: HttpErrorResponse): {
  code?: string;
  message?: string;
} {
  const body = err.error as { error?: { code?: string; message?: string } };
  return {
    code: body?.error?.code,
    message: body?.error?.message,
  };
}

/** User-facing message for `POST .../contests/:id/join` failures. */
export function mapContestJoinErrorMessage(err: HttpErrorResponse): string {
  const { code, message: msg } = apiErrorBody(err);
  if (err.status === 401) {
    return 'Sign in again, then retry.';
  }
  if (err.status === 429) {
    return 'Too many join attempts. Wait a moment and try again.';
  }
  if (err.status === 503) {
    return 'Contest join is unavailable (server not configured).';
  }
  if (err.status === 409 && code === 'already_in_open_contest') {
    return typeof msg === 'string'
      ? msg
      : 'You are already in another open contest for this game type. Finish or wait until it closes before joining a different one.';
  }
  if (err.status === 409 && code === 'payment_required') {
    return typeof msg === 'string'
      ? msg
      : 'This contest requires paid entry — use checkout from the contests panel.';
  }
  if (err.status === 0) {
    return 'Could not reach the server. Is the API running?';
  }
  switch (code) {
    case 'join_window_closed':
      return 'The join window is closed.';
    case 'contest_not_open':
      return 'This contest is not open for new entries.';
    case 'wrong_game_mode':
      return 'This contest is not available for Bio Ball in this build.';
    case 'contest_not_found':
      return 'That contest no longer exists.';
    case 'validation_error':
      return typeof msg === 'string' ? msg : 'Invalid request.';
    case 'rate_limited':
      return 'Too many join attempts. Try again shortly.';
    default:
      return typeof msg === 'string' ? msg : 'Could not join this contest.';
  }
}

/** User-facing message for `POST .../checkout-session` failures. */
export function mapContestCheckoutErrorMessage(err: HttpErrorResponse): string {
  const { code, message: msg } = apiErrorBody(err);
  if (err.status === 401) {
    return 'Sign in again, then retry.';
  }
  if (err.status === 429) {
    return 'Too many checkout attempts. Wait a moment and try again.';
  }
  if (err.status === 503 && code === 'contest_payments_disabled') {
    return typeof msg === 'string'
      ? msg
      : 'Paid entry is not enabled on this server.';
  }
  if (err.status === 503) {
    return typeof msg === 'string'
      ? msg
      : 'Checkout is unavailable (server configuration).';
  }
  if (err.status === 409 && code === 'already_in_open_contest') {
    return typeof msg === 'string'
      ? msg
      : 'You are already in another open contest for this game type.';
  }
  if (err.status === 409 && code === 'already_entered') {
    return typeof msg === 'string'
      ? msg
      : 'You already have an entry (or checkout in progress) for this contest.';
  }
  if (err.status === 502 && code === 'stripe_checkout_failed') {
    return 'Stripe could not start checkout. Try again in a moment.';
  }
  if (err.status === 0) {
    return 'Could not reach the server. Is the API running?';
  }
  switch (code) {
    case 'contest_no_entry_fee':
      return 'This contest has no entry fee — use the free join button instead.';
    case 'join_window_closed':
      return 'The entry window is closed.';
    case 'contest_not_open':
      return 'This contest is not open for new entries.';
    case 'wrong_game_mode':
      return 'This contest is not available for Bio Ball in this build.';
    case 'contest_not_found':
      return 'That contest no longer exists.';
    case 'validation_error':
      return typeof msg === 'string' ? msg : 'Invalid request.';
    default:
      return typeof msg === 'string'
        ? msg
        : 'Could not start checkout for this contest.';
  }
}
