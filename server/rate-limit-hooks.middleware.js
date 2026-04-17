/**
 * Story F1 — rate limits (Express). In-memory fixed window per IP (leaderboards) / per uid (gameplay).
 * @see docs/leaderboards-rate-limits-f1.md
 */
import { getClientIpForRateLimit } from './client-ip.js';
import { createFixedWindowLimiter } from './in-memory-rate-limit.js';

/**
 * @typedef {{ allowed: boolean, retryAfterSec?: number | null }} RateLimitResult
 */

function parsePositiveInt(raw, fallback) {
  const n = Number.parseInt(String(raw ?? ''), 10);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return n;
}

function rateLimitsGloballyDisabled() {
  return process.env.RATE_LIMITS_DISABLED === 'true';
}

const leaderboardWindowMs = parsePositiveInt(
  process.env.LEADERBOARD_RATE_LIMIT_WINDOW_MS,
  60_000,
);
const leaderboardMax = parsePositiveInt(
  process.env.LEADERBOARD_RATE_LIMIT_MAX,
  90,
);

const gameplayWindowMs = parsePositiveInt(
  process.env.GAMEPLAY_EVENT_RATE_LIMIT_WINDOW_MS,
  60_000,
);
const gameplayMax = parsePositiveInt(
  process.env.GAMEPLAY_EVENT_RATE_LIMIT_MAX,
  30,
);

const leaderboardConsume = createFixedWindowLimiter({
  maxRequests: leaderboardMax,
  windowMs: leaderboardWindowMs,
});

const gameplayConsume = createFixedWindowLimiter({
  maxRequests: gameplayMax,
  windowMs: gameplayWindowMs,
});

const contestJoinWindowMs = parsePositiveInt(
  process.env.CONTEST_JOIN_RATE_LIMIT_WINDOW_MS,
  60_000,
);
const contestJoinMax = parsePositiveInt(
  process.env.CONTEST_JOIN_RATE_LIMIT_MAX,
  30,
);

const contestJoinConsume = createFixedWindowLimiter({
  maxRequests: contestJoinMax,
  windowMs: contestJoinWindowMs,
});

/**
 * @type {import('express').RequestHandler}
 */
export function leaderboardRateLimitHookMiddleware(req, res, next) {
  /**
   * @returns {Promise<RateLimitResult>}
   */
  req.consumeLeaderboardRateLimit = async () => {
    if (rateLimitsGloballyDisabled()) {
      return { allowed: true, retryAfterSec: null };
    }
    const ip = getClientIpForRateLimit(req);
    return leaderboardConsume(`lb:${ip}`);
  };
  next();
}

/**
 * Must run **after** `requireFirebaseAuth` so `req.user.uid` exists.
 * @type {import('express').RequestHandler}
 */
export function gameplayEventRateLimitHookMiddleware(req, res, next) {
  /**
   * @returns {Promise<RateLimitResult>}
   */
  req.consumeGameplayEventRateLimit = async () => {
    if (rateLimitsGloballyDisabled()) {
      return { allowed: true, retryAfterSec: null };
    }
    const uid = req.user?.uid;
    if (!uid) {
      return { allowed: true, retryAfterSec: null };
    }
    return gameplayConsume(`gp:${uid}`);
  };
  next();
}

/**
 * After `requireFirebaseAuth` — per-uid fixed window (Story C1).
 * @type {import('express').RequestHandler}
 */
export function contestJoinRateLimitHookMiddleware(req, res, next) {
  /**
   * @returns {Promise<RateLimitResult>}
   */
  req.consumeContestJoinRateLimit = async () => {
    if (rateLimitsGloballyDisabled()) {
      return { allowed: true, retryAfterSec: null };
    }
    const uid = req.user?.uid;
    if (!uid) {
      return { allowed: true, retryAfterSec: null };
    }
    return contestJoinConsume(`cj:${uid}`);
  };
  next();
}
