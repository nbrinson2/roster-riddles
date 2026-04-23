/**
 * Best-effort client IP for rate limiting (trust proxy headers only when configured).
 */

/**
 * When `TRUST_PROXY_FOR_RATE_LIMIT=true`, the first hop in `X-Forwarded-For` is used
 * (typical behind Cloud Run / one reverse proxy). Otherwise `req.socket.remoteAddress`.
 * @param {import('express').Request} req
 * @returns {string}
 */
export function getClientIpForRateLimit(req) {
  const trust = process.env.TRUST_PROXY_FOR_RATE_LIMIT === 'true';
  if (trust) {
    const xff = req.headers['x-forwarded-for'];
    if (typeof xff === 'string' && xff.trim()) {
      const first = xff.split(',')[0]?.trim();
      if (first) return first.slice(0, 128);
    }
  }
  const ra = req.socket?.remoteAddress;
  return typeof ra === 'string' && ra ? ra.slice(0, 128) : 'unknown';
}
