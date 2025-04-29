import { Component, OnInit, ViewChild } from '@angular/core';
import { MatDrawer } from '@angular/material/sidenav';
import { ActivatedRoute } from '@angular/router';
import { PlayersService } from '../home/player/services/players.service';
import { HintService } from '../shared/components/hint/hint.service';
import { UiPlayer } from '../shared/models/models';
import { FirestoreService } from '../shared/services/firestore.service';

enum MatDrawerPosition {
  END = 'end',
  START = 'start',
}

@Component({
    selector: 'nav',
    templateUrl: './nav.component.html',
    styleUrls: ['./nav.component.scss'],
    standalone: false
})
export class NavComponent implements OnInit {
  @ViewChild('drawer', { static: true }) public drawer!: MatDrawer;

  get playerToGuess(): UiPlayer {
    return this.playersService.playerToGuess();
  }

  // protected user?: SocialUser;
  protected loggedIn = false;
  protected viewMenu = true;
  protected viewProfile = false;
  protected viewRoster = false;
  protected matDrawerPosition = MatDrawerPosition.END;
  protected selectedRoster?: UiPlayer[];

  constructor(
    private route: ActivatedRoute,
    private playersService: PlayersService,
    private hintService: HintService,
    private firestoreService: FirestoreService
  ) {}

  ngOnInit(): void {
    this.firestoreService.getAll().subscribe((cafes) => {
      console.log(cafes);
    });

    this.drawer.closedStart.subscribe(() => {
      this.hintService.dismissHint();
    });
  }

  protected openMenu(): void {
    this.matDrawerPosition = MatDrawerPosition.START;
    this.viewMenu = true;
    this.viewProfile = false;
    this.viewRoster = false;
    this.drawer.toggle();
  }

  protected openProfileMenu(): void {
    this.matDrawerPosition = MatDrawerPosition.END;
    this.viewMenu = false;
    this.viewRoster = false;
    this.viewProfile = true;
    this.drawer.toggle();
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
    this.drawer.toggle();
  }

  protected openRosterMenu(roster: UiPlayer[]): void {
    this.viewMenu = false;
    this.viewProfile = false;
    this.viewRoster = true;
    this.matDrawerPosition = MatDrawerPosition.START;
    this.selectedRoster = roster;
    this.drawer.toggle();
  }

  handlePlayerSelection(): void {
    this.drawer.toggle();
  }
}
