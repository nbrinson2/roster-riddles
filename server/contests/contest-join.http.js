/**
 * POST /api/v1/contests/:contestId/join — Story C1 (authenticated contest join);
 * Phase 5 Story P5-F1 — paid contests (`entryFeeCents > 0`): **409** `payment_required` unless entry is **`paid`** (Checkout + webhook path).
 * @see docs/weekly-contests/weekly-contests-api-c1.md
 * @see docs/weekly-contests/weekly-contests-phase5-entry-fees-adr.md
 */
import admin from 'firebase-admin';
import { FieldValue, Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';
import { fetchAuthFieldsForUids } from '../lib/auth-display-names.js';
import { getAdminFirestore } from '../lib/admin-firestore.js';
import { findBlockingOpenContestSameGameMode } from './contest-blocking-entry.js';
import { getEntryFeeCentsFromContest } from './contest-entry-fee.js';
import { classifyContestJoinPaymentPath } from './contest-join-payment-path.js';
import { logContestJoinLine } from './contest-join-log.js';
import { isContestJoinEmailVerifiedEnforced } from './contest-email-verified.js';

/** Phase 4 v1 — must match `ContestGameMode` / ADR. */
const BIO_BALL = 'bio-ball';

const contestJoinBodySchema = z
  .object({
    clientRequestId: z.string().min(8).max(200).optional(),
  })
  .strict();

const contestIdParamSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

/**
 * @param {unknown} ts
 * @returns {string | null}
 */
function timestampToIso(ts) {
  if (ts == null) return null;
  if (
    typeof ts === 'object' &&
    ts !== null &&
    'toDate' in ts &&
    typeof /** @type {{ toDate?: () => Date }} */ (ts).toDate === 'function'
  ) {
    return /** @type {{ toDate: () => Date }} */ (ts).toDate().toISOString();
  }
  return null;
}

/**
 * @param {FirebaseFirestore.DocumentData | undefined} c
 * @returns {c is Record<string, unknown>}
 */
function isRecord(c) {
  return c != null && typeof c === 'object' && !Array.isArray(c);
}

/**
 * @param {import('express').Response} res
 * @param {number} entryFeeCents
 * @param {string} requestId
 * @param {number} startMs
 * @param {string} contestId
 */
function respondPaymentRequired(res, entryFeeCents, requestId, startMs, contestId) {
  logContestJoinLine({
    requestId,
    httpStatus: 409,
    outcome: 'payment_required',
    latencyMs: Date.now() - startMs,
    contestId,
  });
  return res.status(409).json({
    error: {
      code: 'payment_required',
      message:
        'This contest has an entry fee. Complete Stripe Checkout first; your entry is created when payment succeeds (webhook). This endpoint only creates free entries.',
      entryFeeCents,
    },
  });
}

/**
 * @type {import('express').RequestHandler}
 */
export async function postContestJoin(req, res) {
  const startMs = Date.now();
  const requestId = req.requestId ?? 'unknown';
  const uid = req.user?.uid;
  if (!uid) {
    logContestJoinLine({
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
    logContestJoinLine({
      requestId,
      httpStatus: 403,
      outcome: 'email_not_verified',
      latencyMs: Date.now() - startMs,
    });
    return res.status(403).json({
      error: {
        code: 'email_not_verified',
        message:
          'Verify your email address before joining contests. Use Profile to resend the verification link, then try again.',
      },
    });
  }

  const rl = await req.consumeContestJoinRateLimit?.();
  if (rl && rl.allowed === false) {
    const retry = rl.retryAfterSec ?? null;
    if (retry != null) {
      res.setHeader('Retry-After', String(retry));
    }
    logContestJoinLine({
      requestId,
      httpStatus: 429,
      outcome: 'rate_limited',
      latencyMs: Date.now() - startMs,
    });
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many join requests.',
        ...(retry != null ? { retryAfterSec: retry } : {}),
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
    logContestJoinLine({
      requestId,
      httpStatus: 400,
      outcome: 'invalid_contest_id',
      latencyMs: Date.now() - startMs,
    });
    return res.status(400).json({
      error: {
        code: 'validation_error',
        message: 'Invalid contest id.',
      },
    });
  }
  const contestId = parsedId.data;

  const bodyParse = contestJoinBodySchema.safeParse(req.body ?? {});
  if (!bodyParse.success) {
    logContestJoinLine({
      requestId,
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
  const { clientRequestId } = bodyParse.data;

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logContestJoinLine({
      requestId,
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

  const contestRef = db.doc(`contests/${contestId}`);
  let contestSnap;
  try {
    contestSnap = await contestRef.get();
  } catch (e) {
    logContestJoinLine({
      requestId,
      httpStatus: 500,
      outcome: 'contest_read_failed',
      latencyMs: Date.now() - startMs,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not load contest.' },
    });
  }

  if (!contestSnap.exists) {
    logContestJoinLine({
      requestId,
      httpStatus: 404,
      outcome: 'contest_not_found',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(404).json({
      error: { code: 'contest_not_found', message: 'Contest not found.' },
    });
  }

  const contest = contestSnap.data();
  if (!isRecord(contest)) {
    logContestJoinLine({
      requestId,
      httpStatus: 500,
      outcome: 'contest_invalid_shape',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Contest data is invalid.' },
    });
  }

  const status = contest.status;
  if (status !== 'open') {
    logContestJoinLine({
      requestId,
      httpStatus: 400,
      outcome: 'contest_not_open',
      latencyMs: Date.now() - startMs,
      contestId,
      status: typeof status === 'string' ? status : null,
    });
    return res.status(400).json({
      error: {
        code: 'contest_not_open',
        message: 'Contest is not open for joining.',
      },
    });
  }

  const gameMode = contest.gameMode;
  if (gameMode !== BIO_BALL) {
    logContestJoinLine({
      requestId,
      httpStatus: 400,
      outcome: 'wrong_game_mode',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(400).json({
      error: {
        code: 'wrong_game_mode',
        message: 'This contest is not available for the current game mode.',
      },
    });
  }

  const leagueGamesN = contest.leagueGamesN;
  if (
    typeof leagueGamesN !== 'number' ||
    !Number.isFinite(leagueGamesN) ||
    leagueGamesN < 1 ||
    leagueGamesN > 10_000
  ) {
    logContestJoinLine({
      requestId,
      httpStatus: 500,
      outcome: 'contest_invalid_league_games',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Contest configuration is invalid.' },
    });
  }

  const rulesVersion = contest.rulesVersion;
  if (
    rulesVersion !== undefined &&
    typeof rulesVersion !== 'number' &&
    typeof rulesVersion !== 'string'
  ) {
    logContestJoinLine({
      requestId,
      httpStatus: 500,
      outcome: 'contest_invalid_rules_version',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Contest configuration is invalid.' },
    });
  }

  const ws = contest.windowStart;
  const we = contest.windowEnd;
  const now = Timestamp.now();
  if (
    !(ws instanceof Timestamp) ||
    !(we instanceof Timestamp) ||
    now.toMillis() < ws.toMillis() ||
    now.toMillis() >= we.toMillis()
  ) {
    logContestJoinLine({
      requestId,
      httpStatus: 400,
      outcome: 'join_window_closed',
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(400).json({
      error: {
        code: 'join_window_closed',
        message: 'Contest join window is not active.',
      },
    });
  }

  const entryFeeCents = getEntryFeeCentsFromContest(contest);

  const entryRef = db.doc(`contests/${contestId}/entries/${uid}`);
  let existingSnap;
  try {
    existingSnap = await entryRef.get();
  } catch (e) {
    logContestJoinLine({
      requestId,
      httpStatus: 500,
      outcome: 'entry_read_failed',
      latencyMs: Date.now() - startMs,
      contestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not check entry.' },
    });
  }

  if (existingSnap.exists) {
    const existing = existingSnap.data();
    const existingRecord = isRecord(existing) ? existing : undefined;
    if (
      classifyContestJoinPaymentPath(entryFeeCents, {
        exists: true,
        data: existingRecord,
      }) === 'payment_required'
    ) {
      return respondPaymentRequired(res, entryFeeCents, requestId, startMs, contestId);
    }
    logContestJoinLine({
      requestId,
      httpStatus: 200,
      outcome: 'ok',
      idempotentReplay: true,
      latencyMs: Date.now() - startMs,
      contestId,
    });
    return res.status(200).json({
      idempotentReplay: true,
      entry: formatEntryResponse(existing, contestId),
      contest: formatContestSummary(contest, contestId),
    });
  }

  let blockingContestId;
  try {
    blockingContestId = await findBlockingOpenContestSameGameMode(
      db,
      uid,
      contestId,
      typeof gameMode === 'string' ? gameMode : '',
    );
  } catch (e) {
    logContestJoinLine({
      requestId,
      httpStatus: 500,
      outcome: 'blocking_query_failed',
      latencyMs: Date.now() - startMs,
      contestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(500).json({
      error: {
        code: 'internal_error',
        message: 'Could not verify existing contest entries.',
      },
    });
  }

  if (blockingContestId) {
    logContestJoinLine({
      requestId,
      httpStatus: 409,
      outcome: 'already_in_open_contest',
      latencyMs: Date.now() - startMs,
      contestId,
      existingContestId: blockingContestId,
    });
    return res.status(409).json({
      error: {
        code: 'already_in_open_contest',
        message:
          'You are already entered in another open contest for this game type. You can only be in one open contest at a time per game type.',
        existingContestId: blockingContestId,
      },
    });
  }

  if (
    classifyContestJoinPaymentPath(entryFeeCents, { exists: false }) ===
    'payment_required'
  ) {
    return respondPaymentRequired(res, entryFeeCents, requestId, startMs, contestId);
  }

  let displayName = null;
  try {
    const auth = admin.auth();
    const m = await fetchAuthFieldsForUids([uid], auth);
    const row = m.get(uid);
    displayName = row?.displayName ?? null;
  } catch {
    displayName = null;
  }

  const entryPayload = {
    schemaVersion: 1,
    contestId,
    uid,
    rulesAcceptedVersion: rulesVersion ?? 1,
    joinedAt: FieldValue.serverTimestamp(),
    displayNameSnapshot: displayName,
    ...(clientRequestId ? { clientRequestId } : {}),
  };

  try {
    await entryRef.set(entryPayload);
  } catch (e) {
    logContestJoinLine({
      requestId,
      httpStatus: 500,
      outcome: 'entry_write_failed',
      latencyMs: Date.now() - startMs,
      contestId,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not record join.' },
    });
  }

  let written;
  try {
    written = await entryRef.get();
  } catch {
    written = null;
  }

  logContestJoinLine({
    requestId,
    httpStatus: 200,
    outcome: 'ok',
    idempotentReplay: false,
    latencyMs: Date.now() - startMs,
    contestId,
  });

  return res.status(200).json({
    idempotentReplay: false,
    entry: formatEntryResponse(written?.data(), contestId),
    contest: formatContestSummary(contest, contestId),
  });
}

/**
 * @param {FirebaseFirestore.DocumentData | undefined} data
 * @param {string} contestId
 */
function formatEntryResponse(data, contestId) {
  if (!data || typeof data !== 'object') {
    return {
      contestId,
      schemaVersion: 1,
    };
  }
  const d = /** @type {Record<string, unknown>} */ (data);
  return {
    schemaVersion: d.schemaVersion ?? 1,
    contestId: typeof d.contestId === 'string' ? d.contestId : contestId,
    uid: typeof d.uid === 'string' ? d.uid : undefined,
    rulesAcceptedVersion: d.rulesAcceptedVersion,
    joinedAt: timestampToIso(d.joinedAt),
    displayNameSnapshot:
      d.displayNameSnapshot === null || typeof d.displayNameSnapshot === 'string'
        ? d.displayNameSnapshot
        : null,
    clientRequestId:
      typeof d.clientRequestId === 'string' ? d.clientRequestId : undefined,
    paymentStatus:
      typeof d.paymentStatus === 'string' ? d.paymentStatus : undefined,
    entryFeeCentsSnapshot:
      typeof d.entryFeeCentsSnapshot === 'number' && Number.isFinite(d.entryFeeCentsSnapshot)
        ? d.entryFeeCentsSnapshot
        : undefined,
  };
}

/**
 * @param {Record<string, unknown>} contest
 * @param {string} contestId
 */
function formatContestSummary(contest, contestId) {
  return {
    contestId,
    status: contest.status,
    gameMode: contest.gameMode,
    rulesVersion: contest.rulesVersion,
    leagueGamesN: contest.leagueGamesN,
    windowStart: timestampToIso(contest.windowStart),
    windowEnd: timestampToIso(contest.windowEnd),
    title: typeof contest.title === 'string' ? contest.title : undefined,
  };
}
