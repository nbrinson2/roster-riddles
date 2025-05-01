import { Component, OnDestroy, OnInit, ViewChild } from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';
import { ActivatedRoute } from '@angular/router';
import { filter, Subject, takeUntil } from 'rxjs';
import {
  AttributesType,
  UiPlayer,
} from '../game/bio-ball/models/bio-ball.models';
import { MlbUiPlayer } from '../game/bio-ball/models/mlb.models';
import { RosterSelectionService } from '../game/bio-ball/services/roster-selection/roster-selection.service';
import { HintService } from '../shared/components/hint/hint.service';
import { FirestoreService } from '../shared/services/firestore/firestore.service';
import { MlbPlayersService } from '../shared/services/mlb-players/mlb-players.service';

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

  get playerToGuess(): MlbUiPlayer {
    return this.playersService.playerToGuess;
  }

  // protected user?: SocialUser;
  protected loggedIn = false;
  protected viewMenu = true;
  protected viewProfile = false;
  protected viewRoster = false;
  protected matDrawerPosition = MatDrawerPosition.END;
  protected selectedRoster?: UiPlayer<AttributesType>[];

  private destroy$ = new Subject<void>();

  constructor(
    private route: ActivatedRoute,
    private playersService: MlbPlayersService,
    private hintService: HintService,
    private firestoreService: FirestoreService,
    private rosterSelectionService: RosterSelectionService
  ) {}

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

  private openRosterMenu(roster: UiPlayer<AttributesType>[]): void {
    this.viewMenu = false;
    this.viewProfile = false;
    this.viewRoster = true;
    this.matDrawerPosition = MatDrawerPosition.START;
    this.selectedRoster = roster;
    this.drawer.open();
  }
}
