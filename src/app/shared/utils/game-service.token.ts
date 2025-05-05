import { InjectionToken, Signal } from '@angular/core';
import { GamePlayer } from '../models/common-models';
import { GameState } from 'src/app/game/career-path/services/career-path-engine/career-path-engine.service';
import { GameType } from '../services/common-game/common-game.service';
export interface GameService<T> {
  get currentGame(): Signal<GameType>;
  set currentGame(game: GameType);
  get showAttributeHeader(): Signal<boolean>;
  get searchInputPlaceHolderText(): Signal<string>;
  get playerToGuess(): Signal<GamePlayer>;
  get gameState(): Signal<GameState>;
  isSearchDisabled: boolean;

  startNewGame(players?: T[]): void;
  filterPlayers(searchTerm: string | null): T[];
  handlePlayerSelection(player: T): void;
  findMatchingPlayer(playerName: string): T | undefined;
  onWin(): void;
  onLose(): void;
}

export const GAME_SERVICE = new InjectionToken<
  GameService<GamePlayer>
>('GameService');
