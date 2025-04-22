import { Injectable, signal, Signal } from '@angular/core';
import { PlayersService } from 'src/app/home/player/services/players.service';
import {
  EndResultMessage,
  Headers,
  InputPlaceHolderText,
  getPlayerKeyToBackgroundColorMap,
} from '../../home/util/util';
import {
  PlayerAttr,
  PlayerAttrColor,
  UiPlayer,
} from '../../shared/models/models';
import { SlideUpService } from '../components/slide-up/slide-up.service';
import { HintType, HintService } from '../components/hint/hint.service';

@Injectable({ providedIn: 'root' })
export class GameService {
  allPlayers: UiPlayer[] = [];
  guessablePlayers: UiPlayer[] = [];
  selectedPlayers: UiPlayer[] = [];
  numberOfGuesses = 0;
  allowedGuesses = 9;
  endResultText = EndResultMessage.WIN;
  endOfGame = false;
  isSearchDisabled = false;
  searchInputPlaceHolderText: string = InputPlaceHolderText.GUESS;
  headers = Headers;
  get hasShownFirstPlayerHint(): Signal<boolean> {
    return this._hasShownFirstPlayerHint.asReadonly();
  }

  set hasShownFirstPlayerHint(value: boolean) {
    this._hasShownFirstPlayerHint.set(value);
  }

  get shouldStartNewGame(): Signal<boolean> {
    return this._shouldStartNewGame.asReadonly();
  }

  set shouldStartNewGame(value: boolean) {
    this._shouldStartNewGame.set(value);
  }

  private _shouldStartNewGame = signal(false);
  private _hasShownFirstPlayerHint = signal(false);
  constructor(
    private slideUpService: SlideUpService,
    private playersService: PlayersService,
    private hintService: HintService
  ) {}

  setAllPlayers(players: UiPlayer[]): void {
    this.allPlayers = players;
  }

  startNewGame(players?: UiPlayer[]): void {
    this.allPlayers = players || this.allPlayers;
    this.guessablePlayers = this.allPlayers;
    this.resetColorMaps(this.guessablePlayers);
    this.getNewPlayerToGuess();

    this.numberOfGuesses = 0;
    this.endOfGame = false;
    this.isSearchDisabled = false;
    this.searchInputPlaceHolderText = InputPlaceHolderText.GUESS;
    this.selectedPlayers = [];

    this.updatePlayerAttrColorForAllGuessablePlayers();
  }

  updatePlayerAttrColorForAllGuessablePlayers(
    attributes?: PlayerAttr[],
    selectedPlayer?: UiPlayer
  ): void {
    if (!attributes && !selectedPlayer) {
      for (const player of this.guessablePlayers) {
        player.colorMap = this.initializePlaterAttrColorMap();
      }
      return;
    }

    if (attributes && selectedPlayer) {
      for (const player of this.guessablePlayers) {
        for (const attr of attributes) {
          if (
            player[attr as PlayerAttr] === selectedPlayer[attr as PlayerAttr]
          ) {
            const selectedPlayerAttrColor = selectedPlayer.colorMap.get(
              attr as PlayerAttr
            );
            player.colorMap.set(
              attr as PlayerAttr,
              selectedPlayerAttrColor as PlayerAttrColor
            );
          }
        }
      }
      return;
    }
  }

  setNewAttrColorForAllGuessablePlayers(selectedPlayer: UiPlayer): void {
    const coloredPlayerAttributes: PlayerAttr[] = [];
    for (const attr of selectedPlayer.colorMap.keys()) {
      if (
        selectedPlayer.colorMap.get(attr as PlayerAttr) !== PlayerAttrColor.NONE
      ) {
        coloredPlayerAttributes.push(attr);
      }
    }

    this.updatePlayerAttrColorForAllGuessablePlayers(
      coloredPlayerAttributes,
      selectedPlayer
    );
  }

  isGameFinished(colorMapValuesArray?: string[]): boolean {
    if (
      !!colorMapValuesArray &&
      !colorMapValuesArray.includes(PlayerAttrColor.NONE) &&
      !colorMapValuesArray.includes(PlayerAttrColor.ORANGE)
    ) {
      this.endResultText = EndResultMessage.WIN;
      this.endOfGame = true;
      this.searchInputPlaceHolderText = InputPlaceHolderText.WIN;
      this.isSearchDisabled = true;
      return true;
    }

    if (this.numberOfGuesses >= this.allowedGuesses) {
      this.slideUpService.show();
      this.endResultText = EndResultMessage.LOSE;
      this.endOfGame = true;
      this.searchInputPlaceHolderText = InputPlaceHolderText.LOSE;
      this.isSearchDisabled = true;
      return true;
    }

    return false;
  }

  filterPlayers(value: string | null): UiPlayer[] {
    if (!this.guessablePlayers) {
      return [];
    }
    if (!value) {
      return this.guessablePlayers.filter(
        (player) => !this.selectedPlayers.includes(player)
      );
    }
    const filterValue = value.toLowerCase();
    return this.guessablePlayers.filter(
      (player) =>
        !this.selectedPlayers.includes(player) &&
        player.name.toLowerCase().includes(filterValue)
    );
  }

  handlePlayerSelection(player: UiPlayer): void {
    if (!player) {
      return;
    }

    if (!this.hasShownFirstPlayerHint && this.selectedPlayers.length === 0) {
      this.hintService.showHint(HintType.COLOR_FEEDBACK);
      this._hasShownFirstPlayerHint.set(true);
    }

    this.numberOfGuesses++;
    player.colorMap = getPlayerKeyToBackgroundColorMap(
      this.playersService.playerToGuess(),
      player,
      false
    );
    const colorMapValuesArray = Array.from(player.colorMap.values());

    this.selectedPlayers.unshift(player);

    if (this.isGameFinished(colorMapValuesArray)) {
      return;
    }

    this.searchInputPlaceHolderText = `${
      this.allowedGuesses - this.numberOfGuesses
    } ${InputPlaceHolderText.COUNT}`;
    this.setNewAttrColorForAllGuessablePlayers(player);
  }

  handleRosterSelection(player: UiPlayer): void {
    if (!player || this.endOfGame || this.isSearchDisabled) {
      return;
    }

    this.numberOfGuesses++;
    player.colorMap = getPlayerKeyToBackgroundColorMap(
      this.playersService.playerToGuess(),
      player,
      false
    );
    const colorMapValuesArray = Array.from(player.colorMap.values());

    this.selectedPlayers.unshift(player);

    if (this.isGameFinished(colorMapValuesArray)) {
      return;
    }

    this.searchInputPlaceHolderText = `${
      this.allowedGuesses - this.numberOfGuesses
    } ${InputPlaceHolderText.COUNT}`;
    this.setNewAttrColorForAllGuessablePlayers(player);
  }

  findMatchingPlayer(searchValue: string): UiPlayer | undefined {
    return this.filterPlayers(searchValue).find(
      (player) => player.name === searchValue
    );
  }

  private initializePlaterAttrColorMap(): Map<PlayerAttr, PlayerAttrColor> {
    const playerAttributes = Object.values(PlayerAttr).filter(
      (key) => key !== PlayerAttr.NAME
    );
    const playerAttrBackgroundColorMap = new Map<PlayerAttr, PlayerAttrColor>();

    for (const attr of playerAttributes) {
      playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);
    }
    return playerAttrBackgroundColorMap;
  }

  private getNewPlayerToGuess(): UiPlayer {
    const randomIndex = Math.floor(Math.random() * this.allPlayers.length);
    const player = this.allPlayers[randomIndex];
    this.playersService.playerToGuess = player;
    return player;
  }

  private resetColorMaps(players: UiPlayer[]): void {
    for (const player of players) {
      player.colorMap = this.initializePlayerAttrColorMap();
    }
  }

  private initializePlayerAttrColorMap(): Map<PlayerAttr, PlayerAttrColor> {
    const map = new Map<PlayerAttr, PlayerAttrColor>();
    const attrs = Object.values(PlayerAttr).filter(
      (attr) => attr !== PlayerAttr.NAME
    );
    for (const attr of attrs) {
      map.set(attr, PlayerAttrColor.NONE);
    }
    return map;
  }
}
