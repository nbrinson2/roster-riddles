import { Component } from '@angular/core';

import { PLAYERS } from '../../test-data';
import { PlayerAttr, PlayerAttrColor } from '../models/models';

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
  colorMap: Map<PlayerAttr, PlayerAttrColor>;
}

export interface Header {
  name: string;
  colSpan: number;
  class: string;
}

export function getPlayerKeyToHeaderNameMap(): Map<string, string> {
  const playerAttributes = Object.values(PlayerAttr).filter((key) => key !== PlayerAttr.NAME);
  const headerNames: string[] = Headers.map((header) => header.name);
  const playerAttrToHeadersMap = new Map<string, string>();

  for (let i = 0; i < playerAttributes.length; i++) {
    playerAttrToHeadersMap.set(playerAttributes[i], headerNames[i]);
  }

  return playerAttrToHeadersMap;
}

function getPlayerKeyToBackgroundColorMap(playerToGuess: Player, selectedPlayer: Player, initialize: boolean): Map<PlayerAttr, PlayerAttrColor> {
  const playerAttributes = Object.values(PlayerAttr).filter((key) => key !== PlayerAttr.NAME);
  const backgroundColors = Object.values(PlayerAttrColor);
  const playerAttrBackgroundColorMap = new Map<PlayerAttr, PlayerAttrColor>();

  if (initialize) {
    for (const attr of playerAttributes) {
      playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);
    }
    return playerAttrBackgroundColorMap;
  }

  for (const attr of playerAttributes) {
    switch (attr) {
      case PlayerAttr.TEAM:
      case PlayerAttr.B:
      case PlayerAttr.T:
      case PlayerAttr.BORN:
      case PlayerAttr.POS:
        if (playerToGuess[attr] === selectedPlayer[attr]) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.GREEN)
          break;
        }
        
        playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);
        break;
      case PlayerAttr.LG_DIV:
        const playerToGuessLgDivArray = playerToGuess[attr].split(' ');
        const selectedPlayerLgDivArray = selectedPlayer[attr].split(' ');
        const mismatchArray = playerToGuessLgDivArray.filter((elem) => selectedPlayerLgDivArray.indexOf(elem) < 0);

        if (mismatchArray.length === 0) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.GREEN);
          break;
        }

        if (mismatchArray.length === 1) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.YELLOW);
          break;
        }

        playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);

        break;
      case PlayerAttr.AGE:
        const ageDifference = Number(playerToGuess[attr]) - Number(selectedPlayer[attr]);

        if (ageDifference === 0) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.GREEN);
          break;
        }

        if (ageDifference <= 2 && ageDifference >= -2) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.YELLOW);
          break;
        }

        playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);
        break;
      default:
        break;
    }
  }

  return playerAttrBackgroundColorMap;
}

export const Headers = [
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
  // protected playerToGuess: Player;
  protected players: Player[] = PLAYERS;
  protected selectedPlayers?: Player[];
  protected playerToGuess = this.players[0];

  constructor() {
    this.initializePlayerColorMap();
  }

  protected selectPlayer(selectedPlayer: Player): void {
    selectedPlayer.colorMap = getPlayerKeyToBackgroundColorMap(this.playerToGuess, selectedPlayer, false);

    this.setNewAttrColorForAllPlayers(selectedPlayer);

    if (!this.selectedPlayers) {
      this.selectedPlayers = [];
    }
    this.selectedPlayers.push(selectedPlayer);
    const indexOfPlayer = this.players.indexOf(selectedPlayer);
    this.players.splice(indexOfPlayer, 1);
  }

  private initializePlayerColorMap(): void {
    for (const player of this.players) {
      player.colorMap = getPlayerKeyToBackgroundColorMap(this.playerToGuess, player, true);
    }
  }

  private setNewAttrColorForAllPlayers(selectedPlayer: Player): void {
    const coloredPlayerAttributes = [];
    for (const attr of selectedPlayer.colorMap.keys()) {
      if (selectedPlayer.colorMap.get(attr as PlayerAttr) !== PlayerAttrColor.NONE) {
        coloredPlayerAttributes.push(attr);
      }
    }

    for (const player of this.players) {
      for (const attr of coloredPlayerAttributes) {
        if (player[attr as PlayerAttr] === selectedPlayer[attr as PlayerAttr]) {
          const selectedPlayerAttrColor = selectedPlayer.colorMap.get(attr as PlayerAttr);
          player.colorMap.set(attr as PlayerAttr, selectedPlayerAttrColor as PlayerAttrColor);
        }
      }
    }
  }
}
