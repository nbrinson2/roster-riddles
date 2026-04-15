import { createHash } from 'node:crypto';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { getAdminFirestore } from './admin-firestore.js';

/** Max single-session duration we accept (48h). */
export const MAX_DURATION_MS = 48 * 60 * 60 * 1000;

/** Allowed clock skew for optional `clientOccurredAt` vs server time (24h). */
const CLIENT_TIME_SKEW_MS = 24 * 60 * 60 * 1000;

const gameModeEnum = z.enum(['bio-ball', 'career-path', 'nickname-streak']);
const resultEnum = z.enum(['won', 'lost', 'abandoned']);
const difficultyEnum = z.enum(['easy', 'hard', 'n/a']);
const deploymentEnum = z.enum(['development', 'staging', 'production']);

const modeMetricsSchema = z
  .record(z.union([z.string(), z.number(), z.boolean(), z.null()]))
  .optional();

export const gameplayEventBodySchema = z
  .object({
    schemaVersion: z.number().int().min(1).max(10_000),
    gameMode: gameModeEnum,
    result: resultEnum,
    durationMs: z.number().int().min(0).max(MAX_DURATION_MS),
    mistakeCount: z.number().int().min(0).max(1_000_000),
    clientSessionId: z.string().min(8).max(200),
    league: z.string().min(1).max(64).optional(),
    difficulty: difficultyEnum.optional(),
    clientOccurredAt: z.string().datetime().optional(),
    appVersion: z.string().max(128).optional(),
    deployment: deploymentEnum.optional(),
    modeMetrics: modeMetricsSchema,
  })
  .strict()
  .superRefine((data, ctx) => {
    if (data.clientOccurredAt) {
      const t = new Date(data.clientOccurredAt).getTime();
      const now = Date.now();
      if (t - now > CLIENT_TIME_SKEW_MS || now - t > CLIENT_TIME_SKEW_MS) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            'clientOccurredAt must be within 24 hours of server time (or omit it).',
          path: ['clientOccurredAt'],
        });
      }
    }
    if (data.modeMetrics !== undefined) {
      try {
        const s = JSON.stringify(data.modeMetrics);
        if (s.length > 16_384) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'modeMetrics JSON must be at most 16 KiB.',
            path: ['modeMetrics'],
          });
        }
      } catch {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'modeMetrics must be JSON-serializable.',
          path: ['modeMetrics'],
        });
      }
    }
  });

/**
 * Deterministic id so retries with the same `clientSessionId` hit the same document.
 * @param {string} uid
 * @param {string} clientSessionId
 */
export function computeGameplayEventId(uid, clientSessionId) {
  return createHash('sha256')
    .update(uid, 'utf8')
    .update('\x1e', 'utf8')
    .update(clientSessionId, 'utf8')
    .digest('hex');
}

/**
 * @param {import('firebase-admin/firestore').Timestamp | undefined} ts
 * @returns {string | undefined}
 */
function timestampToIso(ts) {
  if (!ts || typeof ts.toDate !== 'function') return undefined;
  try {
    return ts.toDate().toISOString();
  } catch {
    return undefined;
  }
}

/**
 * @param {Record<string, unknown>} data
 */
function echoFromStored(data) {
  const {
    schemaVersion,
    gameMode,
    result,
    durationMs,
    mistakeCount,
    clientSessionId,
    league,
    difficulty,
    clientOccurredAt,
    appVersion,
    deployment,
    modeMetrics,
    createdAt,
    uid,
  } = data;

  return {
    schemaVersion,
    gameMode,
    result,
    durationMs,
    mistakeCount,
    clientSessionId,
    ...(league !== undefined ? { league } : {}),
    ...(difficulty !== undefined ? { difficulty } : {}),
    ...(clientOccurredAt !== undefined
      ? { clientOccurredAt: timestampToIso(clientOccurredAt) }
      : {}),
    ...(appVersion !== undefined ? { appVersion } : {}),
    ...(deployment !== undefined ? { deployment } : {}),
    ...(modeMetrics !== undefined ? { modeMetrics } : {}),
    uid,
    createdAt: timestampToIso(createdAt),
  };
}

/**
 * POST /api/v1/me/gameplay-events — append-only event; idempotent on `clientSessionId`.
 * @type {import('express').RequestHandler}
 */
export async function postGameplayEvent(req, res) {
  const uid = req.user?.uid;
  if (!uid) {
    return res.status(401).json({
      error: { code: 'unauthorized', message: 'Missing authenticated user.' },
    });
  }

  let parsed;
  try {
    parsed = gameplayEventBodySchema.parse(req.body ?? {});
  } catch (err) {
    if (err instanceof z.ZodError) {
      return res.status(400).json({
        error: {
          code: 'validation_error',
          message: 'Request body failed validation.',
          details: err.flatten(),
        },
      });
    }
    throw err;
  }

  let db;
  try {
    db = getAdminFirestore();
  } catch (initErr) {
    console.error('[gameplay-events] Firestore init failed:', initErr);
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server cannot access Firestore.',
      },
    });
  }

  const eventId = computeGameplayEventId(uid, parsed.clientSessionId);
  const eventRef = db
    .collection('users')
    .doc(uid)
    .collection('gameplayEvents')
    .doc(eventId);

  const firestorePayload = {
    schemaVersion: parsed.schemaVersion,
    gameMode: parsed.gameMode,
    result: parsed.result,
    durationMs: parsed.durationMs,
    mistakeCount: parsed.mistakeCount,
    clientSessionId: parsed.clientSessionId,
    uid,
    createdAt: FieldValue.serverTimestamp(),
    ...(parsed.league !== undefined ? { league: parsed.league } : {}),
    ...(parsed.difficulty !== undefined ? { difficulty: parsed.difficulty } : {}),
    ...(parsed.clientOccurredAt !== undefined
      ? {
          clientOccurredAt: Timestamp.fromDate(
            new Date(parsed.clientOccurredAt),
          ),
        }
      : {}),
    ...(parsed.appVersion !== undefined ? { appVersion: parsed.appVersion } : {}),
    ...(parsed.deployment !== undefined
      ? { deployment: parsed.deployment }
      : {}),
    ...(parsed.modeMetrics !== undefined
      ? { modeMetrics: parsed.modeMetrics }
      : {}),
  };

  /** @type {Record<string, unknown> | null} */
  let existing = null;

  try {
    await db.runTransaction(async (tx) => {
      const snap = await tx.get(eventRef);
      if (snap.exists) {
        existing = snap.data() ?? null;
        return;
      }
      tx.set(eventRef, firestorePayload);
    });
  } catch (err) {
    console.error('[gameplay-events] transaction failed:', err?.message ?? err);
    return res.status(500).json({
      error: {
        code: 'write_failed',
        message: 'Could not record gameplay event.',
      },
    });
  }

  if (existing) {
    return res.status(200).json({
      eventId,
      idempotentReplay: true,
      event: echoFromStored(existing),
    });
  }

  const final = await eventRef.get();
  const data = final.data();
  if (!data) {
    return res.status(500).json({
      error: { code: 'read_failed', message: 'Event write succeeded but read failed.' },
    });
  }

  return res.status(201).json({
    eventId,
    event: echoFromStored(data),
  });
}
