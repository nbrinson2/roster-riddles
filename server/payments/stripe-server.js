/**
 * Stripe server SDK — Phase 5 Story P5-C1.
 * Secret key from env only; never log full keys.
 * `STRIPE_SECRET_KEY` may be a path to a one-line file (same pattern as `resolveSecretFromEnv` elsewhere).
 * @see docs/payments/stripe.md
 */
import Stripe from 'stripe';
import { resolveSecretFromEnv } from '../lib/contest-internal-auth.js';

/** Lazy singleton — resettable in tests via {@link resetStripeClientForTests}. */
let stripeSingleton = null;
let initLogged = false;

/**
 * When `true`, `STRIPE_SECRET_KEY` must be set or the process exits on startup
 * (`validateStripeConfigAtStartup`) and payment routes must have a client.
 */
export function isContestsPaymentsEnabled() {
  return process.env.CONTESTS_PAYMENTS_ENABLED === 'true';
}

/**
 * Classify secret key for ops logs — **never** log the key itself.
 * @param {string | undefined} secretKey
 * @returns {'test' | 'live' | 'unknown' | null}
 */
export function getStripeSecretKeyMode(secretKey) {
  const k = typeof secretKey === 'string' ? secretKey.trim() : '';
  if (!k) {
    return null;
  }
  if (k.startsWith('sk_test_')) {
    return 'test';
  }
  if (k.startsWith('sk_live_')) {
    return 'live';
  }
  return 'unknown';
}

/**
 * Fail fast when payments are enabled in this deployment but Stripe is not configured.
 * Call once before `app.listen` (after `dotenv` loads).
 */
export function validateStripeConfigAtStartup() {
  if (!isContestsPaymentsEnabled()) {
    return;
  }
  const key = process.env.STRIPE_SECRET_KEY?.trim();
  if (!key) {
    console.error(
      JSON.stringify({
        component: 'stripe_server',
        severity: 'ERROR',
        message:
          'CONTESTS_PAYMENTS_ENABLED=true but STRIPE_SECRET_KEY is missing — set secret or disable payments.',
      }),
    );
    process.exit(1);
  }
}

/**
 * Returns a configured Stripe client, or `null` when payments are off and no key is set.
 * When {@link isContestsPaymentsEnabled} is true, the key must exist (startup validation).
 *
 * @returns {Stripe | null}
 */
export function getStripeClient() {
  const key = resolveSecretFromEnv('STRIPE_SECRET_KEY');
  if (!key) {
    if (isContestsPaymentsEnabled()) {
      throw new Error('STRIPE_SECRET_KEY required when CONTESTS_PAYMENTS_ENABLED=true');
    }
    return null;
  }
  if (!stripeSingleton) {
    stripeSingleton = new Stripe(key);
    if (!initLogged) {
      initLogged = true;
      console.log(
        JSON.stringify({
          component: 'stripe_server',
          message: 'stripe_client_initialized',
          stripeSecretKeyMode: getStripeSecretKeyMode(key),
        }),
      );
    }
  }
  return stripeSingleton;
}

/**
 * Express helper: 503 when payment routes need Stripe but the client is unavailable.
 */
export function sendStripeServiceUnavailable(res) {
  res.status(503).json({
    error: {
      code: 'stripe_not_configured',
      message: 'Contest payments are not configured on this server.',
    },
  });
}

/**
 * Safe snapshot for `GET /health` — no secret values (Story GL-D1 / GL-D2).
 * When payments are enabled but no key is resolved, `stripeSecretKeyMode` is **null** (should not happen after startup validation).
 *
 * @returns {{
 *   contestsPaymentsEnabled: boolean,
 *   stripeSecretKeyMode: 'test' | 'live' | 'unknown' | null,
 *   stripeWebhookSecretConfigured: boolean,
 * }}
 */
export function getStripeHealthFields() {
  const webhookSecret = resolveSecretFromEnv('STRIPE_WEBHOOK_SECRET');
  const stripeWebhookSecretConfigured = Boolean(
    typeof webhookSecret === 'string' && webhookSecret.trim() !== '',
  );
  const enabled = isContestsPaymentsEnabled();
  if (!enabled) {
    return {
      contestsPaymentsEnabled: false,
      stripeSecretKeyMode: null,
      stripeWebhookSecretConfigured,
    };
  }
  const key = resolveSecretFromEnv('STRIPE_SECRET_KEY');
  const mode = key ? getStripeSecretKeyMode(key) : null;
  return {
    contestsPaymentsEnabled: true,
    stripeSecretKeyMode: mode,
    stripeWebhookSecretConfigured,
  };
}

/** @internal */
export function resetStripeClientForTests() {
  stripeSingleton = null;
  initLogged = false;
}
