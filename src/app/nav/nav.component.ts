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
import { filter, from, Subject, takeUntil } from 'rxjs';
import {
  AttributesType,
  UiPlayer,
} from '../game/bio-ball/models/bio-ball.models';
import { MlbUiPlayer } from '../game/bio-ball/models/mlb.models';
import { RosterSelectionService } from '../game/bio-ball/services/roster-selection/roster-selection.service';
import { HintService } from '../shared/components/hint/hint.service';
import { MlbPlayersService } from '../shared/services/mlb-players/mlb-players.service';
import { GamePlayer } from '../shared/models/common-models';
import { GameService } from '../shared/utils/game-service.token';
import { GAME_SERVICE } from '../shared/utils/game-service.token';
import { CareerPathPlayer } from '../game/career-path/models/career-path.models';
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
  @ViewChild('drawer', { static: true }) public drawer!: MatDrawer;

  get playerToGuess(): Signal<GamePlayer> {
    return this.gameService.playerToGuess;
  }

  protected bioBallPlayerToGuess = computed(() => {
    const player = this.playerToGuess();
    return player && 'colorMap' in player ? player : null;
  });

  protected careerPathPlayerToGuess = computed(() => {
    const player = this.playerToGuess();
    return player && 'groups' in player ? player : null;
  });

  // protected user?: SocialUser;
  protected loggedIn = false;
  protected viewMenu = true;
  protected viewProfile = false;
  protected viewRoster = false;
  protected matDrawerPosition = MatDrawerPosition.START;
  protected selectedRoster?: UiPlayer<AttributesType>[];
  protected currentGameName = 'Bio-Ball';

  private destroy$ = new Subject<void>();

  constructor(
    private hintService: HintService,
    private rosterSelectionService: RosterSelectionService,
    private router: Router,
    @Inject(GAME_SERVICE)
    private gameService: GameService<GamePlayer>
  ) {
    this.router.events
      .pipe(filter((e) => e instanceof NavigationEnd))
      .subscribe((e: NavigationEnd) => {
        if (e.urlAfterRedirects.startsWith('/bio-ball')) {
          this.currentGameName = 'Bio-Ball';
        } else if (e.urlAfterRedirects.startsWith('/career-path')) {
          this.currentGameName = 'Career Path';
        } else {
          this.currentGameName = '';
        }
      });
  }

  ngOnInit(): void {
    this.rosterSelectionService.roster$
      .pipe(
        filter((roster) => roster.length > 0),
        takeUntil(this.destroy$)
      )
      .subscribe((roster) => {
        this.openRosterMenu(roster);
      });

    this.drawer.closedStart.pipe(takeUntil(this.destroy$)).subscribe(() => {
      this.hintService.dismissHint();
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  protected handlePlayerSelection(): void {
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

  protected setCurrentGameName(gameName: string): void {
    this.currentGameName = gameName;
  }

  private openRosterMenu(roster: UiPlayer<AttributesType>[]): void {
    this.viewMenu = false;
    this.viewProfile = false;
    this.viewRoster = true;
    this.matDrawerPosition = MatDrawerPosition.START;
    this.selectedRoster = roster;
    this.drawer.open();
  }
}
