import { Injectable, signal, Signal } from '@angular/core';
import {
  EndResultMessage,
  InputPlaceHolderText,
} from 'src/app/game/bio-ball/util/bio-ball.util';
import { GameState } from 'src/app/game/career-path/services/career-path-engine/career-path-engine.service';
import { SlideUpService } from '../../components/slide-up/slide-up.service';

export enum GameType {
  BIO_BALL = 'bio-ball',
  CAREER_PATH = 'career-path',
}

@Injectable({
  providedIn: 'root',
})
export class CommonGameService<T> {
  get currentGame(): Signal<GameType> {
    return this._currentGame.asReadonly();
  }

  set currentGame(game: GameType) {
    this._currentGame.set(game);
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


  public allowedGuesses = 9;
  public endResultText = EndResultMessage.WIN;
  public isSearchDisabled = false;

  private _currentGame = signal<GameType>(GameType.BIO_BALL);
  private _searchInputPlaceHolderText = signal<string>(
    InputPlaceHolderText.GUESS
  );
  private _playerToGuess = signal<T>({} as T);
  private _gameState = signal<GameState>(GameState.PLAYING);
  private _numberOfGuesses = 0;

  constructor(private slideUpService: SlideUpService) {}

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
}
