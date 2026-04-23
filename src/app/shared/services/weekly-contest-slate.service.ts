import { Injectable } from '@angular/core';
import {
  Timestamp,
  collection,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  where,
  type Firestore,
  type QueryDocumentSnapshot,
  type QuerySnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { BehaviorSubject, Observable, Subscription } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import { getConfiguredFirestore } from 'src/app/config/firestore-instance';
import {
  CONTEST_GAME_MODE_BIO_BALL,
  type ContestDocument,
} from 'src/app/shared/models/contest.model';
import type { ContestEntryDocument } from 'src/app/shared/models/contest-entry.model';
import { buildContestValuePropLine } from 'src/app/shared/contest/contest-value-prop';

/** Live mini-league progress for the active open contest the user joined (Bio Ball). */
export interface WeeklyContestSlateUi {
  contestId: string;
  contestTitle: string;
  leagueGamesN: number;
  gamesUsed: number;
  gamesRemaining: number;
  /** Prize / entry / lock line for the strip (from contest doc + window end). */
  valuePropLine: string;
  /** True when gameplayEvents query failed (e.g. missing index); user may still be entered. */
  progressUnavailable?: boolean;
  /** Play window [windowStart, windowEnd) has ended; contest may still be `open` until scoring. */
  windowEnded?: boolean;
}

function slateValuePropLine(contest: ContestDocument, we: Timestamp): string {
  return buildContestValuePropLine({
    windowEnd: we.toDate(),
    prizePoolCents: contest.prizePoolCents,
    entryFeeCents: contest.entryFeeCents,
    maxEntries: contest.maxEntries,
  });
}

function toTimestamp(value: unknown): Timestamp | null {
  if (value instanceof Timestamp) {
    return value;
  }
  if (
    value &&
    typeof value === 'object' &&
    'seconds' in value &&
    typeof (value as { seconds?: unknown }).seconds === 'number' &&
    typeof (value as { nanoseconds?: unknown }).nanoseconds === 'number'
  ) {
    const o = value as { seconds: number; nanoseconds: number };
    try {
      return new Timestamp(o.seconds, o.nanoseconds);
    } catch {
      return null;
    }
  }
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof (value as { toDate?: () => Date }).toDate === 'function'
  ) {
    try {
      const d = (value as { toDate: () => Date }).toDate();
      if (d instanceof Date && !Number.isNaN(d.getTime())) {
        return Timestamp.fromDate(d);
      }
    } catch {
      return null;
    }
  }
  if (typeof value === 'string' && value.trim()) {
    const d = new Date(value);
    if (!Number.isNaN(d.getTime())) {
      return Timestamp.fromDate(d);
    }
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Timestamp.fromMillis(value);
  }
  return null;
}

function normGameMode(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function normStatus(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function parseLeagueGamesN(raw: unknown): number {
  if (typeof raw === 'number' && Number.isFinite(raw) && raw > 0) {
    return Math.floor(raw);
  }
  if (typeof raw === 'string') {
    const x = Number.parseInt(raw.trim(), 10);
    if (Number.isFinite(x) && x > 0) {
      return x;
    }
  }
  return 10;
}

/**
 * User is entered in an open Bio Ball contest, but `now` is past `windowEnd` (status not yet advanced).
 */
function pickEnteredOpenBioBallWindowEnded(
  entryDocs: QueryDocumentSnapshot[],
  contestById: Map<string, ContestDocument>,
  nowMs: number,
):
  | {
      contestId: string;
      contest: ContestDocument;
      contestTitle: string;
      leagueGamesN: number;
    }
  | null {
  let best: {
    contestId: string;
    contest: ContestDocument;
    contestTitle: string;
    leagueGamesN: number;
    windowEndMs: number;
  } | null = null;

  for (const entrySnap of entryDocs) {
    const ent = entrySnap.data() as ContestEntryDocument;
    const c = contestById.get(ent.contestId);
    if (!c) {
      continue;
    }
    if (normStatus(c.status) !== 'open') {
      continue;
    }
    if (normGameMode(c.gameMode) !== CONTEST_GAME_MODE_BIO_BALL) {
      continue;
    }
    const ws = toTimestamp(c.windowStart);
    const we = toTimestamp(c.windowEnd);
    if (!ws || !we) {
      continue;
    }
    if (nowMs < ws.toMillis()) {
      continue;
    }
    if (nowMs < we.toMillis()) {
      continue;
    }
    const titleRaw =
      typeof c.title === 'string' ? c.title.trim() : '';
    const contestTitle = titleRaw || 'Bio Ball week';
    const n = parseLeagueGamesN(c.leagueGamesN);
    const row = {
      contestId: ent.contestId,
      contest: c,
      contestTitle,
      leagueGamesN: n,
      windowEndMs: we.toMillis(),
    };
    if (!best || row.windowEndMs > best.windowEndMs) {
      best = row;
    }
  }

  return best;
}

function maxTimestamp(a: Timestamp, b: Timestamp): Timestamp {
  return a.toMillis() >= b.toMillis() ? a : b;
}

@Injectable({ providedIn: 'root' })
export class WeeklyContestSlateService {
  private readonly slateSubject = new BehaviorSubject<WeeklyContestSlateUi | null>(
    null,
  );
  readonly slate$ = this.slateSubject.asObservable();

  /** At least one `contests` doc with `status === 'open'` and Bio Ball `gameMode` (for strip visibility). */
  private readonly hasOpenBioBallSubject = new BehaviorSubject<boolean>(false);
  readonly hasOpenBioBallContests$: Observable<boolean> =
    this.hasOpenBioBallSubject.asObservable();

  private authSub: Subscription | null = null;
  private openContestsUnsub: Unsubscribe | null = null;
  private gameplayUnsub: Unsubscribe | null = null;
  private currentUid: string | null = null;
  private lastOpenContestsSnap: QuerySnapshot | null = null;

  constructor(private readonly auth: AuthService) {
    this.attachOpenContestsListener();
    this.authSub = this.auth.user$.subscribe((user) => {
      this.currentUid = user?.uid ?? null;
      this.clearGameplayOnly();
      this.slateSubject.next(null);
      const db = getConfiguredFirestore();
      if (this.currentUid && this.lastOpenContestsSnap) {
        void this.onOpenContestsSnapshot(db, this.currentUid, this.lastOpenContestsSnap);
      }
    });
  }

  /**
   * Re-run slate resolution using the latest open-contests snapshot (re-fetches `entries/{uid}`).
   * Call after a successful contest join so the game strip updates without waiting for a contest
   * doc change (join only writes the entry subcollection).
   */
  refreshSlateAfterEntryChange(): void {
    const uid = this.currentUid;
    const snap = this.lastOpenContestsSnap;
    if (!uid || !snap) {
      return;
    }
    const db = getConfiguredFirestore();
    void this.onOpenContestsSnapshot(db, uid, snap);
  }

  /**
   * Listens to open contests (signed-in read). Updates {@link hasOpenBioBallContests$}; when a user
   * is signed in, runs `getDoc` each `contests/{id}/entries/{uid}`. Collection-group queries on
   * `entries` are denied by `firestore.rules` (catch-all under `contests/*`).
   */
  private attachOpenContestsListener(): void {
    const db = getConfiguredFirestore();
    const qOpen = query(
      collection(db, 'contests'),
      where('status', '==', 'open'),
      orderBy('windowStart', 'desc'),
      limit(40),
    );

    this.openContestsUnsub = onSnapshot(
      qOpen,
      (snap) => {
        this.lastOpenContestsSnap = snap;
        const hasBioBall = snap.docs.some((d) => {
          const c = d.data() as ContestDocument;
          return normGameMode(c.gameMode) === CONTEST_GAME_MODE_BIO_BALL;
        });
        this.hasOpenBioBallSubject.next(hasBioBall);
        const uid = this.currentUid;
        if (uid) {
          void this.onOpenContestsSnapshot(db, uid, snap);
        } else {
          this.clearGameplayOnly();
          this.slateSubject.next(null);
        }
      },
      (err) => {
        console.error(
          '[WeeklyContestSlateService] contests (open) listener failed',
          err,
        );
        this.hasOpenBioBallSubject.next(false);
        this.clearGameplayOnly();
        this.slateSubject.next(null);
      },
    );
  }

  private clearGameplayOnly(): void {
    if (this.gameplayUnsub) {
      this.gameplayUnsub();
      this.gameplayUnsub = null;
    }
  }

  private async onOpenContestsSnapshot(
    db: Firestore,
    uid: string,
    contestSnap: QuerySnapshot,
  ): Promise<void> {
    this.clearGameplayOnly();

    if (contestSnap.empty) {
      this.slateSubject.next(null);
      return;
    }

    const paired = await Promise.all(
      contestSnap.docs.map(async (cDoc) => {
        const contest = cDoc.data() as ContestDocument;
        const contestId = cDoc.id;
        if (normGameMode(contest.gameMode) !== CONTEST_GAME_MODE_BIO_BALL) {
          return null;
        }
        const entryRef = doc(db, 'contests', contestId, 'entries', uid);
        const entrySnap = await getDoc(entryRef);
        if (!entrySnap.exists()) {
          return null;
        }
        return { contestId, contest, entrySnap };
      }),
    );

    const rows = paired.filter(
      (x): x is NonNullable<(typeof paired)[number]> => x != null,
    );

    if (rows.length === 0) {
      this.slateSubject.next(null);
      return;
    }

    const contestById = new Map(
      rows.map((r) => [r.contestId, r.contest] as const),
    );
    const entryDocs = rows.map((r) => r.entrySnap);

    const now = Date.now();
    type Cand = {
      entrySnap: QueryDocumentSnapshot;
      contestId: string;
      contest: ContestDocument;
      windowEndMs: number;
    };
    const candidates: Cand[] = [];

    for (const row of rows) {
      const c = row.contest;
      if (normStatus(c.status) !== 'open') {
        continue;
      }
      const ws = toTimestamp(c.windowStart);
      const we = toTimestamp(c.windowEnd);
      if (!ws || !we) {
        continue;
      }
      if (now < ws.toMillis() || now >= we.toMillis()) {
        continue;
      }
      candidates.push({
        entrySnap: row.entrySnap,
        contestId: row.contestId,
        contest: c,
        windowEndMs: we.toMillis(),
      });
    }

    if (candidates.length === 0) {
      const ended = pickEnteredOpenBioBallWindowEnded(
        entryDocs,
        contestById,
        now,
      );
      if (ended) {
        const weEnded = toTimestamp(ended.contest.windowEnd);
        if (!weEnded) {
          this.slateSubject.next(null);
          return;
        }
        this.slateSubject.next({
          contestId: ended.contestId,
          contestTitle: ended.contestTitle,
          leagueGamesN: ended.leagueGamesN,
          gamesUsed: 0,
          gamesRemaining: 0,
          valuePropLine: slateValuePropLine(ended.contest, weEnded),
          progressUnavailable: true,
          windowEnded: true,
        });
        return;
      }
      this.slateSubject.next(null);
      return;
    }

    candidates.sort((a, b) => a.windowEndMs - b.windowEndMs);
    const picked = candidates[0]!;
    const entryData = picked.entrySnap.data() as ContestEntryDocument;
    const joinedAtTs = toTimestamp(entryData.joinedAt);
    if (!joinedAtTs) {
      this.slateSubject.next(null);
      return;
    }

    const ws = toTimestamp(picked.contest.windowStart);
    const we = toTimestamp(picked.contest.windowEnd);
    if (!ws || !we) {
      this.slateSubject.next(null);
      return;
    }

    const lowerBound = maxTimestamp(joinedAtTs, ws);
    const n = parseLeagueGamesN(picked.contest.leagueGamesN);

    const titleRaw =
      typeof picked.contest.title === 'string'
        ? picked.contest.title.trim()
        : '';
    const contestTitle = titleRaw || 'Bio Ball week';

    const eventsRef = collection(db, 'users', uid, 'gameplayEvents');
    const qGames = query(
      eventsRef,
      where('gameMode', '==', CONTEST_GAME_MODE_BIO_BALL),
      where('createdAt', '>=', lowerBound),
      where('createdAt', '<', we),
      orderBy('createdAt', 'asc'),
      limit(n + 1),
    );

    this.gameplayUnsub = onSnapshot(
      qGames,
      (gSnap) => {
        const used = Math.min(gSnap.size, n);
        this.slateSubject.next({
          contestId: picked.contestId,
          contestTitle,
          leagueGamesN: n,
          gamesUsed: used,
          gamesRemaining: n - used,
          valuePropLine: slateValuePropLine(picked.contest, we),
          progressUnavailable: false,
        });
      },
      (err) => {
        console.error(
          '[WeeklyContestSlateService] gameplayEvents listener failed',
          err,
        );
        this.slateSubject.next({
          contestId: picked.contestId,
          contestTitle,
          leagueGamesN: n,
          gamesUsed: 0,
          gamesRemaining: n,
          valuePropLine: slateValuePropLine(picked.contest, we),
          progressUnavailable: true,
        });
      },
    );
  }
}
