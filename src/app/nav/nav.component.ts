import { Component, OnInit, ViewChild } from '@angular/core';

import { UiPlayer } from '../models/models';
import { ActivatedRoute } from '@angular/router';
import { SocialAuthService } from '@abacritt/angularx-social-login';
import { MatDrawer } from '@angular/material/sidenav';

enum MatDrawerPosition {
  END = "end",
  START = "start",
}

@Component({
  selector: 'nav',
  templateUrl: './nav.component.html',
  styleUrls: ['./nav.component.scss'],
})
export class NavComponent implements OnInit {
  @ViewChild('drawer', { static: true }) public drawer!: MatDrawer;

  protected user = '';
  protected loggedIn = false;
  protected viewMenu = true;
  protected viewProfile = false;
  protected viewRoster = false;
  protected matDrawerPosition = MatDrawerPosition.END;
  protected selectedRoster?: UiPlayer[];

  constructor(private route: ActivatedRoute,
    private authService: SocialAuthService) {
  }

  ngOnInit(): void {
    this.authService.authState.subscribe((user) => {
      this.user = user.firstName;
      this.loggedIn = (user != null);
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
    this.user = '';
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
