/**
 * POST /api/v1/me/stripe/connect/onboarding — Phase 6 Story P6-B2.
 * Creates or reuses a Stripe Express connected account and returns a hosted Account Link URL.
 * @see docs/weekly-contests/weekly-contests-api-phase6.md
 * @see docs/weekly-contests/weekly-contests-schema-users-payouts.md (P6-C1 field names)
 */
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import Stripe from 'stripe';
import { z } from 'zod';
import { isContestJoinEmailVerifiedEnforced } from '../contests/contest-email-verified.js';
import { getAdminFirestore } from '../lib/admin-firestore.js';
import {
  getStripeClient,
  isContestsPaymentsEnabled,
  sendStripeServiceUnavailable,
} from './stripe-server.js';

const connectOnboardingBodySchema = z
  .object({
    forceAccountUpdate: z.boolean().optional(),
  })
  .strict();

/**
 * @param {Record<string, unknown>} payload
 */
function logStripeConnectOnboardingLine(payload) {
  const httpStatus = /** @type {number} */ (payload.httpStatus);
  const severity =
    httpStatus >= 500 ? 'ERROR' : httpStatus >= 400 ? 'WARNING' : 'INFO';
  const line = {
    component: 'stripe_connect_onboarding',
    severity,
    timestamp: new Date().toISOString(),
    ...payload,
  };
  const sink = severity === 'ERROR' ? console.error : console.log;
  sink(JSON.stringify(line));
}

/**
 * @param {string} originBase — no trailing slash
 */
export function buildStripeConnectAccountUrls(originBase) {
  const b = String(originBase ?? '').replace(/\/$/, '');
  return {
    refresh_url: `${b}/account/payout-setup?payout_setup=refresh`,
    return_url: `${b}/account/payout-setup?payout_setup=success`,
  };
}

/**
 * @param {Record<string, unknown>} account — Stripe Account object (subset)
 */
export function isStripeConnectProfileComplete(account) {
  const due = account.requirements;
  const currentlyDue =
    due && typeof due === 'object' && 'currently_due' in due
      ? /** @type {{ currently_due?: unknown }} */ (due).currently_due
      : undefined;
  const dueEmpty =
    !Array.isArray(currentlyDue) || currentlyDue.length === 0;
  return Boolean(
    account.details_submitted === true &&
      account.charges_enabled === true &&
      account.payouts_enabled === true &&
      dueEmpty,
  );
}

/**
 * @param {boolean} complete
 * @param {boolean} forceAccountUpdate
 * @returns {'account_onboarding' | 'account_update' | 'none'}
 */
export function resolveStripeConnectAccountLinkType(
  complete,
  forceAccountUpdate,
) {
  if (complete && forceAccountUpdate) {
    return 'account_update';
  }
  if (complete && !forceAccountUpdate) {
    return 'none';
  }
  return 'account_onboarding';
}

/**
 * @type {import('express').RequestHandler}
 */
export async function postStripeConnectOnboarding(req, res) {
  const startMs = Date.now();
  const requestId = req.requestId ?? 'unknown';
  const uid = req.user?.uid;
  if (!uid) {
    logStripeConnectOnboardingLine({
      requestId,
      httpStatus: 401,
      outcome: 'unauthenticated',
      latencyMs: Date.now() - startMs,
    });
    return res.status(401).json({
      error: { code: 'unauthenticated', message: 'Authentication required.' },
    });
  }

  if (isContestJoinEmailVerifiedEnforced() && req.user?.emailVerified !== true) {
    logStripeConnectOnboardingLine({
      requestId,
      uid,
      httpStatus: 403,
      outcome: 'email_not_verified',
      latencyMs: Date.now() - startMs,
    });
    return res.status(403).json({
      error: {
        code: 'email_not_verified',
        message:
          'Verify your email address before Connect onboarding. Use Profile to resend the verification link.',
      },
    });
  }

  const rl = await req.consumeStripeConnectOnboardingRateLimit?.();
  if (rl && rl.allowed === false) {
    const retry = rl.retryAfterSec ?? null;
    if (retry != null) {
      res.setHeader('Retry-After', String(retry));
    }
    logStripeConnectOnboardingLine({
      requestId,
      uid,
      httpStatus: 429,
      outcome: 'rate_limited',
      latencyMs: Date.now() - startMs,
    });
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many Connect onboarding requests.',
        ...(retry != null ? { retryAfterSec: retry } : {}),
      },
    });
  }

  if (!isContestsPaymentsEnabled()) {
    logStripeConnectOnboardingLine({
      requestId,
      uid,
      httpStatus: 503,
      outcome: 'payments_disabled',
      latencyMs: Date.now() - startMs,
    });
    return res.status(503).json({
      error: {
        code: 'contest_payments_disabled',
        message: 'Contest entry payments are not enabled on this server.',
      },
    });
  }

  /** @type {import('stripe').default | null} */
  let stripe;
  try {
    stripe = getStripeClient();
  } catch (e) {
    logStripeConnectOnboardingLine({
      requestId,
      uid,
      httpStatus: 503,
      outcome: 'stripe_key_missing',
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return sendStripeServiceUnavailable(res);
  }
  if (!stripe) {
    logStripeConnectOnboardingLine({
      requestId,
      uid,
      httpStatus: 503,
      outcome: 'stripe_unavailable',
      latencyMs: Date.now() - startMs,
    });
    return sendStripeServiceUnavailable(res);
  }

  const appOrigin = process.env.CONTESTS_CHECKOUT_APP_ORIGIN?.trim();
  if (!appOrigin) {
    logStripeConnectOnboardingLine({
      requestId,
      uid,
      httpStatus: 503,
      outcome: 'checkout_origin_missing',
      latencyMs: Date.now() - startMs,
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message:
          'Set CONTESTS_CHECKOUT_APP_ORIGIN to the public web app base URL (e.g. http://localhost:4300).',
      },
    });
  }
  const originBase = appOrigin.replace(/\/$/, '');
  const { refresh_url, return_url } = buildStripeConnectAccountUrls(originBase);

  const bodyParse = connectOnboardingBodySchema.safeParse(req.body ?? {});
  if (!bodyParse.success) {
    logStripeConnectOnboardingLine({
      requestId,
      uid,
      httpStatus: 400,
      outcome: 'validation_error',
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
  const forceAccountUpdate = bodyParse.data.forceAccountUpdate === true;

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logStripeConnectOnboardingLine({
      requestId,
      uid,
      httpStatus: 503,
      outcome: 'firestore_init_failed',
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server is not configured for contests.',
      },
    });
  }

  const userRef = db.doc(`users/${uid}`);
  let userSnap;
  try {
    userSnap = await userRef.get();
  } catch (e) {
    logStripeConnectOnboardingLine({
      requestId,
      uid,
      httpStatus: 500,
      outcome: 'user_read_failed',
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not load profile.' },
    });
  }

  const userData = userSnap.exists ? userSnap.data() : undefined;
  let stripeConnectAccountId =
    typeof userData?.stripeConnectAccountId === 'string'
      ? userData.stripeConnectAccountId.trim()
      : '';

  const country =
    process.env.STRIPE_CONNECT_DEFAULT_COUNTRY?.trim() || 'US';

  /** @type {import('stripe').Stripe.Account | null} */
  let account = null;

  const handleStripeError = (e, outcome) => {
    const msg = e instanceof Error ? e.message : String(e);
    const code =
      e instanceof Stripe.errors.StripeError ? e.code ?? e.type : undefined;
    logStripeConnectOnboardingLine({
      requestId,
      uid,
      httpStatus: 502,
      outcome,
      latencyMs: Date.now() - startMs,
      message: msg,
      stripeErrorCode: code,
    });
    return res.status(502).json({
      error: {
        code: 'stripe_connect_failed',
        message: 'Stripe request failed.',
      },
    });
  };

  try {
    if (stripeConnectAccountId) {
      try {
        account = await stripe.accounts.retrieve(stripeConnectAccountId);
      } catch (e) {
        if (
          e instanceof Stripe.errors.StripeError &&
          e.code === 'resource_missing'
        ) {
          await userRef.set(
            { stripeConnectAccountId: FieldValue.delete() },
            { merge: true },
          );
          stripeConnectAccountId = '';
          account = null;
        } else {
          return handleStripeError(e, 'stripe_account_retrieve_failed');
        }
      }
    }

    if (account) {
      const metaUid = account.metadata?.firebase_uid;
      if (metaUid != null && metaUid !== '' && metaUid !== uid) {
        logStripeConnectOnboardingLine({
          requestId,
          uid,
          httpStatus: 403,
          outcome: 'stripe_connect_metadata_mismatch',
          latencyMs: Date.now() - startMs,
        });
        return res.status(403).json({
          error: {
            code: 'stripe_connect_forbidden',
            message: 'Connected account is not linked to this user.',
          },
        });
      }
      if (!metaUid || metaUid === '') {
        await stripe.accounts.update(stripeConnectAccountId, {
          metadata: { firebase_uid: uid },
        });
        account = await stripe.accounts.retrieve(stripeConnectAccountId);
      }
    }

    if (!stripeConnectAccountId || !account) {
      const email =
        typeof req.user?.email === 'string' && req.user.email.trim() !== ''
          ? req.user.email.trim()
          : undefined;
      account = await stripe.accounts.create({
        type: 'express',
        country,
        ...(email ? { email } : {}),
        capabilities: {
          transfers: { requested: true },
        },
        metadata: {
          firebase_uid: uid,
        },
      });
      stripeConnectAccountId = account.id;
      await userRef.set(
        {
          stripeConnectAccountId,
          stripeConnectAccountType: 'express',
          stripeConnectCreatedAt: Timestamp.now(),
        },
        { merge: true },
      );
    }

    const acctObj = /** @type {Record<string, unknown>} */ (
      /** @type {unknown} */ (account)
    );
    const complete = isStripeConnectProfileComplete(acctObj);
    const linkType = resolveStripeConnectAccountLinkType(
      complete,
      forceAccountUpdate,
    );

    if (linkType === 'none') {
      logStripeConnectOnboardingLine({
        requestId,
        uid,
        httpStatus: 409,
        outcome: 'connect_already_complete',
        latencyMs: Date.now() - startMs,
        stripeConnectAccountId,
      });
      return res.status(409).json({
        error: {
          code: 'connect_already_complete',
          message:
            'Stripe Connect onboarding is already complete. Send {"forceAccountUpdate":true} to open hosted account updates (e.g. bank details).',
        },
      });
    }

    const accountLink = await stripe.accountLinks.create({
      account: stripeConnectAccountId,
      refresh_url,
      return_url,
      type: linkType,
      collection_options: { fields: 'eventually_due' },
    });

    logStripeConnectOnboardingLine({
      requestId,
      uid,
      httpStatus: 200,
      outcome: 'account_link_created',
      latencyMs: Date.now() - startMs,
      stripeConnectAccountId,
      linkType,
    });

    return res.status(200).json({
      schemaVersion: 1,
      url: accountLink.url,
    });
  } catch (e) {
    return handleStripeError(e, 'stripe_connect_unexpected');
  }
}
