import { HttpClient } from '@angular/common/http';
import { computed, Injectable, Signal, signal } from '@angular/core';
import { map, Observable } from 'rxjs';
import { MlbPlayerAttributes, NflPlayerAttributes } from 'src/app/shared/enumeration/attributes';
import { MlbPlayer } from 'src/app/shared/models/mlb-models';
import { LeagueType } from 'src/app/shared/models/models';
import { NflPlayer } from 'src/app/shared/models/nfl-models';
import { environment } from 'src/environment';
import { AuthenticationService } from '../authentication.service';
import { EndResultMessage, InputPlaceHolderText, LeagueTypeIdMap } from '../constants';
import { GuessService } from '../guess.service';
import {
  BaseballPlayerRequest,
  FootballPlayerRequest,
  Game,
  GameCreateRequest,
  GameData,
  GameResponse,
  GameStatus,
  GameUpdateRequest,
  GuessCreateRequest,
} from '../models';
import { ToastService } from '../toast.service';
import { GameUtilityService } from './game-utility.service';
import { MlbGameService } from './mlb-game.service';
import { NflGameService } from './nfl-game.service';
import { MlbHeaders, NflHeaders } from 'src/app/shared/constants/attribute-headers';

export type PlayerType = MlbPlayer | NflPlayer;
export type PlayerAttributesType = MlbPlayerAttributes | NflPlayerAttributes;
export type PlayerRequest = BaseballPlayerRequest | FootballPlayerRequest;
export type LeagueService = MlbGameService | NflGameService;

@Injectable({
  providedIn: 'root',
})
export abstract class BaseGameService {
  getHeaders = computed(() => this.leagueType() === LeagueType.MLB ? MlbHeaders : NflHeaders);
  abstract createPlayerRequest(player: PlayerType): PlayerRequest;
  abstract updateSelectedPlayer(selectedPlayer: PlayerType): string[];
  abstract setPlayerToGuess(players: PlayerType[]): void;
  abstract selectPlayer(selectedPlayer: PlayerType): void;
  abstract createGuessRequest(
    selectedPlayer: PlayerType,
    colorMapValuesArray: string[]
  ): GuessCreateRequest;

  private readonly baseUrl = environment.baseUrl;
  private readonly gameEndpoint = '/games';
  private _gameData = signal<GameData>({} as GameData);
  private _gameId = signal<number>(0);
  private _leagueType = signal<LeagueType>(LeagueType.MLB);

  constructor(
    protected http: HttpClient,
    protected auth: AuthenticationService,
    protected guessService: GuessService,
    protected toastService: ToastService,
    protected gameUtilityService: GameUtilityService
  ) {}

  get gameData(): Signal<GameData> {
    return this._gameData.asReadonly();
  }

  get gameId(): Signal<number> {
    return this._gameId.asReadonly();
  }

  get leagueType(): Signal<LeagueType> {
    return this._leagueType.asReadonly();
  }

  protected initializeGameData(): void {
    this.updateGameDataField('headers', this.getHeaders());
    this.updateGameDataField('guessablePlayers', []);
    this.updateGameDataField('selectedPlayers', []);
    this.updateGameDataField('endResultText', EndResultMessage.LOSE);
    this.updateGameDataField('endOfGame', false);
    this.updateGameDataField('isSearchDisabled', false);
    this.updateGameDataField(
      'searchInputPlaceHolderText',
      this.gameUtilityService.setSearchInputPlaceHolderText(0, 1, GameStatus.IN_PROCESS)
    );
    this.updateGameDataField('numberOfGuesses', 0);
    this.updateGameDataField('showNewGameButton', false);
    this.updateGameDataField('timesViewedActiveRoster', 0);
  };

  protected createGame(request: GameCreateRequest): Observable<Game> {
    const headers = this.auth.getHeaders();
    const reqUrl = `${this.baseUrl}${this.gameEndpoint}`;
    const response = this.http.post<GameResponse>(reqUrl, request, { headers });

    return response.pipe(
      map((gameResponse) => {
        return {
          id: gameResponse.id,
          startTime: new Date(gameResponse.start_time),
          endTime: gameResponse.end_time ? new Date(gameResponse.end_time) : null,
          status: gameResponse.status as GameStatus,
          remainingGuesses: gameResponse.remaining_guesses,
          numberOfGuesses: gameResponse.number_of_guesses,
          timesViewedActiveRoster: gameResponse.times_viewed_active_roster,
          userId: gameResponse.user_id,
          leagueId: gameResponse.league_id,
          gameTypeId: gameResponse.game_type_id,
        };
      })
    );
  }

  protected updateGameData(gameData: GameData): void {
    this._gameData.set(gameData);
  }

  protected updateGameDataField<K extends keyof GameData>(field: K, value: GameData[K]): void {
    this._gameData.set({ ...this.gameData(), [field]: value });
  }

  protected isGameFinished(colorMapValuesArray?: string[]): boolean {
    const gameData = this.gameData();
    const isVictory =
      !colorMapValuesArray?.includes('NONE') && !colorMapValuesArray?.includes('ORANGE');

    if (isVictory || gameData.numberOfGuesses >= 1) {
      this.updateGameDataField(
        'endResultText',
        isVictory ? EndResultMessage.WIN : EndResultMessage.LOSE
      );
      this.updateGameDataField('endOfGame', true);
      this.updateGameDataField(
        'searchInputPlaceHolderText',
        isVictory ? InputPlaceHolderText.WIN : InputPlaceHolderText.LOSE
      );
      this.updateGameDataField('isSearchDisabled', true);
      const updateGameRequest = this.createUpdateGameRequest(
        this.auth.activeUser().id,
        isVictory ? GameStatus.WIN : GameStatus.LOSS
      );
      this.updateGame(updateGameRequest, this.gameId()).subscribe({
        error: (err) => {
          console.error('Error updating game: ', err);
        },
      });
      return true;
    }
    return false;
  }

  protected createUpdateGameRequest(userId: number, status: GameStatus): GameUpdateRequest {
    const gameData = this.gameData();
    return {
      status,
      timesViewedActiveRoster: gameData.timesViewedActiveRoster,
      numberOfGuesses: gameData.numberOfGuesses,
      userId,
      leagueId: LeagueTypeIdMap[this.leagueType()],
      gameTypeId: 1,
    };
  }

  protected startNewGame(userId: number): void {
    const playerRequest = this.createPlayerRequest(this.gameData().playerToGuess);
    const newGameRequest: GameCreateRequest = {
      userId,
      leagueId: LeagueTypeIdMap[this.leagueType()],
      gameTypeId: 1,
      playerToGuess: playerRequest,
    };

    if (!this.gameData().endOfGame) {
      this.setGameStatusAbandoned(userId);
    }
    this.createGame(newGameRequest).subscribe((game) => {
      this._gameId.set(game.id);
      this.resetGameData();
    });
  }

  protected setGameStatusAbandoned(userId: number): void {
    const updateGameRequest = this.createUpdateGameRequest(userId, GameStatus.ABANDONED);
    this.updateGame(updateGameRequest, this.gameId()).subscribe({
      error: (err) => {
        console.error('Error updating game: ', err);
      },
    });
  }

  protected resetGameData(): void {
    this.updateGameDataField('numberOfGuesses', 0);
    this.updateGameDataField('showNewGameButton', false);
    this.updateGameDataField('endOfGame', false);
    this.updateGameDataField('searchInputPlaceHolderText', InputPlaceHolderText.GUESS);
    this.updateGameDataField('isSearchDisabled', false);
    this.updateGameDataField('selectedPlayers', []);
    this.resetPlayerColorMaps();
  }

  protected resetPlayerColorMaps(): void {
    const newGuessablePlayers = this.gameData().guessablePlayers;
    for (const player of newGuessablePlayers) {
      this.gameUtilityService.resetPlayerColorMap(player, this.leagueType());
    }
    this.updateGameDataField('guessablePlayers', newGuessablePlayers);
  }

  protected setNewAttributeColorForAllGuessablePlayers(selectedPlayer: PlayerType): void {
    const newGuessablePlayers = this.gameData().guessablePlayers;
    this.gameUtilityService.updateAllPlayersAttributeColors(
      newGuessablePlayers,
      this.leagueType(),
      selectedPlayer
    );
    this.updateGameDataField('guessablePlayers', newGuessablePlayers);
  }

  private updateGame(request: GameUpdateRequest, gameId: number): Observable<Game> {
    const headers = this.auth.getHeaders();
    const reqUrl = `${this.baseUrl}${this.gameEndpoint}/${gameId}`;
    const response = this.http.post<GameResponse>(reqUrl, request, { headers });

    return response.pipe(
      map((gameResponse) => {
        return {
          id: gameResponse.id,
          startTime: new Date(gameResponse.start_time),
          endTime: gameResponse.end_time ? new Date(gameResponse.end_time) : null,
          status: gameResponse.status as GameStatus,
          remainingGuesses: gameResponse.remaining_guesses,
          numberOfGuesses: gameResponse.number_of_guesses,
          timesViewedActiveRoster: gameResponse.times_viewed_active_roster,
          userId: gameResponse.user_id,
          leagueId: gameResponse.league_id,
          gameTypeId: gameResponse.game_type_id,
        };
      })
    );
  }
}
