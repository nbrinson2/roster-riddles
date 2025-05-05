import { Injectable, Signal, signal } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AttributesType, TeamFullName, UiPlayer } from '../../models/bio-ball.models';
import { CareerPathPlayer } from 'src/app/game/career-path/models/career-path.models';
import { GamePlayer } from 'src/app/shared/models/common-models';

interface RosterByYears {
  teamName: TeamFullName;
  years: string;
  players: CareerPathPlayer[];
}

@Injectable({ providedIn: 'root' })
export class RosterSelectionService {
  private activeRosterSubject = new BehaviorSubject<UiPlayer<AttributesType>[]>([]);
  private rosterByYearsSubject = new BehaviorSubject<RosterByYears | null>(null);

  activeRoster$ = this.activeRosterSubject.asObservable();
  rosterByYears$ = this.rosterByYearsSubject.asObservable();
  
  selectActiveRoster(roster: UiPlayer<AttributesType>[]) {
    this.activeRosterSubject.next(roster);
  }

  selectRosterByYears(roster: CareerPathPlayer[], years: string, teamName: TeamFullName) {
    this.rosterByYearsSubject.next({ teamName, years, players: roster });
  }

  isCareerPathRoster(roster: GamePlayer[]): boolean {
    return 'groups' in roster[0];
  }

  isBioBallRoster(roster: GamePlayer[]): boolean {
    return 'colorMap' in roster[0];
  }

  resetRosterSelection(): void {
    this.activeRosterSubject.next([]);
    this.rosterByYearsSubject.next(null);
  }
}
