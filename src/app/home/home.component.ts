import { Component, EventEmitter, Input, Output } from '@angular/core';
import { PlayerAttr, PlayerAttrColor, UiPlayer } from '../models/models';
import { ActivatedRoute } from '@angular/router';
import { first } from 'rxjs';

export interface Header {
  name: string;
  colSpan: number;
  class: string;
}

export interface Header {
  name: string;
  colSpan: number;
  class: string;
}

export interface Data {
  players: UiPlayer[];
}

export enum EndResultMessage {
  WIN = "You ol' sandbagger, you beat the game!!",
  LOSE = "Just give up, you DO NOT know baseball.",
}

enum InputPlaceHolderText {
  GUESS = "Guess the mystery player",
  WIN = "You guessed correctly!",
  LOSE = "Go home, you lose.",
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
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.BLUE)
          break;
        }

        playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);
        break;
      case PlayerAttr.LG_DIV:
        const playerToGuessLgDivArray = playerToGuess[attr].split(' ');
        const selectedPlayerLgDivArray = selectedPlayer[attr].split(' ');
        const mismatchArray = playerToGuessLgDivArray.filter((elem) => selectedPlayerLgDivArray.indexOf(elem) < 0);

        if (mismatchArray.length === 0) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.BLUE);
          break;
        }

        if (mismatchArray.length === 1) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.ORANGE);
          break;
        }

        playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);

        break;
      case PlayerAttr.AGE:
        const ageDifference = Number(playerToGuess[attr]) - Number(selectedPlayer[attr]);

        if (ageDifference === 0) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.BLUE);
          break;
        }

        if (ageDifference <= 2 && ageDifference >= -2) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.ORANGE);
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

@Component({
  selector: 'home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  @Output() selectRosterEvent = new EventEmitter<UiPlayer[]>();

  private numberOfGuesses = 0;
  private allPlayers: UiPlayer[] = [];

  protected headers = Headers;
  protected guessablePlayers: UiPlayer[] = [];
  protected selectedPlayers: UiPlayer[] = [];
  protected playerToGuess!: UiPlayer;
  protected endResultText = EndResultMessage.WIN;
  protected endOfGame = false;
  protected isSearchDisabled = false;
  protected searchInputPlaceHolderText = InputPlaceHolderText.GUESS;

  constructor(private route: ActivatedRoute) {
    this.initializePlayerColorMapAndGuessablePlayers();
    this.route.data.pipe(first()).subscribe((d) => {
      this.allPlayers = (d as Data).players;
    });
  }

  private initializePlayerColorMapAndGuessablePlayers(): void {
    this.route.data.pipe(first()).subscribe((data) => {
      const players = (data as Data).players;
      this.guessablePlayers = players;
      const randomIndex = Math.floor(Math.random() * (data as Data).players.length);
      this.playerToGuess = players[randomIndex];
    });
  }

  protected selectPlayer(selectedPlayer: UiPlayer): void {
    this.numberOfGuesses++;
    selectedPlayer.colorMap = getPlayerKeyToBackgroundColorMap(this.playerToGuess, selectedPlayer, false);
    const colorMapValuesArray = Array.from(selectedPlayer.colorMap.values());
    this.selectedPlayers.unshift(selectedPlayer);

    if (!colorMapValuesArray.includes(PlayerAttrColor.NONE) && !colorMapValuesArray.includes(PlayerAttrColor.ORANGE)) {
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

    this.setNewAttrColorForAllGuessablePlayers(selectedPlayer);
  }

  protected startNewGame(): void {
    this.resetColorMaps();
    this.getNewPlayerToGuess();
    this.numberOfGuesses = 0;
    this.endOfGame = false;
    this.searchInputPlaceHolderText = InputPlaceHolderText.GUESS;
    this.isSearchDisabled = false;
    this.selectedPlayers = [];
    this.updatePlayerAttrColorForAllGuessablePlayers();
  }

  protected selectRoster(team: string): void {
    const selectedRoster = this.allPlayers.filter(player => player.team === team);
    this.selectRosterEvent.emit(selectedRoster);
  }

  private getNewPlayerToGuess(): void {
    const randomIndex = Math.floor(Math.random() * this.allPlayers.length);
    this.playerToGuess = this.allPlayers[randomIndex];
  }

  private setNewAttrColorForAllGuessablePlayers(selectedPlayer: UiPlayer): void {
    const coloredPlayerAttributes: PlayerAttr[] = [];
    for (const attr of selectedPlayer.colorMap.keys()) {
      if (selectedPlayer.colorMap.get(attr as PlayerAttr) !== PlayerAttrColor.NONE) {
        coloredPlayerAttributes.push(attr);
      }
    }

    this.updatePlayerAttrColorForAllGuessablePlayers(coloredPlayerAttributes, selectedPlayer);
  }

  private resetColorMaps(): void {
    for (const player of this.guessablePlayers) {
      player.colorMap = this.initializePlaterAttrColorMap();
    }
  }

  private initializePlaterAttrColorMap(): Map<PlayerAttr, PlayerAttrColor> {
    const playerAttributes = Object.values(PlayerAttr).filter((key) => key !== PlayerAttr.NAME);
    const playerAttrBackgroundColorMap = new Map<PlayerAttr, PlayerAttrColor>();

    for (const attr of playerAttributes) {
      playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);
    }
    return playerAttrBackgroundColorMap;
  }

  private updatePlayerAttrColorForAllGuessablePlayers(attributes?: PlayerAttr[], selectedPlayer?: UiPlayer): void {

    if (!attributes && !selectedPlayer) {
      for (const player of this.guessablePlayers) {
        player.colorMap = this.initializePlaterAttrColorMap();
      }
      return;
    }

    if (attributes && selectedPlayer) {
      for (const player of this.guessablePlayers) {
        for (const attr of attributes) {
          if (player[attr as PlayerAttr] === selectedPlayer[attr as PlayerAttr]) {
            const selectedPlayerAttrColor = selectedPlayer.colorMap.get(attr as PlayerAttr);
            player.colorMap.set(attr as PlayerAttr, selectedPlayerAttrColor as PlayerAttrColor);
          }
        }
      }
      return;
    }
  }
}
