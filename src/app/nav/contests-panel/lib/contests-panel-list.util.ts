import { Timestamp, type QuerySnapshot } from 'firebase/firestore';
import {
  CONTEST_GAME_MODE_BIO_BALL,
  type ContestDocument,
  type ContestStatus,
} from 'src/app/shared/models/contest.model';
import type { ContestListRow } from './contests-panel.types';

function parseOptionalNonNegInt(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) {
    return undefined;
  }
  return Math.floor(raw);
}

function parseOptionalPositiveInt(raw: unknown): number | undefined {
  if (typeof raw !== 'number' || !Number.isFinite(raw) || raw < 1) {
    return undefined;
  }
  return Math.floor(raw);
}

function firestoreValueToDate(value: unknown): Date | null {
  if (value instanceof Timestamp) {
    return value.toDate();
  }
  if (value && typeof value === 'object' && 'toDate' in value) {
    const fn = (value as { toDate?: () => Date }).toDate;
    if (typeof fn === 'function') {
      try {
        return fn.call(value);
      } catch {
        return null;
      }
    }
  }
  return null;
}

/** Map one `contests/{contestId}` document to a list row, or `null` if invalid / wrong shape. */
export function parseContestFirestoreRow(
  contestId: string,
  raw: unknown,
): ContestListRow | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) {
    return null;
  }
  const d = raw as ContestDocument & Record<string, unknown>;
  const status = d.status as ContestStatus;
  const gameMode = typeof d.gameMode === 'string' ? d.gameMode : '';
  const rulesVersion = d.rulesVersion as number | string;
  const leagueGamesN =
    typeof d.leagueGamesN === 'number' && Number.isFinite(d.leagueGamesN)
      ? d.leagueGamesN
      : NaN;
  const rawTitle = typeof d.title === 'string' ? d.title.trim() : '';
  const title = rawTitle && rawTitle !== contestId ? rawTitle : 'Bio Ball';

  const ws = firestoreValueToDate(d.windowStart);
  const we = firestoreValueToDate(d.windowEnd);
  if (!ws || !we || !status || Number.isNaN(leagueGamesN)) {
    return null;
  }

  const prizePoolCents = parseOptionalNonNegInt(d.prizePoolCents);
  const entryFeeCents = parseOptionalNonNegInt(d.entryFeeCents);
  const maxEntries = parseOptionalPositiveInt(d.maxEntries);

  return {
    contestId,
    status,
    gameMode,
    rulesVersion,
    title,
    leagueGamesN,
    windowStart: ws,
    windowEnd: we,
    ...(prizePoolCents !== undefined ? { prizePoolCents } : {}),
    ...(entryFeeCents !== undefined ? { entryFeeCents } : {}),
    ...(maxEntries !== undefined ? { maxEntries } : {}),
  };
}

/** Sort order for merged open / scheduled / paid contest list. */
export function sortContestsListRows(a: ContestListRow, b: ContestListRow): number {
  const pri = (s: ContestListRow) =>
    s.status === 'open' ? 0 : s.status === 'scheduled' ? 1 : 2;
  const dp = pri(a) - pri(b);
  if (dp !== 0) {
    return dp;
  }
  if (a.status === 'open' && b.status === 'open') {
    return a.windowEnd.getTime() - b.windowEnd.getTime();
  }
  if (a.status === 'paid' && b.status === 'paid') {
    return b.windowEnd.getTime() - a.windowEnd.getTime();
  }
  return a.windowStart.getTime() - b.windowStart.getTime();
}

/** Merge Firestore contest list snapshots into a single map (later snapshots overwrite on id). */
export function contestRowsByIdFromSnapshots(
  snaps: (QuerySnapshot | null)[],
): Map<string, ContestListRow> {
  const byId = new Map<string, ContestListRow>();
  for (const snap of snaps) {
    if (!snap) {
      continue;
    }
    snap.forEach((d) => {
      const parsed = parseContestFirestoreRow(d.id, d.data());
      if (parsed) {
        byId.set(parsed.contestId, parsed);
      }
    });
  }
  return byId;
}

export interface ContestsPanelRowFilterOptions {
  gameMode: string;
  maxCompletedContests: number;
}

/**
 * Keep one game mode, cap how many completed (`paid`) contests appear, then sort for the panel.
 */
export function filterRowsForContestsPanel(
  byId: Map<string, ContestListRow>,
  options: ContestsPanelRowFilterOptions,
): ContestListRow[] {
  const { gameMode, maxCompletedContests } = options;
  const bios = Array.from(byId.values()).filter((r) => r.gameMode === gameMode);
  const paidTop = bios
    .filter((r) => r.status === 'paid')
    .sort((a, b) => b.windowEnd.getTime() - a.windowEnd.getTime())
    .slice(0, maxCompletedContests);
  const paidKeep = new Set(paidTop.map((r) => r.contestId));
  const rowsFiltered = bios.filter(
    (r) => r.status !== 'paid' || paidKeep.has(r.contestId),
  );
  return rowsFiltered.sort(sortContestsListRows);
}

/**
 * When the contests panel list is empty, surface the earliest future scheduled Bio Ball contest
 * (if Firestore returned any in the scheduled snapshot) so the empty state can show “next opens …”.
 */
export function computeEarliestScheduledBioBallOpensLine(
  scheduledSnap: QuerySnapshot | null,
  nowMs: number,
): string | null {
  if (!scheduledSnap?.size) {
    return null;
  }
  let best: ContestListRow | null = null;
  for (const d of scheduledSnap.docs) {
    const row = parseContestFirestoreRow(d.id, d.data());
    if (!row || row.status !== 'scheduled') {
      continue;
    }
    if (row.gameMode !== CONTEST_GAME_MODE_BIO_BALL) {
      continue;
    }
    if (row.windowStart.getTime() <= nowMs) {
      continue;
    }
    if (!best || row.windowStart.getTime() < best.windowStart.getTime()) {
      best = row;
    }
  }
  if (!best) {
    return null;
  }
  const fmt = new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return `Next contest opens ${fmt.format(best.windowStart)} (${best.title}).`;
}
