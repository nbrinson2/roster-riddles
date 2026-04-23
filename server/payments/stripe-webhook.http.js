/**
 * POST /api/v1/webhooks/stripe — Stripe webhook endpoint (Phase 5 Story P5-C2 + P5-E1).
 * Requires raw body + `Stripe-Signature` header; verifies with STRIPE_WEBHOOK_SECRET.
 * @see docs/weekly-contests/weekly-contests-phase5-webhooks.md
 */
import { getAdminFirestore } from '../lib/admin-firestore.js';
import { resolveSecretFromEnv } from '../lib/contest-internal-auth.js';
import { processContestPaymentSuccessWebhook } from './stripe-webhook-contest-payment.js';
import {
  getStripeClient,
  isContestsPaymentsEnabled,
  sendStripeServiceUnavailable,
} from './stripe-server.js';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export async function postStripeWebhook(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const webhookSecret = resolveSecretFromEnv('STRIPE_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error(
      JSON.stringify({
        component: 'stripe_webhook',
        severity: 'WARN',
        requestId,
        outcome: 'webhook_secret_missing',
        message: 'STRIPE_WEBHOOK_SECRET is not set',
      }),
    );
    return res.status(503).json({
      error: {
        code: 'stripe_webhook_not_configured',
        message: 'Webhook endpoint is not configured.',
      },
    });
  }

  const stripe = getStripeClient();
  if (!stripe) {
    return sendStripeServiceUnavailable(res);
  }

  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    return res.status(400).json({
      error: {
        code: 'stripe_webhook_missing_signature',
        message: 'Missing Stripe-Signature header.',
      },
    });
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    console.error(
      JSON.stringify({
        component: 'stripe_webhook',
        severity: 'ERROR',
        requestId,
        outcome: 'invalid_body_type',
        message: 'Expected raw Buffer body — ensure express.raw runs before express.json',
      }),
    );
    return res.status(500).json({
      error: {
        code: 'stripe_webhook_misconfigured',
        message: 'Server misconfiguration.',
      },
    });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(
      JSON.stringify({
        component: 'stripe_webhook',
        severity: 'WARN',
        requestId,
        outcome: 'signature_verify_failed',
        message: msg,
      }),
    );
    return res.status(400).json({
      error: {
        code: 'stripe_webhook_invalid_signature',
        message: 'Signature verification failed.',
      },
    });
  }

  const contestPaymentTypes =
    event.type === 'checkout.session.completed' ||
    event.type === 'payment_intent.succeeded';

  if (isContestsPaymentsEnabled() && contestPaymentTypes) {
    try {
      const db = getAdminFirestore();
      await processContestPaymentSuccessWebhook(db, event, requestId);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(
        JSON.stringify({
          component: 'stripe_webhook',
          severity: 'ERROR',
          requestId,
          eventId: event.id,
          eventType: event.type,
          outcome: 'contest_payment_handler_failed',
          message: msg,
        }),
      );
      return res.status(500).json({
        error: {
          code: 'stripe_webhook_internal_error',
          message: 'Webhook processing failed.',
        },
      });
    }
  } else {
    console.log(
      JSON.stringify({
        component: 'stripe_webhook',
        requestId,
        outcome: 'received',
        eventId: event.id,
        eventType: event.type,
        ...(contestPaymentTypes && !isContestsPaymentsEnabled()
          ? { contestPaymentSkipped: 'payments_disabled' }
          : {}),
      }),
    );
  }

  return res.status(200).json({ received: true });
}
