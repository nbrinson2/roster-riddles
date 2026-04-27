/**
 * POST /api/internal/v1/contests/:contestId/payouts/execute — Phase 6 Story P6-D2 / P6-D3.
 * Operator / Scheduler: Stripe Transfers to winners + `payouts/final` + `ledgerEntries`.
 * @see docs/weekly-contests/weekly-contests-ops-p6-payout-execute.md
 * @see docs/weekly-contests/weekly-contests-phase6-ops.md
 */
import { z } from 'zod';
import { getPayoutExecuteSecret } from '../lib/contest-internal-auth.js';
import { getAdminFirestore } from '../lib/admin-firestore.js';
import {
  getStripeClient,
  isContestsPaymentsEnabled,
  sendStripeServiceUnavailable,
} from '../payments/stripe-server.js';
import { logPayoutJobLine } from '../payments/contest-payouts-observability.js';
import { runContestPayoutExecuteJob } from './contest-payout-execute.job.js';
import { isPayoutsAutomationEnabled } from './payouts-automation.js';

const contestIdParamSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const bodySchema = z
  .object({
    payoutJobId: z.string().min(8).max(200).optional(),
    /** Cloud Scheduler must send `scheduler`; omit or `operator` for manual / operator curl. */
    trigger: z.enum(['operator', 'scheduler']).optional(),
  })
  .strict();

/**
 * @param {import('express').Request} req
 */
function extractPayoutExecuteCredential(req) {
  const h = req.headers.authorization;
  if (typeof h === 'string' && h.startsWith('Bearer ')) {
    return h.slice('Bearer '.length).trim();
  }
  const x =
    (typeof req.headers['x-payout-operator-secret'] === 'string'
      ? req.headers['x-payout-operator-secret']
      : '') ||
    (typeof req.headers['x-contests-operator-secret'] === 'string'
      ? req.headers['x-contests-operator-secret']
      : '');
  return typeof x === 'string' ? x.trim() : '';
}

/**
 * @type {import('express').RequestHandler}
 */
export async function postContestPayoutExecute(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();

  const secret = getPayoutExecuteSecret();
  if (!secret) {
    logPayoutJobLine({
      requestId,
      outcome: 'not_configured',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message:
          'Prize payout execute is disabled until PAYOUT_OPERATOR_SECRET or CONTESTS_OPERATOR_SECRET is set.',
      },
    });
  }

  const provided = extractPayoutExecuteCredential(req);
  if (provided !== secret) {
    logPayoutJobLine({
      requestId,
      outcome: 'unauthorized',
      httpStatus: 401,
      latencyMs: Date.now() - startMs,
    });
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid or missing operator credentials.',
      },
    });
  }

  let contestIdRaw = req.params.contestId;
  if (typeof contestIdRaw !== 'string') {
    contestIdRaw = String(contestIdRaw ?? '');
  }
  contestIdRaw = decodeURIComponent(contestIdRaw.trim());
  const parsedId = contestIdParamSchema.safeParse(contestIdRaw);
  if (!parsedId.success) {
    logPayoutJobLine({
      requestId,
      outcome: 'invalid_contest_id',
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
    });
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid contest id.' },
    });
  }
  const contestId = parsedId.data;

  const bodyParse = bodySchema.safeParse(req.body ?? {});
  if (!bodyParse.success) {
    logPayoutJobLine({
      requestId,
      contestId,
      outcome: 'validation_error',
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
    });
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request body.',
        details: bodyParse.error.flatten(),
      },
    });
  }

  const trigger = bodyParse.data.trigger ?? 'operator';
  if (trigger === 'scheduler' && !isPayoutsAutomationEnabled()) {
    logPayoutJobLine({
      requestId,
      contestId,
      outcome: 'payouts_automation_disabled',
      httpStatus: 403,
      latencyMs: Date.now() - startMs,
    });
    return res.status(403).json({
      error: {
        code: 'payouts_automation_disabled',
        message:
          'Automated payout triggers require PAYOUTS_AUTOMATION_ENABLED=true on the server. Manual operator runs omit trigger or use trigger=operator.',
      },
    });
  }

  if (!isContestsPaymentsEnabled()) {
    logPayoutJobLine({
      requestId,
      contestId,
      outcome: 'payments_disabled',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
    });
    return res.status(503).json({
      error: {
        code: 'contest_payments_disabled',
        message: 'CONTESTS_PAYMENTS_ENABLED is not true.',
      },
    });
  }

  /** @type {import('stripe').default | null} */
  let stripe;
  try {
    stripe = getStripeClient();
  } catch (e) {
    logPayoutJobLine({
      requestId,
      contestId,
      outcome: 'stripe_key_error',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return sendStripeServiceUnavailable(res);
  }
  if (!stripe) {
    logPayoutJobLine({
      requestId,
      contestId,
      outcome: 'stripe_unavailable',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
    });
    return sendStripeServiceUnavailable(res);
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logPayoutJobLine({
      requestId,
      contestId,
      outcome: 'firestore_init_failed',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server is not configured for Firestore.',
      },
    });
  }

  const result = await runContestPayoutExecuteJob({
    db,
    stripe,
    contestId,
    requestId,
    payoutJobId: bodyParse.data.payoutJobId,
    startMs,
  });

  return res.status(result.httpStatus).json(result.json);
}
