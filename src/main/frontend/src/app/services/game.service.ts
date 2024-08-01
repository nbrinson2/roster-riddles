import { HttpClient } from '@angular/common/http';
import { Injectable, Signal, signal } from '@angular/core';
import { environment } from 'src/environment';
import { AuthenticationService } from './authentication.service';
import { Observable, map } from 'rxjs';
import {
  BaseballPlayerRequest,
  Game,
  GameCreateRequest,
  GameData,
  GameResponse,
  GameStatus,
  GameUpdateRequest,
  GuessCreateRequest,
  PlayerType,
} from './models';
import { PlayerAttributeColor, MlbPlayer } from '../shared/models/mlb-models';
import { GuessService } from './guess.service';
import { ToastService } from './toast.service';
import { GameUtilityService } from './game-utility.service';
import { EndResultMessage, InputPlaceHolderText, LeagueTypeIdMap } from './constants';
import { LeagueType } from '../shared/models/models';
import { MlbHeaders, NflHeaders } from '../shared/constants/attribute-headers';
import { MlbPlayerAttributes } from '../shared/enumeration/attributes';

export const maxNumberOfGuesses = 1;

@Injectable({
  providedIn: 'root',
})
export class GameService {
  get gameData(): Signal<GameData> {
    return this._gameData.asReadonly();
  }

  get allPlayers(): Signal<MlbPlayer[]> {
    return this._allPlayers.asReadonly();
  }

  get gameId(): Signal<number> {
    return this._gameId.asReadonly();
  }

  get leagueType(): Signal<LeagueType> {
    return this._leagueType.asReadonly();
  }

  private readonly baseUrl = environment.baseUrl;
  private readonly gameEndpoint = '/games';
  private _gameData = signal<GameData>({} as GameData);
  private _allPlayers = signal<MlbPlayer[]>([]);
  private _gameId = signal<number>(0);
  private _leagueType = signal<LeagueType>(LeagueType.MLB);

  constructor(
    private http: HttpClient,
    private auth: AuthenticationService,
    private guessService: GuessService,
    private toastService: ToastService,
    private gameUtilityService: GameUtilityService
  ) {}

  public initializeGameData(): void {
    const playerRequest = this.createPlayerRequest(this.gameData().playerToGuess);
    this.createGame({
      userId: this.auth.activeUser().id,
      leagueId: LeagueTypeIdMap[this.leagueType()],
      gameTypeId: 1,
      playerToGuess: playerRequest,
    }).subscribe((game) => {
      this._gameId.set(game.id);
    });
    switch (this.leagueType()) {
      case LeagueType.MLB:
        this._gameData.set({
          ...this.gameData(),
          headers: MlbHeaders,
          guessablePlayers: [],
          selectedPlayers: [],
          endResultText: EndResultMessage.LOSE,
          endOfGame: false,
          isSearchDisabled: false,
          searchInputPlaceHolderText: this.gameUtilityService.setSearchInputPlaceHolderText(
            0,
            maxNumberOfGuesses,
            GameStatus.IN_PROCESS
          ),
          numberOfGuesses: 0,
          showNewGameButton: false,
          timesViewedActiveRoster: 0,
        });
        break;
      case LeagueType.NFL:
        this._gameData.set({
          ...this.gameData(),
          headers: NflHeaders,
          guessablePlayers: [],
          selectedPlayers: [],
          endResultText: EndResultMessage.LOSE,
          endOfGame: false,
          isSearchDisabled: false,
          searchInputPlaceHolderText: this.gameUtilityService.setSearchInputPlaceHolderText(
            0,
            maxNumberOfGuesses,
            GameStatus.IN_PROCESS
          ),
          numberOfGuesses: 0,
          showNewGameButton: false,
          timesViewedActiveRoster: 0,
        });
    }
  }

  public setAllPlayers(allPlayers: MlbPlayer[]): void {
    this._allPlayers.set(allPlayers);
  }

  public updateGameData(gameData: GameData): void {
    this._gameData.set(gameData);
  }

  public updateGameDataField<K extends keyof GameData>(field: K, value: GameData[K]): void {
    this._gameData.set({ ...this.gameData(), [field]: value });
  }

  public selectPlayer(selectedPlayer: MlbPlayer): void {
    this.updateGameDataField('numberOfGuesses', this.gameData().numberOfGuesses + 1);
    this.updateGameDataField('showNewGameButton', true);

    const colorMapValuesArray = this.updateSelectedPlayer(selectedPlayer);
    const guessRequest = this.createGuessRequest(selectedPlayer, colorMapValuesArray);

    this.guessService.createGuess(this.gameId(), guessRequest).subscribe((response) => {
      console.log('Guess created:', response);
    });

    if (this.isGameFinished(colorMapValuesArray)) {
      if (this.gameData().endResultText === EndResultMessage.LOSE) {
        const correctPlayer = this.gameData().playerToGuess;
        this.resetPlayerColorMap(correctPlayer);
        this.toastService.showToast(correctPlayer);
      }
      return;
    }

    const numberOfGuesses = this.gameData().numberOfGuesses;
    const inputPlaceHolderText = this.gameUtilityService.setSearchInputPlaceHolderText(
      numberOfGuesses,
      maxNumberOfGuesses,
      GameStatus.IN_PROCESS
    );
    this.updateGameDataField('searchInputPlaceHolderText', inputPlaceHolderText);
    this.setNewAttrColorForAllGuessablePlayers(selectedPlayer);
  }

  public startNewGame(players: MlbPlayer[], userId: number): void {
    this.setPlayerToGuess(players);
    const playerRequest = this.createPlayerRequest(this.gameData().playerToGuess);
    const newGameRequest: GameCreateRequest = {
      userId,
      leagueId: 1,
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

  public setGameStatusAbandoned(userId: number): void {
    const updateGameRequest = this.createUpdateGameRequest(userId, GameStatus.ABANDONED);
    this.updateGame(updateGameRequest, this.gameId()).subscribe({
      error: (err) => {
        console.error('Error updating game: ', err);
      },
    });
  }

  public increaseNumberOfGuesses(): void {
    this.updateGameDataField('numberOfGuesses', this.gameData().numberOfGuesses + 1);
  }

  public setInProgressPlaceHolderText(): void {
    const inputPlaceHolderText = this.gameUtilityService.setSearchInputPlaceHolderText(
      this.gameData().numberOfGuesses,
      maxNumberOfGuesses,
      GameStatus.IN_PROCESS
    );
    this.updateGameDataField('searchInputPlaceHolderText', inputPlaceHolderText);
  }

  public setPlayerToGuess(players: MlbPlayer[]): void {
    const playerToGuess = players[Math.floor(Math.random() * players.length)];
    this.updateGameDataField('playerToGuess', playerToGuess);
  }

  public isGameFinished(colorMapValuesArray?: string[]): boolean {
    const gameData = this.gameData();
    const isVictory =
      !colorMapValuesArray?.includes(PlayerAttributeColor.NONE) &&
      !colorMapValuesArray?.includes(PlayerAttributeColor.ORANGE);

    if (isVictory || gameData.numberOfGuesses >= maxNumberOfGuesses) {
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

  public updateUser(userId: number): void {
    const updateGameRequest = this.createUpdateGameRequest(userId, GameStatus.IN_PROCESS);
    this.updateGame(updateGameRequest, this.gameId()).subscribe({
      error: (err) => {
        console.error('Error updating game: ', err);
      },
    });
  }

  public resetPlayerColorMap(player: MlbPlayer): void {
    player.colorMap = this.gameUtilityService.initializePlayerAttrColorMap();
  }

  private createPlayerRequest(player: MlbPlayer): BaseballPlayerRequest {
    return {
      name: player.name,
      team: player.team,
      position: player.pos,
      age: Number(player.age),
      countryOfBirth: player.born,
      battingHand: player.b,
      throwingHand: player.t,
      leagueDivision: player.lgDiv,
      type: PlayerType.BASEBALL,
    };
  }

  private createGuessRequest(
    selectedPlayer: MlbPlayer,
    colorMapValuesArray: string[]
  ): GuessCreateRequest {
    const playerRequest = this.createPlayerRequest(selectedPlayer);
    const colorMapString = JSON.stringify(Array.from(selectedPlayer.colorMap.entries()));
    return {
      player: playerRequest,
      isCorrect: this.isGameFinished(colorMapValuesArray),
      colorMap: colorMapString,
    };
  }

  private createUpdateGameRequest(userId: number, status: GameStatus): GameUpdateRequest {
    const gameData = this.gameData();
    return {
      status,
      timesViewedActiveRoster: gameData.timesViewedActiveRoster,
      numberOfGuesses: gameData.numberOfGuesses,
      userId,
      leagueId: 1,
      gameTypeId: 1,
    };
  }

  private updateSelectedPlayer(selectedPlayer: MlbPlayer): string[] {
    const playerToGuess = this.gameData().playerToGuess;
    selectedPlayer.colorMap = this.gameUtilityService.getPlayerKeyToBackgroundColorMap(
      playerToGuess,
      selectedPlayer,
      false
    );

    const colorMapValuesArray = Array.from(selectedPlayer.colorMap.values());
    const newSelectedPlayers = [selectedPlayer, ...this.gameData().selectedPlayers];
    this.updateGameDataField('selectedPlayers', newSelectedPlayers);
    return colorMapValuesArray;
  }

  private resetGameData(): void {
    this.updateGameDataField('numberOfGuesses', 0);
    this.updateGameDataField('showNewGameButton', false);
    this.updateGameDataField('endOfGame', false);
    this.updateGameDataField('searchInputPlaceHolderText', InputPlaceHolderText.GUESS);
    this.updateGameDataField('isSearchDisabled', false);
    this.updateGameDataField('selectedPlayers', []);
    this.resetColorMaps();
    this.updatePlayerAttrColorForAllGuessablePlayers();
  }

  private createGame(request: GameCreateRequest): Observable<Game> {
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

  private setNewAttrColorForAllGuessablePlayers(selectedPlayer: MlbPlayer): void {
    const coloredPlayerAttributes: MlbPlayerAttributes[] = [];
    for (const attr of selectedPlayer.colorMap.keys()) {
      if (selectedPlayer.colorMap.get(attr as MlbPlayerAttributes) !== PlayerAttributeColor.NONE) {
        coloredPlayerAttributes.push(attr);
      }
    }

    this.updatePlayerAttrColorForAllGuessablePlayers(coloredPlayerAttributes, selectedPlayer);
  }

  private resetColorMaps(): void {
    const newGuessablePlayers = this.gameData().guessablePlayers;
    for (const player of newGuessablePlayers) {
      player.colorMap = this.gameUtilityService.initializePlayerAttrColorMap();
    }
    this.updateGameDataField('guessablePlayers', newGuessablePlayers);
  }

  private updatePlayerAttrColorForAllGuessablePlayers(
    attributes?: MlbPlayerAttributes[],
    selectedPlayer?: MlbPlayer
  ): void {
    if (!attributes && !selectedPlayer) {
      const newGuessablePlayers = this.gameData().guessablePlayers;
      for (const player of newGuessablePlayers) {
        player.colorMap = this.gameUtilityService.initializePlayerAttrColorMap();
      }
      this.updateGameDataField('guessablePlayers', newGuessablePlayers);
      return;
    }

    if (attributes && selectedPlayer) {
      const newGuessablePlayers = this.gameData().guessablePlayers;
      for (const player of newGuessablePlayers) {
        for (const attr of attributes) {
          if (player[attr as MlbPlayerAttributes] === selectedPlayer[attr as MlbPlayerAttributes]) {
            const selectedPlayerAttrColor = selectedPlayer.colorMap.get(
              attr as MlbPlayerAttributes
            );
            player.colorMap.set(
              attr as MlbPlayerAttributes,
              selectedPlayerAttrColor as PlayerAttributeColor
            );
          }
        }
      }
      this.updateGameDataField('guessablePlayers', newGuessablePlayers);
      return;
    }
  }
}
