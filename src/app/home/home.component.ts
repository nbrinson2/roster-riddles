import { Component } from '@angular/core';

import { PLAYERS } from '../../test-data';

export interface Column {
  colSpan: number;
  class: string;
}

export interface Player {
  name: string;
  team: string;
  lgDiv: string;
  b: string;
  t: string;
  born: string;
  age: string;
  pos: string;
}

export interface Header {
  name: string;
  colSpan: number;
  class: string;
}

export enum PlayerAttr {
  NAME = 'name',
  TEAM = 'team',
  LG_DIV = 'lgDiv',
  B = 'b',
  T = 't',
  BORN = 'born',
  AGE = 'age',
  POS = 'pos',
}

export function getPlayerKeyToHeaderNameMap(): Map<string, string> {
  const playerKeys = Object.values(PlayerAttr).filter((key) => key !== PlayerAttr.NAME);
  const headerNames: string[] = Headers.map((header) => header.name);
  const playerToHeadersMap = new Map<string, string>();

  for (let i = 0; i < playerKeys.length; i++) {
    playerToHeadersMap.set(playerKeys[i], headerNames[i]);
  }

  return playerToHeadersMap;
}

const Headers = [
  { name: 'TEAM', colSpan: 1, class: 'team-column' },
  { name: 'LG./DIV.', colSpan: 2, class: 'lg-div-column' },
  { name: 'B', colSpan: 1, class: 'b-column' },
  { name: 'T', colSpan: 1, class: 't-column' },
  { name: 'BORN', colSpan: 2, class: 'born-column' },
  { name: 'AGE', colSpan: 1, class: 'age-column' },
  { name: 'POS.', colSpan: 1, class: 'pos-column' },
];

@Component({
  selector: 'home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  protected headers = Headers;
  // protected players: Player[] = [];
  protected players = PLAYERS;

  private addGuessedPlayer(player: Player): void {
    this.players.push(player);
  }
}
