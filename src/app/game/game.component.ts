import { Component, computed, inject, DestroyRef } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { combineLatest, timer } from 'rxjs';
import {
  distinctUntilChanged,
  map,
  shareReplay,
} from 'rxjs/operators';
import { AuthService } from 'src/app/auth/auth.service';
import { GameType } from '../game/shared/constants/game.constants';
import { Difficulty } from '../nav/difficulty-toggle/difficulty-toggle.component';
import { SlideUpService } from '../shared/components/slide-up/slide-up.service';
import { GamePlayer } from '../shared/models/common-models';
import { GAME_SERVICE, GameService } from '../shared/utils/game-service.token';
import { RosterSelectionService } from './bio-ball/services/roster-selection/roster-selection.service';
import { Header } from './shared/common-attribute-header/common-attribute-header.component';
import { NicknameStreakPlayer } from './nickname-streak/models/nickname-streak.models';
import { BIO_GAME_CONTEST_STRIP_CONTEXT_LINE } from '../nav/contests-panel/shared/contest-engagement-copy';
import { environment } from 'src/environment';
import { contestStripNearLockLine } from '../nav/contests-panel/shared/contest-status-ui';
import {
  WeeklyContestSlateService,
  type WeeklyContestSlateUi,
} from '../shared/services/weekly-contest-slate.service';

@Component({
  selector: 'game',
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
  standalone: false
})
export class GameComponent {
  /** Template: `GameType.CAREER_PATH` etc. */
  protected readonly GameType = GameType;

  /** Matches contests panel / hero when `simulatedContestsUiEnabled` (dashed accent on strip). */
  protected readonly simulatedContestsUi = environment.simulatedContestsUiEnabled;

  /** Muted strip — simulated vs live builds (`simulatedContestsUiEnabled`). */
  protected get contestStripNoEntryValueLine(): string {
    return environment.simulatedContestsUiEnabled
      ? 'Simulated · free entry · check each card for prizes & lock times'
      : 'Prizes & fees on each contest card';
  }

  private readonly gameService = inject<GameService<GamePlayer>>(GAME_SERVICE);
  private readonly slideUpService = inject(SlideUpService);
  private readonly rosterSelectionService = inject(RosterSelectionService);
  private readonly weeklyContestSlate = inject(WeeklyContestSlateService);
  private readonly auth = inject(AuthService);
  private readonly destroyRef = inject(DestroyRef);

  /**
   * Show the weekly strip when any open Bio Ball contest exists or the user has slate data
   * (including post-open scoring / paid); see {@link WeeklyContestSlateService.showBioBallContestStrip$}.
   */
  protected readonly showBioBallContestStrip$ =
    this.weeklyContestSlate.showBioBallContestStrip$;

  /** Mobile-only: expanded “details” panel for the contest strip. */
  protected contestStripMobileExpanded = false;

  /** Pairs the strip with the nav calendar so users know where “my contests” lives. */
  protected readonly contestStripCalendarContextLine =
    BIO_GAME_CONTEST_STRIP_CONTEXT_LINE;

  /**
   * Native tooltip on slate progress — what counts as one finished game for the counter.
   */
  protected readonly contestSlateProgressFinishedTooltip =
    'What counts as a finished game: a win, a loss, or abandoning after you’ve made at least one guess.';

  /**
   * Gentle “near lock” line when few hours remain or few slate spots left (updates each minute).
   */
  protected readonly contestNearLockLine$ = combineLatest([
    this.weeklyContestSlate.slate$,
    timer(0, 60_000).pipe(map(() => Date.now())),
  ]).pipe(
    map(([slate, nowMs]) => contestStripNearLockLine(slate, nowMs)),
    distinctUntilChanged(),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  /**
   * Bio Ball contest strip: signed-out CTA, signed-in but no active entry, or active slate stats.
   */
  protected readonly bioBallContestStrip$ = combineLatest([
    this.auth.user$,
    this.weeklyContestSlate.slate$,
  ]).pipe(
    map(
      (
        [user, slate],
      ):
        | { variant: 'sign_in' }
        | { variant: 'verify_email' }
        | { variant: 'no_entry' }
        | { variant: 'active'; slate: WeeklyContestSlateUi } => {
        if (!user) {
          return { variant: 'sign_in' };
        }
        if (slate) {
          return { variant: 'active', slate };
        }
        if (user.emailVerified !== true) {
          return { variant: 'verify_email' };
        }
        return { variant: 'no_entry' };
      },
    ),
    shareReplay({ bufferSize: 1, refCount: true }),
  );

  constructor() {
    this.bioBallContestStrip$
      .pipe(
        map((strip) =>
          strip.variant === 'active'
            ? `active:${strip.slate.contestId}`
            : strip.variant,
        ),
        distinctUntilChanged(),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe(() => {
        this.contestStripMobileExpanded = false;
      });
  }

  protected toggleContestStripMobileExpanded(): void {
    this.contestStripMobileExpanded = !this.contestStripMobileExpanded;
  }

  readonly currentGameType = computed(() => this.gameService.currentGame());
  readonly currentGameMode = computed(() => this.gameService.currentGameMode());
  readonly showAttributeHeader = computed(() =>
    this.gameService.showAttributeHeader(),
  );
  readonly attributeHeaders = computed(() => this.gameService.attributeHeaders());
  readonly playerToGuess = computed(
    () => this.gameService.playerToGuess() as NicknameStreakPlayer,
  );
  readonly bestStreak = computed(() => this.gameService.bestStreak());
  readonly currentStreak = computed(() => this.gameService.currentStreak());

  protected startNewGame(): void {
    if (this.slideUpService.isVisible()) {
      this.slideUpService.hide(() => {
        this.gameService.startNewGame();
      });
      return;
    }

    this.gameService.startNewGame();
  }

  protected resetState(): void {
    this.slideUpService.hide();
    this.rosterSelectionService.resetRosterSelection();
  }
}

