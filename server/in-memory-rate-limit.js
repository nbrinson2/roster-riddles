/**
 * Fixed-window request counter per key (in-process). For single-instance / dev;
 * use Redis or API Gateway for multi-instance production if needed.
 */

/**
 * @param {{ maxRequests: number, windowMs: number }} opts
 */
export function createFixedWindowLimiter(opts) {
  const maxRequests = Math.max(1, opts.maxRequests);
  const windowMs = Math.max(1000, opts.windowMs);
  /** @type {Map<string, { count: number, windowStart: number }>} */
  const buckets = new Map();

  /**
   * @param {string} key
   * @returns {{ allowed: boolean, retryAfterSec: number | null }}
   */
  return function consume(key) {
    const now = Date.now();
    if (Math.random() < 0.02) {
      for (const [k, b] of buckets) {
        if (now - b.windowStart >= windowMs * 2) {
          buckets.delete(k);
        }
      }
    }

    let b = buckets.get(key);
    if (!b || now - b.windowStart >= windowMs) {
      buckets.set(key, { count: 1, windowStart: now });
      return { allowed: true, retryAfterSec: null };
    }
    if (b.count < maxRequests) {
      b.count += 1;
      return { allowed: true, retryAfterSec: null };
    }
    const retryMs = b.windowStart + windowMs - now;
    return {
      allowed: false,
      retryAfterSec: Math.max(1, Math.ceil(retryMs / 1000)),
    };
  };
}
