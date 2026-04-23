/**
 * POST /api/internal/v1/leaderboard-snapshots/rebuild — Story E2 (secured cron hook).
 */
import { rebuildAllLeaderboardSnapshots } from './leaderboard-snapshot-job.js';
import { logLeaderboardSnapshotJobLine } from './leaderboard-snapshot-log.js';

function getCronSecret() {
  return process.env.LEADERBOARD_SNAPSHOT_CRON_SECRET?.trim() ?? '';
}

/**
 * @param {import('express').Request} req
 */
function extractBearerSecret(req) {
  const h = req.headers.authorization;
  if (typeof h !== 'string' || !h.startsWith('Bearer ')) return '';
  return h.slice('Bearer '.length).trim();
}

/**
 * @type {import('express').RequestHandler}
 */
export async function postRebuildLeaderboardSnapshots(req, res) {
  const requestId = req.requestId ?? 'unknown';
  const startMs = Date.now();
  const configured = getCronSecret();
  if (!configured) {
    logLeaderboardSnapshotJobLine({
      requestId,
      outcome: 'not_configured',
      latencyMs: Date.now() - startMs,
      message: 'LEADERBOARD_SNAPSHOT_CRON_SECRET is not set',
    });
    return res.status(503).json({
      error: {
        code: 'snapshot_rebuild_not_configured',
        message:
          'Snapshot rebuild is disabled until LEADERBOARD_SNAPSHOT_CRON_SECRET is configured.',
      },
    });
  }

  const provided =
    extractBearerSecret(req) ||
    (typeof req.headers['x-cron-secret'] === 'string'
      ? req.headers['x-cron-secret'].trim()
      : '');

  if (provided !== configured) {
    logLeaderboardSnapshotJobLine({
      requestId,
      outcome: 'unauthorized',
      latencyMs: Date.now() - startMs,
    });
    return res.status(401).json({
      error: {
        code: 'unauthorized',
        message: 'Invalid or missing rebuild credentials.',
      },
    });
  }

  try {
    const result = await rebuildAllLeaderboardSnapshots();
    logLeaderboardSnapshotJobLine({
      requestId,
      outcome: 'ok',
      latencyMs: result.durationMs,
      boardCount: result.boards.length,
      totalEntries: result.boards.reduce((a, b) => a + b.entryCount, 0),
    });
    return res.status(200).json({
      ok: true,
      durationMs: result.durationMs,
      boards: result.boards,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message.slice(0, 500) : String(err);
    logLeaderboardSnapshotJobLine({
      requestId,
      outcome: 'error',
      latencyMs: Date.now() - startMs,
      errorMessage: msg,
    });
    return res.status(500).json({
      error: {
        code: 'snapshot_rebuild_failed',
        message: 'Snapshot rebuild failed.',
      },
    });
  }
}
