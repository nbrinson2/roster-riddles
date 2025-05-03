import { Injectable, signal, Signal } from '@angular/core';
import { EndResultMessage, InputPlaceHolderText } from 'src/app/game/bio-ball/util/bio-ball.util';
import { GamePlayer } from '../../models/common-models';

@Injectable({
  providedIn: 'root'
})
export class CommonGameService<T> {
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

  public numberOfGuesses = 0;
  public allowedGuesses = 2;
  public endResultText = EndResultMessage.WIN;
  public endOfGame = false;
  public isSearchDisabled = false;
  
  private _searchInputPlaceHolderText = signal<string>(InputPlaceHolderText.GUESS);
  private _playerToGuess = signal<T>({} as T);
}
