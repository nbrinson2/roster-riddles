import { Injectable } from '@angular/core';
import { HintService } from 'src/app/shared/components/hint/hint.service';
import { SlideUpService } from 'src/app/shared/components/slide-up/slide-up.service';
import { MlbUiPlayer, MlbPlayerAttributes } from 'src/app/shared/models/mlb-models';
import { MlbPlayersService } from '../player/services/mlb-players.service';
import { getPlayerKeyToBackgroundColorMap } from '../util/util';
import { GameEngineService } from './game.service';

@Injectable({ providedIn: 'root' })
export class MlbGameService {
  constructor(
    private gameEngine: GameEngineService<MlbUiPlayer>,
    slideUp: SlideUpService,
    hintService: HintService,
    private mlbPlayers: MlbPlayersService
  ) {
    this.gameEngine.configure({
      attributes: Object.values(MlbPlayerAttributes).filter(
        attr => attr !== MlbPlayerAttributes.NAME
      ) as MlbPlayerAttributes[],
      compareFunction: (target, guess) =>
        getPlayerKeyToBackgroundColorMap(target, guess, false),
      allowedGuesses: 9,
      playerProvider: this.mlbPlayers
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

  // Expose state as needed (numberOfGuesses, selectedPlayers, etc.)
  public get numberOfGuesses(): number {
    return this.gameEngine.numberOfGuesses;
  }

  public get selectedPlayers(): MlbUiPlayer[] {
    return this.gameEngine.selectedPlayers;
  }

  public get guessablePlayers(): MlbUiPlayer[] {
    return this.gameEngine.guessablePlayers;
  }
}
