/**
 * POST /api/v1/webhooks/stripe — Stripe webhook endpoint (Phase 5 Story P5-C2).
 * Requires raw body + `Stripe-Signature` header; verifies with STRIPE_WEBHOOK_SECRET.
 * Business logic (entries, ledger) lands in Story P5-E — this handler only verifies and ACKs.
 * @see docs/weekly-contests-phase5-webhooks.md
 */
import {
  getStripeClient,
  sendStripeServiceUnavailable,
} from './stripe-server.js';

/**
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 */
export function postStripeWebhook(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim();
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

  console.log(
    JSON.stringify({
      component: 'stripe_webhook',
      requestId,
      outcome: 'received',
      eventId: event.id,
      eventType: event.type,
    }),
  );

  return res.status(200).json({ received: true });
}
