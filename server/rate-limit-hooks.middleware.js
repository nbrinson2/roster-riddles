/**
 * Epic F — hooks for rate limiting; stub allows all traffic until a limiter is wired.
 * Attach before leaderboard (or other) handlers and call `req.consumeLeaderboardRateLimit()` inside the route.
 */

/**
 * @typedef {{ allowed: boolean, retryAfterSec?: number | null }} RateLimitResult
 */

/**
 * @type {import('express').RequestHandler}
 */
export function leaderboardRateLimitHookMiddleware(req, res, next) {
  /**
   * @returns {Promise<RateLimitResult>}
   */
  req.consumeLeaderboardRateLimit = async () =>
    Promise.resolve({ allowed: true, retryAfterSec: null });
  next();
}
