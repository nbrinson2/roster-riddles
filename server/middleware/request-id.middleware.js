import { randomUUID } from 'node:crypto';

/**
 * Assigns `req.requestId` and echoes `X-Request-ID` on the response for log correlation.
 * Accepts inbound `X-Request-ID` when it looks like a safe opaque id (no secrets).
 * @type {import('express').RequestHandler}
 */
export function requestIdMiddleware(req, res, next) {
  const raw = req.headers['x-request-id'];
  const fromClient =
    typeof raw === 'string' && /^[\w-]{8,128}$/.test(raw.trim())
      ? raw.trim()
      : null;
  const id = fromClient ?? randomUUID();
  req.requestId = id;
  res.setHeader('X-Request-ID', id);
  next();
}
