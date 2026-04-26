/**
 * GET /api/v1/contests/:contestId/leaderboard — live mini-league standings while contest is **open**.
 * Phase 1 — same computation as E2 (`computeStandingsForEntryDocs`); read-only, no auth required.
 */
import { z } from 'zod';
import { Timestamp } from 'firebase-admin/firestore';
import { getAdminFirestore } from '../lib/admin-firestore.js';
import { firestoreTimestampToIso } from '../lib/firestore-timestamp-iso.js';
import { EVENT_SOURCE, TIE_BREAK_POLICY } from './contest-scoring-core.js';
import { computeStandingsForEntryDocs } from './contest-standings-compute.js';
import { logContestLiveLeaderboardLine } from './contest-live-leaderboard-log.js';

const contestIdParamSchema = z
  .string()
  .min(1)
  .max(128)
  .regex(/^[a-zA-Z0-9_-]+$/);

const BIO_BALL = 'bio-ball';

/** Hard cap on entrants read per request (cost guard). */
export const CONTEST_LIVE_LEADERBOARD_MAX_ENTRANTS = 500;

/**
 * @type {import('express').RequestHandler}
 */
export async function getContestLiveLeaderboard(req, res) {
  const startMs = Date.now();
  const requestId = req.requestId ?? 'unknown';

  const rl = await req.consumeContestLiveLeaderboardRateLimit?.();
  if (rl && rl.allowed === false) {
    const retry = rl.retryAfterSec ?? null;
    if (retry != null) {
      res.setHeader('Retry-After', String(retry));
    }
    logContestLiveLeaderboardLine({
      requestId,
      outcome: 'rate_limited',
      httpStatus: 429,
      latencyMs: Date.now() - startMs,
      contestId: null,
      rowCount: 0,
    });
    return res.status(429).json({
      error: {
        code: 'rate_limited',
        message: 'Too many requests.',
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
    logContestLiveLeaderboardLine({
      requestId,
      outcome: 'invalid_contest_id',
      httpStatus: 400,
      latencyMs: Date.now() - startMs,
      contestId: null,
      rowCount: 0,
    });
    return res.status(400).json({
      error: { code: 'validation_error', message: 'Invalid contest id.' },
    });
  }
  const contestId = parsedId.data;

  let db;
  try {
    db = getAdminFirestore();
  } catch (e) {
    logContestLiveLeaderboardLine({
      requestId,
      outcome: 'firestore_init_failed',
      httpStatus: 503,
      latencyMs: Date.now() - startMs,
      contestId,
      rowCount: 0,
      message: e instanceof Error ? e.message : String(e),
    });
    return res.status(503).json({
      error: {
        code: 'server_misconfigured',
        message: 'Server is not configured for Firestore.',
      },
    });
  }

  try {
    const contestRef = db.doc(`contests/${contestId}`);
    const contestSnap = await contestRef.get();
    if (!contestSnap.exists) {
      logContestLiveLeaderboardLine({
        requestId,
        outcome: 'contest_not_found',
        httpStatus: 404,
        latencyMs: Date.now() - startMs,
        contestId,
        rowCount: 0,
      });
      return res.status(404).json({
        error: { code: 'contest_not_found', message: 'Contest not found.' },
      });
    }

    const contest = contestSnap.data();
    if (contest == null || typeof contest !== 'object' || Array.isArray(contest)) {
      return res.status(500).json({
        error: { code: 'internal_error', message: 'Invalid contest document.' },
      });
    }

    const status = contest.status;
    if (status !== 'open') {
      logContestLiveLeaderboardLine({
        requestId,
        outcome: 'contest_not_open',
        httpStatus: 400,
        latencyMs: Date.now() - startMs,
        contestId,
        rowCount: 0,
        status: typeof status === 'string' ? status : null,
      });
      return res.status(400).json({
        error: {
          code: 'contest_not_open',
          message:
            'Live standings are only available while the contest is open. Use results after close.',
        },
      });
    }

    if (contest.gameMode !== BIO_BALL) {
      logContestLiveLeaderboardLine({
        requestId,
        outcome: 'wrong_game_mode',
        httpStatus: 400,
        latencyMs: Date.now() - startMs,
        contestId,
        rowCount: 0,
      });
      return res.status(400).json({
        error: {
          code: 'wrong_game_mode',
          message: 'This contest is not available for Bio Ball in this API version.',
        },
      });
    }

    const leagueGamesN = contest.leagueGamesN;
    if (typeof leagueGamesN !== 'number' || !Number.isFinite(leagueGamesN) || leagueGamesN < 1) {
      return res.status(500).json({
        error: { code: 'internal_error', message: 'Invalid leagueGamesN.' },
      });
    }

    const ws = contest.windowStart;
    const we = contest.windowEnd;
    if (!(ws instanceof Timestamp) || !(we instanceof Timestamp)) {
      return res.status(500).json({
        error: { code: 'internal_error', message: 'Invalid contest window timestamps.' },
      });
    }

    const entriesSnap = await db
      .collection(`contests/${contestId}/entries`)
      .limit(CONTEST_LIVE_LEADERBOARD_MAX_ENTRANTS)
      .get();

    const entrantsCapped = entriesSnap.size >= CONTEST_LIVE_LEADERBOARD_MAX_ENTRANTS;

    const standings = await computeStandingsForEntryDocs(
      db,
      { windowStart: ws, windowEnd: we, leagueGamesN },
      entriesSnap.docs,
    );

    const computedAtIso = new Date().toISOString();
    const windowStartIso = firestoreTimestampToIso(ws);
    const windowEndIso = firestoreTimestampToIso(we);

    logContestLiveLeaderboardLine({
      requestId,
      outcome: 'ok',
      httpStatus: 200,
      latencyMs: Date.now() - startMs,
      contestId,
      rowCount: standings.length,
      entrantsCapped,
    });

    return res.status(200).json({
      schemaVersion: 1,
      contestId,
      status: 'open',
      gameMode: BIO_BALL,
      leagueGamesN,
      windowStart: windowStartIso,
      windowEnd: windowEndIso,
      computedAt: computedAtIso,
      tieBreakPolicy: TIE_BREAK_POLICY,
      eventSource: EVENT_SOURCE,
      entrantsConsidered: entriesSnap.size,
      entrantsCapped,
      standings,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message.slice(0, 500) : String(e);
    logContestLiveLeaderboardLine({
      requestId,
      outcome: 'query_failed',
      httpStatus: 500,
      latencyMs: Date.now() - startMs,
      contestId,
      rowCount: 0,
      message: msg,
    });
    return res.status(500).json({
      error: { code: 'internal_error', message: 'Could not compute live standings.' },
    });
  }
}
