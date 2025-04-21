import { Component, OnInit, ViewChild } from '@angular/core';

import { UiPlayer } from '../shared/models/models';
import { ActivatedRoute } from '@angular/router';
import {
  GoogleSigninButtonDirective,
  SocialAuthService,
  SocialUser,
} from '@abacritt/angularx-social-login';
import { MatDrawer } from '@angular/material/sidenav';
import { PlayersService } from '../home/player/services/players.service';

enum MatDrawerPosition {
  END = 'end',
  START = 'start',
}

@Component({
  selector: 'nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
})
export class NavComponent implements OnInit {
  @ViewChild('drawer', { static: true }) public drawer!: MatDrawer;
  @ViewChild('google-login', { static: true })
  public googleLogin!: GoogleSigninButtonDirective;

  get playerToGuess(): UiPlayer {
    return this.playersService.playerToGuess();
  }

  protected user?: SocialUser;
  protected loggedIn = false;
  protected viewMenu = true;
  protected viewProfile = false;
  protected viewRoster = false;
  protected matDrawerPosition = MatDrawerPosition.END;
  protected selectedRoster?: UiPlayer[];

  constructor(
    private route: ActivatedRoute,
    private authService: SocialAuthService,
    private playersService: PlayersService
  ) {}

  ngOnInit(): void {
    this.authService.authState.subscribe((user: SocialUser) => {
      this.user = user;
      this.loggedIn = user != null;
      if (this.drawer.opened) {
        this.drawer.toggle();
      }
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
    this.user = undefined;
    this.loggedIn = false;
    this.authService.signOut();
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
}
