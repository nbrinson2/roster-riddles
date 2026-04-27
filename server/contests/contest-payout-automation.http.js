/**
 * POST /api/internal/v1/contests/payout-automation/run — Phase 6 Scheduler batch.
 * Scans recent `paid` contests and runs the same engine as per-contest execute for each candidate.
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
import {
  contestEligibleForAutomatedPayoutSweep,
  contestMatchesGameModeFilter,
} from './contest-payout-automation.lib.js';
import { extractPayoutExecuteCredential } from './contest-payout-execute.http.js';

const bodySchema = z
  .object({
    /** Cloud Scheduler must send `scheduler`. */
    trigger: z.enum(['scheduler']),
    /** Max contests to run execute on this invocation (after filtering). */
    batchSize: z.number().int().min(1).max(50).optional(),
    /** Max `paid` contest docs to read (recent first) before filtering. */
    scanLimit: z.number().int().min(1).max(200).optional(),
    /** When set, only contests with this `gameMode` (e.g. `bio-ball`). */
    gameMode: z.string().min(1).max(64).optional(),
  })
  .strict();

const DEFAULT_BATCH_SIZE = 10;
const DEFAULT_SCAN_LIMIT = 50;

/**
 * @type {import('express').RequestHandler}
 */
export async function postContestPayoutAutomationRun(req, res) {
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
          'Prize payout automation is disabled until PAYOUT_OPERATOR_SECRET or CONTESTS_OPERATOR_SECRET is set.',
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

  const bodyParse = bodySchema.safeParse(req.body ?? {});
  if (!bodyParse.success) {
    logPayoutJobLine({
      requestId,
      outcome: 'validation_error',
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
    });
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid request body (require trigger: scheduler, optional batchSize, scanLimit, gameMode).',
        details: bodyParse.error.flatten(),
      },
    });
  }

  if (!isPayoutsAutomationEnabled()) {
    logPayoutJobLine({
      requestId,
      outcome: 'payouts_automation_disabled',
      httpStatus: 403,
      latencyMs: Date.now() - startMs,
    });
    return res.status(403).json({
      error: {
        code: 'payouts_automation_disabled',
        message:
          'Batch payout requires PAYOUTS_AUTOMATION_ENABLED=true (same gate as per-contest scheduler execute).',
      },
    });
  }

  if (!isContestsPaymentsEnabled()) {
    logPayoutJobLine({
      requestId,
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

  const batchSize = bodyParse.data.batchSize ?? DEFAULT_BATCH_SIZE;
  const scanLimit = bodyParse.data.scanLimit ?? DEFAULT_SCAN_LIMIT;
  const gameMode = bodyParse.data.gameMode;

  let qs;
  try {
    qs = await db
      .collection('contests')
      .where('status', '==', 'paid')
      .orderBy('windowStart', 'desc')
      .limit(scanLimit)
      .get();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    logPayoutJobLine({
      requestId,
      outcome: 'payout_automation_query_failed',
      httpStatus: 500,
      latencyMs: Date.now() - startMs,
      message: msg,
    });
    return res.status(500).json({
      error: {
        code: 'firestore_query_failed',
        message: 'Could not list paid contests for payout automation.',
        details: msg,
      },
    });
  }

  /** @type {string[]} */
  const candidateIds = [];
  for (const doc of qs.docs) {
    const data = doc.data();
    if (!contestEligibleForAutomatedPayoutSweep(data)) {
      continue;
    }
    if (!contestMatchesGameModeFilter(data, gameMode)) {
      continue;
    }
    candidateIds.push(doc.id);
    if (candidateIds.length >= batchSize) {
      break;
    }
  }

  logPayoutJobLine({
    requestId,
    outcome: 'payout_automation_run_start',
    httpStatus: 200,
    latencyMs: Date.now() - startMs,
    scanLimit,
    batchSize,
    candidatesFound: candidateIds.length,
    gameMode: gameMode ?? null,
  });

  /** @type {{ contestId: string; httpStatus: number; outcome: string }[]} */
  const results = [];

  for (const contestId of candidateIds) {
    const jobStart = Date.now();
    const result = await runContestPayoutExecuteJob({
      db,
      stripe,
      contestId,
      requestId,
      payoutJobId: undefined,
      startMs: jobStart,
    });
    const json = result.json;
    const outcome =
      typeof json.outcome === 'string'
        ? json.outcome
        : typeof json.error === 'object' &&
            json.error != null &&
            typeof /** @type {Record<string, unknown>} */ (json.error).code === 'string'
          ? String(/** @type {Record<string, unknown>} */ (json.error).code)
          : `http_${result.httpStatus}`;
    results.push({
      contestId,
      httpStatus: result.httpStatus,
      outcome,
    });
  }

  const latencyMs = Date.now() - startMs;
  logPayoutJobLine({
    requestId,
    outcome: 'payout_automation_run_complete',
    httpStatus: 200,
    latencyMs,
    processed: results.length,
  });

  return res.status(200).json({
    ok: true,
    schemaVersion: 1,
    scanLimit,
    batchSize,
    gameMode: gameMode ?? null,
    paidContestsScanned: qs.size,
    candidatesRun: results.length,
    results,
  });
}
