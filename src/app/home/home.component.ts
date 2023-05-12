import { Component } from '@angular/core';

import { PLAYERS } from '../../test-data';
import { UiPlayer, PlayerAttr, PlayerAttrColor } from '../models/models';
import { PlayersService } from '../services/players.service';

export interface Column {
  colSpan: number;
  class: string;
}

export interface Header {
  name: string;
  colSpan: number;
  class: string;
}

enum EndResultMessage {
  WIN = "You ol' sandbagger, you beat the game!!",
  LOSE = "Just give up, you DO NOT know baseball.",
}

enum InputPlaceHolderText {
  GUESS = "Guess today's player",
  WIN = "You guessed correctly!",
  LOSE = "Go home, you lose.",
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

function getPlayerKeyToBackgroundColorMap(playerToGuess: UiPlayer, selectedPlayer: UiPlayer, initialize: boolean): Map<PlayerAttr, PlayerAttrColor> {
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
  private numberOfGuesses = 0;
  private readonly allPlayers: UiPlayer[] = PLAYERS;

  protected headers = Headers;
  // protected players: Player[] = [];
  // protected playerToGuess: Player;
  protected guessablePlayers: UiPlayer[] = [];
  protected selectedPlayers?: UiPlayer[];
  protected playerToGuess = this.allPlayers[0];
  protected endResultText = EndResultMessage.WIN;
  protected endOfGame = false;
  protected isSearchDisabled = false;
  protected searchInputPlaceHolderText = InputPlaceHolderText.GUESS;

  constructor(private playersService: PlayersService) {

    this.initializePlayerColorMapAndGuessablePlayers();
  }

  protected selectPlayer(selectedPlayer: UiPlayer): void {
    this.numberOfGuesses++;

    selectedPlayer.colorMap = getPlayerKeyToBackgroundColorMap(this.playerToGuess, selectedPlayer, false);

    const colorMapValuesArray = Array.from(selectedPlayer.colorMap.values());

    this.setNewAttrColorForAllGuessablePlayers(selectedPlayer);

    if (!this.selectedPlayers) {
      this.selectedPlayers = [];
    }
    this.selectedPlayers.push(selectedPlayer);

    if (!colorMapValuesArray.includes(PlayerAttrColor.NONE) && !colorMapValuesArray.includes(PlayerAttrColor.YELLOW)) {
      this.endResultText = EndResultMessage.WIN;
      this.endOfGame = true;
      this.searchInputPlaceHolderText = InputPlaceHolderText.WIN;
      this.isSearchDisabled = true;
      return;
    }

    if (this.numberOfGuesses === 9) {
      this.endResultText = EndResultMessage.LOSE;
      this.endOfGame = true;
      this.searchInputPlaceHolderText = InputPlaceHolderText.LOSE;
      this.isSearchDisabled = true;
      return;
    }

    const indexOfPlayer = this.guessablePlayers.indexOf(selectedPlayer);
    this.guessablePlayers.splice(indexOfPlayer, 1);
  }

  private initializePlayerColorMapAndGuessablePlayers(): void {
    for (const player of this.allPlayers) {
      player.colorMap = getPlayerKeyToBackgroundColorMap(this.playerToGuess, player, true);
    }

    this.guessablePlayers = Array.from(this.allPlayers);
  }

  private setNewAttrColorForAllGuessablePlayers(selectedPlayer: UiPlayer): void {
    const coloredPlayerAttributes = [];
    for (const attr of selectedPlayer.colorMap.keys()) {
      if (selectedPlayer.colorMap.get(attr as PlayerAttr) !== PlayerAttrColor.NONE) {
        coloredPlayerAttributes.push(attr);
      }
    }

    for (const player of this.guessablePlayers) {
      for (const attr of coloredPlayerAttributes) {
        if (player[attr as PlayerAttr] === selectedPlayer[attr as PlayerAttr]) {
          const selectedPlayerAttrColor = selectedPlayer.colorMap.get(attr as PlayerAttr);
          player.colorMap.set(attr as PlayerAttr, selectedPlayerAttrColor as PlayerAttrColor);
        }
      }
    }
  }

  protected startNewGame(): void {    
    this.initializePlayerColorMapAndGuessablePlayers();
    this.numberOfGuesses = 6;
    this.endOfGame = false;
    this.searchInputPlaceHolderText = InputPlaceHolderText.GUESS;
    this.isSearchDisabled = false;
    this.selectedPlayers = [];

    const numberOfPlayers = this.allPlayers.length;
    const randomIndex = Math.floor(Math.random() * numberOfPlayers);
    this.playerToGuess = this.allPlayers[randomIndex];
  }
}
