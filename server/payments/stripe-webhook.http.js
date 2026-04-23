/**
 * POST /api/v1/webhooks/stripe — Stripe webhook endpoint (Phase 5 Story P5-C2 + P5-E1–E3 + P5-H1 logs).
 * Requires raw body + `Stripe-Signature` header; verifies with STRIPE_WEBHOOK_SECRET.
 * @see docs/weekly-contests/weekly-contests-phase5-webhooks.md
 */
import { getAdminFirestore } from '../lib/admin-firestore.js';
import { resolveSecretFromEnv } from '../lib/contest-internal-auth.js';
import {
  emitContestWebhookFailureMetric,
  logStripeWebhookLine,
} from './contest-payments-observability.js';
import { processContestPaymentFailureWebhook } from './stripe-webhook-contest-payment-failure.js';
import { processContestPaymentRefundWebhook } from './stripe-webhook-contest-payment-refund.js';
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
    logStripeWebhookLine({
      severity: 'WARNING',
      requestId,
      outcome: 'webhook_secret_missing',
      httpStatus: 503,
      message: 'STRIPE_WEBHOOK_SECRET is not set',
    });
    emitContestWebhookFailureMetric({
      outcome: 'webhook_secret_missing',
      requestId,
    });
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
    logStripeWebhookLine({
      requestId,
      outcome: 'stripe_webhook_missing_signature',
      httpStatus: 400,
    });
    emitContestWebhookFailureMetric({
      outcome: 'stripe_webhook_missing_signature',
      requestId,
    });
    return res.status(400).json({
      error: {
        code: 'stripe_webhook_missing_signature',
        message: 'Missing Stripe-Signature header.',
      },
    });
  }

  const rawBody = req.body;
  if (!Buffer.isBuffer(rawBody)) {
    logStripeWebhookLine({
      severity: 'ERROR',
      requestId,
      outcome: 'invalid_body_type',
      httpStatus: 500,
      message:
        'Expected raw Buffer body — ensure express.raw runs before express.json',
    });
    emitContestWebhookFailureMetric({
      outcome: 'invalid_body_type',
      requestId,
    });
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
    logStripeWebhookLine({
      severity: 'WARNING',
      requestId,
      outcome: 'signature_verify_failed',
      httpStatus: 400,
      message: msg,
    });
    emitContestWebhookFailureMetric({
      outcome: 'signature_verify_failed',
      requestId,
    });
    return res.status(400).json({
      error: {
        code: 'stripe_webhook_invalid_signature',
        message: 'Signature verification failed.',
      },
    });
  }

  const contestPaymentSuccessTypes =
    event.type === 'checkout.session.completed' ||
    event.type === 'payment_intent.succeeded';
  const contestPaymentFailureTypes =
    event.type === 'payment_intent.payment_failed' ||
    event.type === 'checkout.session.async_payment_failed' ||
    event.type === 'checkout.session.expired';
  const contestRefundTypes =
    event.type === 'refund.updated' || event.type === 'charge.refunded';
  const contestPaymentTypes =
    contestPaymentSuccessTypes ||
    contestPaymentFailureTypes ||
    contestRefundTypes;

  if (isContestsPaymentsEnabled() && contestPaymentTypes) {
    try {
      const db = getAdminFirestore();
      if (contestPaymentSuccessTypes) {
        await processContestPaymentSuccessWebhook(db, event, requestId);
      } else if (contestPaymentFailureTypes) {
        await processContestPaymentFailureWebhook(db, event, requestId);
      } else {
        await processContestPaymentRefundWebhook(db, stripe, event, requestId);
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      logStripeWebhookLine({
        severity: 'ERROR',
        requestId,
        eventId: event.id,
        eventType: event.type,
        outcome: 'contest_payment_handler_failed',
        httpStatus: 500,
        message: msg,
      });
      emitContestWebhookFailureMetric({
        outcome: 'contest_payment_handler_failed',
        requestId,
        eventId: event.id,
        eventType: event.type,
      });
      return res.status(500).json({
        error: {
          code: 'stripe_webhook_internal_error',
          message: 'Webhook processing failed.',
        },
      });
    }
  } else {
    logStripeWebhookLine({
      requestId,
      outcome: 'received',
      eventId: event.id,
      eventType: event.type,
      ...(contestPaymentTypes && !isContestsPaymentsEnabled()
        ? { contestPaymentSkipped: 'payments_disabled' }
        : {}),
    });
  }

  return res.status(200).json({ received: true });
}
