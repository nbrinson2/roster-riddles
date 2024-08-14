import { Observable } from 'rxjs';
import { AttributeHeader, Player } from 'src/app/shared/models/models';
import { GameCreateRequest, Game, GameUpdateRequest, GuessCreateRequest, GameData } from '../models';

export interface GameService {
  getHeaders(): AttributeHeader[];
  initializeGameData(): void;
  createPlayerRequest(player: Player): any;
  setPlayerToGuess(players: Player[]): void;
  selectPlayer(selectedPlayer: Player): void;
  createGame(request: GameCreateRequest): Observable<Game>;
  updateGame(request: GameUpdateRequest, gameId: number): Observable<Game>;
  createGuessRequest(selectedPlayer: Player, colorMapValuesArray: string[]): GuessCreateRequest;
  allPlayers(): Player[];
  gameData(): GameData;
  updateGameDataField<K extends keyof GameData>(field: K, value: GameData[K]): void;
  startNewGame(userId: number): void;
  increaseNumberOfGuesses(): void;
  isGameFinished(colorMapValuesArray?: string[]): boolean;
  setInProgressPlaceHolderText(): void;
}
