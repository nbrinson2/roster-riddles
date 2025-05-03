import { Injectable, signal, Signal } from '@angular/core';
import { CareerPathPlayer } from '../../models/career-path.models';
import { CommonGameService } from 'src/app/shared/services/common-game/common-game.service';
import {
  EndResultMessage,
  InputPlaceHolderText,
} from 'src/app/game/bio-ball/util/bio-ball.util';
import { PlayerAttrColor } from 'src/app/shared/models/common-models';
import { GameService } from 'src/app/shared/utils/game-service.token';
import { applyFeedbackColors } from '../../utils/career-path.util';
import { BehaviorSubject } from 'rxjs';
import { SlideUpService } from 'src/app/shared/components/slide-up/slide-up.service';

export enum GameState {
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
}

@Injectable({
  providedIn: 'root',
})
export class CareerPathEngineService
  extends CommonGameService<CareerPathPlayer>
  implements GameService<CareerPathPlayer>
{
  get gameState(): Signal<GameState> {
    return this._gameState.asReadonly();
  }

  get selectedPlayers(): Signal<CareerPathPlayer[]> {
    return this._selectedPlayers.asReadonly();
  }

  set selectedPlayers(players: CareerPathPlayer[]) {
    this._selectedPlayers.set(players);
  }

  get showAttributeHeader(): Signal<boolean> {
    return this._showAttributeHeader.asReadonly();
  }

  public allPlayers: CareerPathPlayer[] = [];
  public guessablePlayers: CareerPathPlayer[] = [];

  private _gameState = signal<GameState>(GameState.PLAYING);
  private _selectedPlayers = signal<CareerPathPlayer[]>([]);
  private _showAttributeHeader = signal<boolean>(false);

  constructor(private slideUpService: SlideUpService) {
    super();
  }

  public startNewGame(players?: CareerPathPlayer[]) {
    this.allPlayers = players ?? this.allPlayers;
    this.guessablePlayers = [...this.allPlayers];
    // this.initializePlayerColorMaps();
    this.selectNewTargetPlayer();

    this.numberOfGuesses = 0;
    this._gameState.set(GameState.PLAYING);
    this.endOfGame = false;
    this.isSearchDisabled = false;
    this.searchInputPlaceHolderText = InputPlaceHolderText.GUESS;
    this.selectedPlayers = [];
  }

  public filterPlayers(searchTerm: string | null): CareerPathPlayer[] {
    const term = searchTerm?.toLowerCase() ?? '';
    return this.guessablePlayers.filter(
      (player) =>
        !this.selectedPlayers().includes(player) &&
        (!searchTerm || player.name.toLowerCase().includes(term))
    );
  }

  public findMatchingPlayer(playerName: string): CareerPathPlayer | undefined {
    return this.filterPlayers(playerName).find((p) => p.name === playerName);
  }

  public handlePlayerSelection(guess: CareerPathPlayer): void {
    // 1) Sanity checks & early exit
    if (!guess || this.endOfGame || this.isSearchDisabled) {
      return;
    }
    this.numberOfGuesses++;

    // 3) Apply Mastermind-style feedback coloring
    applyFeedbackColors(guess, this.playerToGuess() as CareerPathPlayer);

    // 4) Track the guess and update UI
    this.selectedPlayers = [guess, ...this.selectedPlayers()];
    // 2) Win / Lose conditions
    if (this.isCorrectGuess(guess)) {
      this.onWin();
      return;
    }
    if (this.isOutOfGuesses()) {
      this.onLose();
      return;
    }
    this.updatePlaceholderWithRemainingGuesses();
  }

  private selectNewTargetPlayer(): void {
    const index = Math.floor(Math.random() * this.allPlayers.length);
    this.playerToGuess = this.allPlayers[index];
    console.log('selected player', this.playerToGuess());
  }

  /** Did the user guess the exact player? */
  private isCorrectGuess(guess: CareerPathPlayer): boolean {
    const playerToGuess = this.playerToGuess() as CareerPathPlayer;
    return playerToGuess.id === guess.id;
  }

  /** Have they used up all allowed guesses? */
  private isOutOfGuesses(): boolean {
    return this.numberOfGuesses >= this.allowedGuesses;
  }

  /** Mark a win: show text, disable further input */
  private onWin(): void {
    this.endResultText = EndResultMessage.WIN;
    this.endOfGame = true;
    this.isSearchDisabled = true;
    this.searchInputPlaceHolderText = InputPlaceHolderText.WIN;
    this._gameState.set(GameState.WON);
  }

  /** Mark a loss when guesses are exhausted */
  private onLose(): void {
    this.slideUpService.show();
    this.endResultText = EndResultMessage.LOSE;
    this.endOfGame = true;
    this.isSearchDisabled = true;
    this.searchInputPlaceHolderText = InputPlaceHolderText.LOSE;
    this._gameState.set(GameState.LOST);
  }

  /** Update the placeholder to show how many guesses remain */
  private updatePlaceholderWithRemainingGuesses(): void {
    const remaining = this.allowedGuesses - this.numberOfGuesses;
    this.searchInputPlaceHolderText = `${remaining} ${InputPlaceHolderText.COUNT}`;
  }

  isGameWon(): boolean {
    return this._gameState() === GameState.WON;
  }
}
