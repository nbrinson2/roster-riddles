import { Injectable, Signal } from '@angular/core';
import {
  MlbPlayerAttributes,
  MlbUiPlayer,
} from 'src/app/shared/models/mlb.models';
import { MlbPlayersService } from '../player/services/mlb-players.service';
import { getPlayerKeyToBackgroundColorMap } from '../util/util';
import { GameEngineService } from './game-engine.service';

@Injectable({ providedIn: 'root' })
export class MlbGameService {
  // Expose state as needed (numberOfGuesses, selectedPlayers, etc.)
  public get numberOfGuesses(): number {
    return this.gameEngine.numberOfGuesses;
  }

  public set numberOfGuesses(value: number) {
    this.gameEngine.numberOfGuesses = value;
  }

  public get allowedGuesses(): number {
    return this.gameEngine.allowedGuesses;
  }

  public get allPlayers(): MlbUiPlayer[] {
    return this.gameEngine.allPlayers;
  }

  public get selectedPlayers(): MlbUiPlayer[] {
    return this.gameEngine.selectedPlayers;
  }

  public get guessablePlayers(): MlbUiPlayer[] {
    return this.gameEngine.guessablePlayers;
  }

  public get searchInputPlaceHolderText(): Signal<string> {
    return this.gameEngine.searchInputPlaceHolderText;
  }

  public set searchInputPlaceHolderText(text: string) {
    this.gameEngine.searchInputPlaceHolderText = text;
  }

  constructor(
    private gameEngine: GameEngineService<MlbUiPlayer>,
    private mlbPlayers: MlbPlayersService
  ) {
    this.gameEngine.configure({
      attributes: Object.values(MlbPlayerAttributes).filter(
        (attr) => attr !== MlbPlayerAttributes.NAME
      ) as MlbPlayerAttributes[],
      compareFunction: (target, guess) =>
        getPlayerKeyToBackgroundColorMap(target, guess, false),
      allowedGuesses: 9,
      playerProvider: this.mlbPlayers,
    });
  }

  /** Delegate methods to the generic engine */
  public setAllPlayers(players: MlbUiPlayer[]): void {
    this.gameEngine.setAllPlayers(players);
  }

  public startNewGame(players?: MlbUiPlayer[]): void {
    this.gameEngine.startNewGame(players);
  }

  public filterPlayers(searchTerm: string | null): MlbUiPlayer[] {
    return this.gameEngine.filterPlayers(searchTerm);
  }

  public findMatchingPlayer(name: string): MlbUiPlayer | undefined {
    return this.gameEngine.findMatchingPlayer(name);
  }

  public handlePlayerSelection(player: MlbUiPlayer): void {
    this.gameEngine.handlePlayerSelection(player);
  }
}
