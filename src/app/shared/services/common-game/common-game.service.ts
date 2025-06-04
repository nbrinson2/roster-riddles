import { Injectable, signal, Signal } from '@angular/core';
import { GameState } from 'src/app/game/career-path/services/career-path-engine/career-path-engine.service';
import { SlideUpService } from '../../components/slide-up/slide-up.service';
import { Difficulty } from 'src/app/nav/difficulty-toggle/difficulty-toggle.component';
import { EndResultMessage, InputPlaceHolderText } from 'src/app/game/shared/constants/game.constants';
import { GameType } from 'src/app/game/shared/constants/game.constants';
import { Header } from 'src/app/game/shared/common-attribute-header/common-attribute-header.component';

@Injectable({
  providedIn: 'root',
})
export abstract class CommonGameService<T> {
  get currentGame(): Signal<GameType> {
    return this._currentGame.asReadonly();
  }

  set currentGame(game: GameType) {
    this._currentGame.set(game);
  }

  get currentGameMode(): Signal<Difficulty> {
    return this._currentGameMode.asReadonly();
  }

  set currentGameMode(mode: Difficulty) {
    this._currentGameMode.set(mode);
    if (mode !== 'n/a') {
      this.startNewGame();
    }
  }

  get attributeHeaders(): Signal<Header[]> {
    return this._attributeHeaders.asReadonly();
  }

  set attributeHeaders(headers: Header[]) {
    this._attributeHeaders.set(headers);
  }

  get searchInputPlaceHolderText(): Signal<string> {
    return this._searchInputPlaceHolderText.asReadonly();
  }

  set searchInputPlaceHolderText(text: string) {
    this._searchInputPlaceHolderText.set(text);
  }

  get playerToGuess(): Signal<T> {
    return this._playerToGuess.asReadonly();
  }

  set playerToGuess(player: T) {
    this._playerToGuess.set(player);
  }

  get gameState(): Signal<GameState> {
    return this._gameState.asReadonly();
  }

  set gameState(state: GameState) {
    this._gameState.set(state);
  }

  get numberOfGuesses(): number {
    return this._numberOfGuesses;
  }

  set numberOfGuesses(value: number) {
    if (value >= this.allowedGuesses) {
      this.gameState = GameState.LOST;
    }
    this._numberOfGuesses = value;
  }

  get bestStreak(): Signal<number> {
    return this._bestStreak.asReadonly();
  }

  set bestStreak(value: number) {
    this._bestStreak.set(value);
  }

  get currentStreak(): Signal<number> {
    return this._currentStreak.asReadonly();
  }

  set currentStreak(value: number) {
    this._currentStreak.set(value);
  }
  
  public allowedGuesses = 9;
  public endResultText = EndResultMessage.WIN;
  public isSearchDisabled = false;

  private _currentGame = signal<GameType>(GameType.BIO_BALL);
  private _currentGameMode = signal<Difficulty>('easy');
  private _searchInputPlaceHolderText = signal<string>(
    InputPlaceHolderText.GUESS
  );
  private _playerToGuess = signal<T>({} as T);
  private _gameState = signal<GameState>(GameState.PLAYING);
  private _numberOfGuesses = 0;
  private _attributeHeaders = signal<Header[]>([]);
  private _bestStreak = signal<number>(0);
  private _currentStreak = signal<number>(0);

  constructor(private slideUpService: SlideUpService) {}

  public startNewGame(players?: T[]): void {
    if (this.currentGameMode() === 'easy') {
      this.startNewGameEasy(players);
    } else if (this.currentGameMode() === 'hard') {
      this.startNewGameHard(players);
    } else {
      this.startNewGameNoMode(players);
    }
  }

  public incrementNumberOfGuesses(): void {
    this.numberOfGuesses++;
    this.updateStateAfterGuess();
  }

  /** Mark a win: show text, disable further input */
  public onWin(): void {
    this.endResultText = EndResultMessage.WIN;
    this.isSearchDisabled = true;
    this.searchInputPlaceHolderText = InputPlaceHolderText.WIN;
    this.gameState = GameState.WON;
  }

  /** Mark a loss when guesses are exhausted */
  public onLose(): void {
    this.slideUpService.show();
    this.endResultText = EndResultMessage.LOSE;
    this.isSearchDisabled = true;
    this.searchInputPlaceHolderText = InputPlaceHolderText.LOSE;
    this.gameState = GameState.LOST;
  }

  protected abstract startNewGameEasy(players?: T[]): void;
  protected abstract startNewGameHard(players?: T[]): void;
  protected abstract startNewGameNoMode(players?: T[]): void;
  protected abstract updateStateAfterGuess(): void;
}
