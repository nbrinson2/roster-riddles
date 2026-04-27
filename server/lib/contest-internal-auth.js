import fs from 'node:fs';
import path from 'node:path';

/**
 * Shared secret for internal contest hooks (E1 close windows, E2 scoring, D1 transition).
 * Prefer dedicated cron secret; fall back to operator secret.
 */

/**
 * If `process.env[key]` points at an existing file (e.g. `./secrets/op.txt`), read UTF-8 contents.
 * Otherwise return the trimmed env value. Lets cron/operator secrets live in gitignored files.
 * @param {string} key
 * @returns {string}
 */
export function resolveSecretFromEnv(key) {
  const raw = process.env[key]?.trim() ?? '';
  if (!raw) return '';
  try {
    const resolved = path.isAbsolute(raw) ? raw : path.resolve(process.cwd(), raw);
    if (fs.existsSync(resolved) && fs.statSync(resolved).isFile()) {
      return fs.readFileSync(resolved, 'utf8').trim();
    }
  } catch {
    /* use raw string */
  }
  return raw;
}

export function getContestsOperatorOrCronSecret() {
  return (
    resolveSecretFromEnv('CONTEST_WINDOW_CRON_SECRET') ||
    resolveSecretFromEnv('CONTESTS_OPERATOR_SECRET') ||
    ''
  );
}

/**
 * Phase 6 P6-D2 — prize payout execute hook. Dedicated secret wins; else operator secret.
 */
export function getPayoutExecuteSecret() {
  return (
    resolveSecretFromEnv('PAYOUT_OPERATOR_SECRET') ||
    resolveSecretFromEnv('CONTESTS_OPERATOR_SECRET') ||
    ''
  );
}

/**
 * @param {import('express').Request} req
 */
export function extractBearerOrHeaderSecret(req) {
  const h = req.headers.authorization;
  if (typeof h === 'string' && h.startsWith('Bearer ')) {
    return h.slice('Bearer '.length).trim();
  }
  if (typeof req.headers['x-contest-window-cron-secret'] === 'string') {
    return req.headers['x-contest-window-cron-secret'].trim();
  }
  return '';
}
