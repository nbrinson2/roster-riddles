import { Injectable, Signal } from '@angular/core';
import {
  MlbPlayerAttributes,
  MlbUiPlayer,
} from 'src/app/game/bio-ball/models/mlb.models';
import { MlbPlayersService } from '../../../../shared/services/mlb-players/mlb-players.service';
import { getPlayerKeyToBackgroundColorMap } from '../../util/bio-ball.util';
import { BioBallEngineService } from '../bio-ball-engine/bio-ball-engine.service';

@Injectable({ providedIn: 'root' })
export class BioBallMlbService {
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

  public get selectedPlayers(): Signal<MlbUiPlayer[]> {
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
    private gameEngine: BioBallEngineService<MlbUiPlayer>,
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
