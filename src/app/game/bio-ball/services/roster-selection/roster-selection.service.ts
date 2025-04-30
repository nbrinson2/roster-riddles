// src/app/game/bio-ball/services/roster-selection.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { AttributesType, UiPlayer } from '../../models/bio-ball.models';

@Injectable({ providedIn: 'root' })
export class RosterSelectionService {
  private rosterSubject = new BehaviorSubject<UiPlayer<AttributesType>[]>([]);

  roster$ = this.rosterSubject.asObservable();

  selectRoster(roster: UiPlayer<AttributesType>[]) {
    this.rosterSubject.next(roster);
  }
}
