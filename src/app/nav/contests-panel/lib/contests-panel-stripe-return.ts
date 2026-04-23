import type { Params } from '@angular/router';

/** Shown when user returns from Stripe Checkout with `checkout=cancel`. */
export const STRIPE_CHECKOUT_CANCELLED_USER_MESSAGE =
  'Payment was cancelled. You can review the rules and try again when you’re ready.';

export type StripeCheckoutReturn =
  | { kind: 'none' }
  | { kind: 'success'; contestId: string }
  | { kind: 'cancel'; contestId: string };

function firstQueryValue(
  params: Params,
  key: string,
): string | undefined {
  const v = params[key];
  if (v == null) {
    return undefined;
  }
  return Array.isArray(v) ? v[0] : v;
}

/**
 * Reads `checkout` + `contestId` from the current route (Stripe success/cancel redirect).
 * Caller strips query string from the URL after handling.
 */
export function parseStripeCheckoutReturnQuery(params: Params): StripeCheckoutReturn {
  const checkout = firstQueryValue(params, 'checkout');
  const rawId = firstQueryValue(params, 'contestId');
  if (checkout !== 'success' && checkout !== 'cancel') {
    return { kind: 'none' };
  }
  if (typeof rawId !== 'string' || !rawId.trim()) {
    return { kind: 'none' };
  }
  const contestId = decodeURIComponent(rawId.trim());
  if (checkout === 'success') {
    return { kind: 'success', contestId };
  }
  return { kind: 'cancel', contestId };
}
