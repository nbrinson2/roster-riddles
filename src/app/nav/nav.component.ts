import {
  Component,
  computed,
  Inject,
  OnDestroy,
  OnInit,
  Signal,
  ViewChild,
} from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import type { User } from 'firebase/auth';
import { filter, Subject, takeUntil } from 'rxjs';
import { AuthService } from '../auth/auth.service';
import {
  AttributesType,
  TeamFullName,
  UiPlayer,
} from '../game/bio-ball/models/bio-ball.models';
import { RosterSelectionService } from '../game/bio-ball/services/roster-selection/roster-selection.service';
import { CareerPathPlayer } from '../game/career-path/models/career-path.models';
import { NicknameStreakEngineService } from '../game/nickname-streak/services/nickname-streak-engine.service';
import { GameType } from '../game/shared/constants/game.constants';
import { HintService } from '../shared/components/hint/hint.service';
import { SlideUpService } from '../shared/components/slide-up/slide-up.service';
import { GamePlayer } from '../shared/models/common-models';
import { GameplayTelemetryService } from '../shared/services/gameplay-telemetry/gameplay-telemetry.service';
import { GAME_SERVICE, GameService } from '../shared/utils/game-service.token';
import { Difficulty } from './difficulty-toggle/difficulty-toggle.component';
import { environment } from 'src/environment';

enum MatDrawerPosition {
  END = 'end',
  START = 'start',
}

@Component({
  selector: 'nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
  standalone: false,
})
export class NavComponent implements OnInit, OnDestroy {
  protected readonly GameType = GameType;
  /** Story G2 — false when staging/prod built with LEADERBOARDS_UI_ENABLED=false */
  protected readonly leaderboardsUiEnabled = environment.leaderboardsUiEnabled;
  /** Story C2 — false when staging/prod built with WEEKLY_CONTESTS_UI_ENABLED=false */
  protected readonly weeklyContestsUiEnabled = environment.weeklyContestsUiEnabled;

  @ViewChild('drawer', { static: true }) public drawer!: MatDrawer;

  get playerToGuess(): Signal<GamePlayer> {
    return this.gameService.playerToGuess;
  }

  get currentGameName(): GameType {
    return this.gameService.currentGame();
  }

  get currentGameMode(): Signal<Difficulty> {
    return this.gameService.currentGameMode;
  }

  get nicknameStreakNicknameToGuess(): string {
    return this.nicknameStreakEngineService.nicknameToGuess();
  }

  protected bioBallPlayerToGuess = computed(() => {
    const player = this.playerToGuess();
    return player && 'colorMap' in player ? player : null;
  });

  protected careerPathPlayerToGuess = computed(() => {
    const player = this.playerToGuess();
    return player && 'groups' in player ? player : null;
  });

  protected nicknameStreakPlayerToGuess = computed(() => {
    const player = this.playerToGuess();
    return player && 'nicknames' in player ? player : null;
  });

  protected user: User | null = null;
  protected loggedIn = false;
  protected viewMenu = true;
  protected viewProfile = false;
  protected viewRoster = false;
  protected viewLeaderboard = false;
  protected viewContests = false;
  protected matDrawerPosition = MatDrawerPosition.START;
  protected selectedRoster?: UiPlayer<AttributesType>[];
  protected selectedRosterByYears?: CareerPathPlayer[];
  protected selectedRosterYears?: string;
  protected selectedRosterTeamName?: TeamFullName;

  private destroy$ = new Subject<void>();

  constructor(
    private hintService: HintService,
    private rosterSelectionService: RosterSelectionService,
    private router: Router,
    private slideUpService: SlideUpService,
    private authService: AuthService,
    @Inject(GAME_SERVICE)
    private gameService: GameService<GamePlayer>,
    private nicknameStreakEngineService: NicknameStreakEngineService,
    private gameplayTelemetry: GameplayTelemetryService,
  ) {}

  ngOnInit(): void {
    /** Initial URL — `NavigationEnd` may have fired before this subscription exists. */
    this.applyGameTypeFromUrl(this.router.url);

    this.router.events
      .pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntil(this.destroy$),
      )
      .subscribe((e: NavigationEnd) => {
        this.applyGameTypeFromUrl(e.urlAfterRedirects);
      });

    this.router.events
      .pipe(
        filter((e): e is NavigationStart => e instanceof NavigationStart),
        takeUntil(this.destroy$),
      )
      .subscribe((e) => {
        const fromUrl = this.router.url;
        this.gameplayTelemetry.tryRecordAbandonOnNavigate(
          fromUrl,
          e.url,
          this.gameService,
        );
      });

    this.authService.user$
      .pipe(takeUntil(this.destroy$))
      .subscribe((user) => {
        this.user = user;
        this.loggedIn = !!user;
      });

    this.rosterSelectionService.activeRoster$
      .pipe(takeUntil(this.destroy$))
      .subscribe((roster) => {
        this.setSelectedRosterAndOpenMenu(roster);
      });

    this.rosterSelectionService.rosterByYears$
      .pipe(takeUntil(this.destroy$))
      .subscribe((roster) => {
        this.setSelectedRosterAndOpenMenu(
          roster?.players ?? [],
          roster?.teamName,
          roster?.years
        );
      });

    this.drawer.closedStart.pipe(takeUntil(this.destroy$)).subscribe(() => {
      if (this.viewRoster) {
        this.hintService.dismissHint();
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  /** Keep `gameService.currentGame` aligned with the route (dropdown + headers). */
  private applyGameTypeFromUrl(rawUrl: string): void {
    const path = rawUrl.split(/[?#]/)[0];
    if (path.startsWith('/bio-ball')) {
      this.gameService.currentGame = GameType.BIO_BALL;
    } else if (path.startsWith('/career-path')) {
      this.gameService.currentGame = GameType.CAREER_PATH;
    } else if (path.startsWith('/nickname-streak')) {
      this.gameService.currentGame = GameType.NICKNAME_STREAK;
    } else {
      this.gameService.currentGame = GameType.BIO_BALL;
    }
    if (this.gameService.currentGame() !== GameType.BIO_BALL) {
      this.viewContests = false;
    }
  }

  protected handleDifficultyChange(difficulty: Difficulty): void {
    if (this.slideUpService.isVisible()) {
      this.slideUpService.hide(() => {
        this.gameService.currentGameMode = difficulty;
      });
      return;
    }

    this.gameService.currentGameMode = difficulty;
  }

  protected handlePlayerSelection(): void {
    this.resetRosterSelection();
    this.drawer.close();
  }

  protected openMenu(): void {
    this.matDrawerPosition = MatDrawerPosition.START;
    this.viewMenu = true;
    this.viewProfile = false;
    this.viewRoster = false;
    this.viewLeaderboard = false;
    this.viewContests = false;
    this.drawer.open();
  }

  protected openLeaderboard(): void {
    this.matDrawerPosition = MatDrawerPosition.START;
    this.viewMenu = false;
    this.viewProfile = false;
    this.viewRoster = false;
    this.viewLeaderboard = true;
    this.viewContests = false;
    this.drawer.open();
  }

  protected openContests(): void {
    this.matDrawerPosition = MatDrawerPosition.START;
    this.viewMenu = false;
    this.viewProfile = false;
    this.viewRoster = false;
    this.viewLeaderboard = false;
    this.viewContests = true;
    this.drawer.open();
  }

  protected openProfileMenu(): void {
    this.matDrawerPosition = MatDrawerPosition.END;
    this.viewMenu = false;
    this.viewRoster = false;
    this.viewLeaderboard = false;
    this.viewContests = false;
    this.viewProfile = true;
    this.drawer.open();
  }

  protected logout(): void {
    void this.authService.signOut();
  }

  protected onLoginSuccess(): void {
    this.drawer.close();
  }

  protected openLoginMenu(): void {
    this.matDrawerPosition = MatDrawerPosition.END;
    this.viewMenu = false;
    this.viewProfile = false;
    this.viewRoster = false;
    this.viewLeaderboard = false;
    this.viewContests = false;
    this.drawer.open();
  }

  private setSelectedRosterAndOpenMenu(
    roster: GamePlayer[],
    teamName?: TeamFullName,
    years?: string
  ): void {
    if (roster.length === 0) {
      this.resetRosterSelection();
      return;
    }

    if (this.rosterSelectionService.isCareerPathRoster(roster)) {
      this.selectedRoster = undefined;
      this.selectedRosterByYears = roster as CareerPathPlayer[];
      this.selectedRosterYears = years;
      this.selectedRosterTeamName = teamName;
    } else {
      this.selectedRosterByYears = undefined;
      this.selectedRosterYears = undefined;
      this.selectedRosterTeamName = undefined;
      this.selectedRoster = roster as UiPlayer<AttributesType>[];
    }
    this.openRosterMenu();
  }

  private openRosterMenu(): void {
    this.viewMenu = false;
    this.viewProfile = false;
    this.viewLeaderboard = false;
    this.viewContests = false;
    this.viewRoster = true;
    this.matDrawerPosition = MatDrawerPosition.START;
    this.drawer.open();
  }

  private resetRosterSelection(): void {
    this.selectedRoster = undefined;
    this.selectedRosterByYears = undefined;
    this.selectedRosterYears = undefined;
    this.selectedRosterTeamName = undefined;
  }
}
