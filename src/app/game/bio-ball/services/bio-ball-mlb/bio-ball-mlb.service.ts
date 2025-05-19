import { Injectable, Signal } from '@angular/core';
import {
  MlbPlayerAttributes,
  MlbUiPlayer,
} from 'src/app/game/bio-ball/models/mlb.models';
import { MlbPlayersService } from '../../../../shared/services/mlb-players/mlb-players.service';
import { getPlayerKeyToBackgroundColorMap } from '../../util/bio-ball.util';
import { BioBallEngineService } from '../bio-ball-engine/bio-ball-engine.service';
import { GameState } from 'src/app/game/career-path/services/career-path-engine/career-path-engine.service';
import { GameType } from 'src/app/game/shared/constants/game.constants';
import { Difficulty } from 'src/app/nav/difficulty-toggle/difficulty-toggle.component';

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

  public get showAttributeHeader(): Signal<boolean> {
    return this.gameEngine.showAttributeHeader;
  }

  public get playerToGuess(): Signal<MlbUiPlayer> {
    return this.gameEngine.playerToGuess;
  }

  public get gameState(): Signal<GameState> {
    return this.gameEngine.gameState;
  }

  public get currentGame(): Signal<GameType> {
    return this.gameEngine.currentGame;
  }

  public set currentGame(game: GameType) {
    this.gameEngine.currentGame = game;
  }

  public get currentGameMode(): Signal<Difficulty> {
    return this.gameEngine.currentGameMode;
  }

  public set currentGameMode(mode: Difficulty) {
    this.gameEngine.currentGameMode = mode;
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
    });
  }

  /** Delegate methods to the generic engine */
  public onWin(): void {
    this.gameEngine.onWin();
  }

  public onLose(): void {
    this.gameEngine.onLose();
  }
  
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
