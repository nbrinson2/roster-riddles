import { Component, Input, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Firestore, doc, docData } from '@angular/fire/firestore';
import type { User } from 'firebase/auth';
import { Timestamp } from 'firebase/firestore';
import { map, of, startWith, switchMap } from 'rxjs';
import { AuthService } from 'src/app/auth/auth.service';
import {
  USER_STATS_DOC_ID,
  type UserStatsDocument,
  type UserStatsTotals,
} from 'src/app/shared/models/user-stats.model';

const MODE_UI: Record<string, { label: string; icon: string }> = {
  'bio-ball': { label: 'Bio-Ball', icon: 'sports_cricket' },
  'career-path': { label: 'Career Path', icon: 'timeline' },
  'nickname-streak': { label: 'Nickname Streak', icon: 'badge' },
};

type StatsState =
  | { status: 'signed-out' }
  | { status: 'loading' }
  | { status: 'ready'; data: UserStatsDocument | undefined };

@Component({
  selector: 'profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: false,
})
export class ProfileComponent {
  @Input() user: User | null = null;

  private readonly auth = inject(AuthService);
  private readonly firestore = inject(Firestore);

  readonly statsState = toSignal(
    this.auth.user$.pipe(
      switchMap((u) => {
        if (!u) {
          return of<StatsState>({ status: 'signed-out' });
        }
        const ref = doc(
          this.firestore,
          'users',
          u.uid,
          'stats',
          USER_STATS_DOC_ID,
        );
        return docData(ref).pipe(
          map(
            (raw) =>
              ({
                status: 'ready' as const,
                data: raw as UserStatsDocument | undefined,
              }) satisfies StatsState,
          ),
          startWith<StatsState>({ status: 'loading' }),
        );
      }),
    ),
    { initialValue: { status: 'signed-out' } satisfies StatsState },
  );

  readonly showStatsSection = computed(() => this.user != null);

  readonly statsLoading = computed(
    () => this.statsState().status === 'loading',
  );

  /** Firestore aggregate doc when loaded (`undefined` = no doc yet). */
  readonly statsDoc = computed(() => {
    const s = this.statsState();
    return s.status === 'ready' ? s.data : undefined;
  });

  formatMs(ms: number | null | undefined): string {
    if (ms == null || Number.isNaN(ms)) {
      return '—';
    }
    if (ms < 1000) {
      return `${ms} ms`;
    }
    const s = ms / 1000;
    return s >= 60
      ? `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`
      : `${s.toFixed(1)} s`;
  }

  totalsOrDefault(doc: UserStatsDocument | undefined): UserStatsTotals {
    const t = doc?.totals;
    return {
      gamesPlayed: t?.gamesPlayed ?? 0,
      wins: t?.wins ?? 0,
      losses: t?.losses ?? 0,
      abandoned: t?.abandoned ?? 0,
    };
  }

  /** Widths (0–100) for the W / L / A stacked bar. */
  outcomeWidths(t: UserStatsTotals): { w: number; l: number; a: number } {
    const g = t.gamesPlayed;
    if (!g) {
      return { w: 0, l: 0, a: 0 };
    }
    return {
      w: (100 * t.wins) / g,
      l: (100 * t.losses) / g,
      a: (100 * t.abandoned) / g,
    };
  }

  winRatePercent(t: UserStatsTotals): number | null {
    const g = t.gamesPlayed;
    if (!g) {
      return null;
    }
    return Math.round((100 * t.wins) / g);
  }

  modeLabel(key: string): string {
    return MODE_UI[key]?.label ?? this.titleCaseModeKey(key);
  }

  modeIcon(key: string): string {
    return MODE_UI[key]?.icon ?? 'extension';
  }

  private titleCaseModeKey(key: string): string {
    return key
      .split('-')
      .map((s) => (s ? s[0].toUpperCase() + s.slice(1) : s))
      .join(' ');
  }

  modesSortedByPlay(doc: UserStatsDocument): { key: string; value: UserStatsTotals }[] {
    const m = doc.totalsByMode;
    if (!m) {
      return [];
    }
    return Object.entries(m)
      .map(([key, value]) => ({
        key,
        value: {
          gamesPlayed: value?.gamesPlayed ?? 0,
          wins: value?.wins ?? 0,
          losses: value?.losses ?? 0,
          abandoned: value?.abandoned ?? 0,
        },
      }))
      .sort((a, b) => b.value.gamesPlayed - a.value.gamesPlayed);
  }

  formatFirestoreTime(value: unknown): string {
    if (!value) {
      return '—';
    }
    if (value instanceof Timestamp) {
      return value.toDate().toLocaleString();
    }
    if (
      typeof value === 'object' &&
      value !== null &&
      'toDate' in value &&
      typeof (value as { toDate: () => Date }).toDate === 'function'
    ) {
      try {
        return (value as Timestamp).toDate().toLocaleString();
      } catch {
        return '—';
      }
    }
    return '—';
  }
}
