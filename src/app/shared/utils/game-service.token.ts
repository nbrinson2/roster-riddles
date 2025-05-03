import { InjectionToken, Signal } from '@angular/core';
import { GamePlayer } from '../models/common-models';

export interface GameService<T> {
  get showAttributeHeader(): Signal<boolean>;
  get searchInputPlaceHolderText(): Signal<string>;
  get playerToGuess(): Signal<GamePlayer>;
  isSearchDisabled: boolean;

  startNewGame(players?: T[]): void;
  filterPlayers(searchTerm: string | null): T[];
  handlePlayerSelection(player: T): void;
  findMatchingPlayer(playerName: string): T | undefined;
}

export const GAME_SERVICE = new InjectionToken<
  GameService<GamePlayer>
>('GameService');
