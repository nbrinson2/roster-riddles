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
import { NavigationEnd, Router } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import {
  AttributesType,
  TeamFullName,
  UiPlayer,
} from '../game/bio-ball/models/bio-ball.models';
import { RosterSelectionService } from '../game/bio-ball/services/roster-selection/roster-selection.service';
import { CareerPathPlayer } from '../game/career-path/models/career-path.models';
import { HintService } from '../shared/components/hint/hint.service';
import { GamePlayer } from '../shared/models/common-models';
import { GAME_SERVICE, GameService } from '../shared/utils/game-service.token';
import { SlideUpService } from '../shared/components/slide-up/slide-up.service';
import { GameType } from '../game/shared/constants/game.constants';
import { CareerPathPlayerGenerator } from '../shared/utils/career-path-player-generator';
import { Difficulty } from './difficulty-toggle/difficulty-toggle.component';
import { NicknameStreakEngineService } from '../game/nickname-streak/services/nickname-streak-engine.service';

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

  // protected user?: SocialUser;
  protected loggedIn = false;
  protected viewMenu = true;
  protected viewProfile = false;
  protected viewRoster = false;
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
    @Inject(GAME_SERVICE)
    private gameService: GameService<GamePlayer>,
    private nicknameStreakEngineService: NicknameStreakEngineService
  ) {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        if (e.urlAfterRedirects.startsWith('/bio-ball')) {
          this.gameService.currentGame = GameType.BIO_BALL;
        } else if (e.urlAfterRedirects.startsWith('/career-path')) {
          this.gameService.currentGame = GameType.CAREER_PATH;
        } else if (e.urlAfterRedirects.startsWith('/nickname-streak')) {
          this.gameService.currentGame = GameType.NICKNAME_STREAK;
        } else {
          this.gameService.currentGame = GameType.BIO_BALL;
        }
      });
  }

  ngOnInit(): void {
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
    this.drawer.open();
  }

  protected openProfileMenu(): void {
    this.matDrawerPosition = MatDrawerPosition.END;
    this.viewMenu = false;
    this.viewRoster = false;
    this.viewProfile = true;
    this.drawer.open();
  }

  protected logout(): void {
    // this.user = undefined;
    this.loggedIn = false;
    // this.authService.signOut();
  }

  protected openLoginMenu(): void {
    this.matDrawerPosition = MatDrawerPosition.END;
    this.viewMenu = false;
    this.viewProfile = false;
    this.viewRoster = false;
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
