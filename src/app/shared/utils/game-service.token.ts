import { InjectionToken, Signal } from '@angular/core';
import { GamePlayer } from '../models/common-models';
import { GameState } from 'src/app/game/career-path/services/career-path-engine/career-path-engine.service';
import { GameType } from 'src/app/game/shared/constants/game.constants';
import { Difficulty } from 'src/app/nav/difficulty-toggle/difficulty-toggle.component';
import { Header } from 'src/app/game/shared/common-attribute-header/common-attribute-header.component';

export interface GameService<T> {
  get currentGame(): Signal<GameType>;
  set currentGame(game: GameType);
  get currentGameMode(): Signal<Difficulty>;
  set currentGameMode(mode: Difficulty);
  get showAttributeHeader(): Signal<boolean>;
  get attributeHeaders(): Signal<Header[]>;
  set attributeHeaders(headers: Header[]);
  get searchInputPlaceHolderText(): Signal<string>;
  get playerToGuess(): Signal<GamePlayer>;
  get gameState(): Signal<GameState>;
  get numberOfGuesses(): number;
  set numberOfGuesses(value: number);
  get bestStreak(): Signal<number>;
  set bestStreak(value: number);
  get currentStreak(): Signal<number>;
  set currentStreak(value: number);
  isSearchDisabled: boolean;

  startNewGame(players?: T[]): void;
  filterPlayers(searchTerm: string | null): T[];
  handlePlayerSelection(player: T): void;
  findMatchingPlayer(playerName: string): T | undefined;
  incrementNumberOfGuesses(): void;
  onWin(): void;
  onLose(): void;
}

export const GAME_SERVICE = new InjectionToken<
  GameService<GamePlayer>
>('GameService');
