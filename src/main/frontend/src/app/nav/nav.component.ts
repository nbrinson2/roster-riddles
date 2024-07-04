import { Component, OnInit, Signal, ViewChild, signal } from '@angular/core';

import { UiPlayer } from '../models/models';
import { ActivatedRoute } from '@angular/router';
import { MatDrawer } from '@angular/material/sidenav';
import { GameCreateRequest, LeagueType, User } from '../services/models';
import { UserService } from '../services/user.service';
import { GameService } from '../services/game.service';

enum MatDrawerPosition {
  END = "end",
  START = "start",
}

@Component({
  selector: 'nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
})
export class NavComponent {
  @ViewChild('drawer', { static: true }) public drawer!: MatDrawer;

  get user(): Signal<User> {
    return this._user.asReadonly();
  }

  protected loggedIn = false;
  protected viewMenu = true;
  protected viewProfile = false;
  protected viewRoster = false;
  protected matDrawerPosition = MatDrawerPosition.END;
  protected selectedRoster?: UiPlayer[];

  // Default user is the guest user with id 0
  private _user = signal<User>({id: 0} as User);

  constructor(private route: ActivatedRoute, private userService: UserService, private gameService: GameService) { }

  protected openMenu(): void {
    this.matDrawerPosition = MatDrawerPosition.START;
    this.viewMenu = true;
    this.viewProfile = false;
    this.viewRoster = false;
    this.drawer.toggle();
  }

  protected loginUser(user: User): void {
    this._user.set(user);
    const newGameRequest: GameCreateRequest = {
      userId: user.id,
      leagueId: 1,
      gameTypeId: 1,
    };
    this.gameService.startNewGame(newGameRequest, user.id);
    this.loggedIn = true;
    this.openProfileMenu(false);
  }

  protected openProfileMenu(updateUser: boolean): void {
    if (updateUser) {
      this.userService.getUser(this.user().id).subscribe((user) => {
        this._user.set(user);
      });
    }
    this.matDrawerPosition = MatDrawerPosition.END;
    this.viewMenu = false;
    this.viewRoster = false;
    this.viewProfile = true;
    if (!this.drawer.opened) {
      this.drawer.toggle();
    }
  }

  protected logout(): void {
    this._user.set({} as User);
    this.loggedIn = false;
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
