/**
 * Local / CI: rebuild all `leaderboards/snapshots/boards/*` docs (Story E2).
 * Requires Firebase Admin credentials (same as Express).
 */
import 'dotenv/config';
import { rebuildAllLeaderboardSnapshots } from '../server/leaderboard-snapshot-job.js';

try {
  const r = await rebuildAllLeaderboardSnapshots();
  console.log(
    JSON.stringify({
      component: 'rebuild_leaderboard_snapshots_cli',
      ok: true,
      durationMs: r.durationMs,
      boards: r.boards,
    }),
  );
  process.exit(0);
} catch (e) {
  console.error(
    JSON.stringify({
      component: 'rebuild_leaderboard_snapshots_cli',
      ok: false,
      message: e instanceof Error ? e.message : String(e),
    }),
  );
  process.exit(1);
}
