import { HttpClient } from '@angular/common/http'
import { Injectable, Signal, signal } from '@angular/core'
import { environment } from 'src/environment'
import { AuthenticationService } from './authentication.service'
import { Observable, map } from 'rxjs'
import {
  BaseballPlayerRequest,
  Game,
  GameCreateRequest,
  GameData,
  GameResponse,
  GameStatus,
  GameUpdateRequest,
  GuessCreateRequest,
  LeagueType,
  PlayerType,
  } from './models'
import { League, PlayerAttr, PlayerAttrColor, UiPlayer } from '../models/models'
import {
  EndResultMessage,
  InputPlaceHolderText,
  MlbHeaders,
  getPlayerKeyToBackgroundColorMap,
} from '../home/util/util'
import { GuessService } from './guess.service'

@Injectable({
  providedIn: 'root',
})
export class GameService {
  get gameData(): Signal<GameData> {
    return this._gameData.asReadonly()
  }

  get allPlayers(): Signal<UiPlayer[]> {
    return this._allPlayers.asReadonly()
  }

  get gameId(): Signal<number> {
    return this._gameId.asReadonly()
  }

  private readonly baseUrl = environment.baseUrl
  private readonly gameEndpoint = '/games'
  private _gameData = signal<GameData>({} as GameData)
  private _allPlayers = signal<UiPlayer[]>([])
  private _gameId = signal<number>(0)

  constructor(
    private http: HttpClient,
    private auth: AuthenticationService,
    private guessService: GuessService
  ) {}

  public initializeGameData(league: LeagueType): void {
    this.createGame({
      userId: this.auth.activeUser().id,
      leagueId: 1,
      gameTypeId: 1,
    }).subscribe((game) => {
      this._gameId.set(game.id)
    })
    switch (league) {
      case LeagueType.MLB:
        this._gameData.set({
          headers: MlbHeaders,
          guessablePlayers: [],
          selectedPlayers: [],
          playerToGuess: {} as UiPlayer,
          endResultText: EndResultMessage.LOSE,
          endOfGame: false,
          isSearchDisabled: false,
          searchInputPlaceHolderText: this.setSearchInputPlaceHolderText(
            0,
            GameStatus.IN_PROCESS
          ),
          numberOfGuesses: 0,
          showNewGameButton: false,
          timesViewedActiveRoster: 0,
        })
        break
    }
  }

  public setAllPlayers(allPlayers: UiPlayer[]): void {
    this._allPlayers.set(allPlayers)
  }

  public updateGameData(gameData: GameData): void {
    this._gameData.set(gameData)
  }

  public updateGameDataField<K extends keyof GameData>(
    field: K,
    value: GameData[K]
  ): void {
    this._gameData.set({ ...this.gameData(), [field]: value })
  }

  public setSearchInputPlaceHolderText(
    numberOfGuesses: number,
    gameStatus?: GameStatus
  ): string {
    if (numberOfGuesses === 0) {
      return InputPlaceHolderText.GUESS
    }

    if (gameStatus === GameStatus.WIN) {
      return InputPlaceHolderText.WIN
    }

    if (gameStatus === GameStatus.LOSS) {
      return InputPlaceHolderText.LOSE
    }

    return `${9 - numberOfGuesses} ${InputPlaceHolderText.COUNT}`
  }

  public selectPlayer(selectedPlayer: UiPlayer): void {
    this.updateGameDataField(
      'numberOfGuesses',
      this.gameData().numberOfGuesses + 1
    )
    this.updateGameDataField('showNewGameButton', true)
    const playerToGuess = this.gameData().playerToGuess
    selectedPlayer.colorMap = getPlayerKeyToBackgroundColorMap(
      playerToGuess,
      selectedPlayer,
      false
    )
    const colorMapValuesArray = Array.from(selectedPlayer.colorMap.values())
    const newSelectedPlayers = this.gameData().selectedPlayers
    newSelectedPlayers.unshift(selectedPlayer)
    this.updateGameDataField('selectedPlayers', newSelectedPlayers)

    const playerRequest: BaseballPlayerRequest = {
      type: PlayerType.BASEBALL,
      name: selectedPlayer.name,
      team: selectedPlayer.team,
      position: selectedPlayer.pos,
      age: Number(selectedPlayer.age),
      countryOfBirth: selectedPlayer.born,
      battingHand: selectedPlayer.b,
      throwingHand: selectedPlayer.t,
      leagueDivision: selectedPlayer.lgDiv
    }
    const isGameFinished = this.isGameFinished(colorMapValuesArray)
    const colorMapString = JSON.stringify(Array.from(selectedPlayer.colorMap.entries()));

    const guessRequest: GuessCreateRequest = {
      player: playerRequest,
      isCorrect: isGameFinished,
      colorMap: colorMapString,
    }

    this.guessService
      .createGuess(this.gameId(), guessRequest)
      .subscribe((response) => {
        console.log('Guess created:', response)
      })

    if (isGameFinished) {
      return
    }

    const numberOfGuesses = this.gameData().numberOfGuesses
    const inputPlaceHolderText = this.setSearchInputPlaceHolderText(
      numberOfGuesses,
      GameStatus.IN_PROCESS
    )
    this.updateGameDataField('searchInputPlaceHolderText', inputPlaceHolderText)
    this.setNewAttrColorForAllGuessablePlayers(selectedPlayer)
  }

  public startNewGame(newGameRequest: GameCreateRequest, userId: number): void {
    if (!this.gameData().endOfGame) {
      this.setGameStatusAbandoned(userId)
    }
    this.createGame(newGameRequest).subscribe((game) => {
      this._gameId.set(game.id)
      this.resetColorMaps()
      this.updateGameDataField('numberOfGuesses', 0)
      this.updateGameDataField('showNewGameButton', false)
      this.updateGameDataField('endOfGame', false)
      this.updateGameDataField(
        'searchInputPlaceHolderText',
        InputPlaceHolderText.GUESS
      )
      this.updateGameDataField('isSearchDisabled', false)
      this.updateGameDataField('selectedPlayers', [])
      this.updatePlayerAttrColorForAllGuessablePlayers()
    })
  }

  public setGameStatusAbandoned(userId: number): void {
    const updateGameRequest: GameUpdateRequest = {
      status: GameStatus.ABANDONED,
      timesViewedActiveRoster: this.gameData().timesViewedActiveRoster,
      numberOfGuesses: this.gameData().numberOfGuesses,
      userId,
      leagueId: 1,
      gameTypeId: 1,
    }
    this.updateGame(updateGameRequest, this.gameId()).subscribe({
      error: (err) => {
        console.error('Error updating game: ', err)
      },
    })
  }

  public increaseNumberOfGuesses(): void {
    this.updateGameDataField(
      'numberOfGuesses',
      this.gameData().numberOfGuesses + 1
    )
  }

  public setInProgressPlaceHolderText(): void {
    const inputPlaceHolderText = this.setSearchInputPlaceHolderText(
      this.gameData().numberOfGuesses,
      GameStatus.IN_PROCESS
    )
    this.updateGameDataField('searchInputPlaceHolderText', inputPlaceHolderText)
  }

  public setPlayerToGuess(player: UiPlayer): void {
    this.updateGameDataField('playerToGuess', player)
  }

  public isGameFinished(colorMapValuesArray?: string[]): boolean {
    if (
      !!colorMapValuesArray &&
      !colorMapValuesArray.includes(PlayerAttrColor.NONE) &&
      !colorMapValuesArray.includes(PlayerAttrColor.ORANGE)
    ) {
      this.updateGameDataField('endResultText', EndResultMessage.WIN)
      this.updateGameDataField('endOfGame', true)
      this.updateGameDataField(
        'searchInputPlaceHolderText',
        InputPlaceHolderText.WIN
      )
      this.updateGameDataField('isSearchDisabled', true)
      return true
    }

    if (this.gameData().numberOfGuesses >= 9) {
      this.updateGameDataField('endResultText', EndResultMessage.LOSE)
      this.updateGameDataField('endOfGame', true)
      this.updateGameDataField(
        'searchInputPlaceHolderText',
        InputPlaceHolderText.LOSE
      )
      this.updateGameDataField('isSearchDisabled', true)
      return true
    }

    return false
  }

  public updateUser(userId: number): void {
    const updateGameRequest: GameUpdateRequest = {
      status: GameStatus.IN_PROCESS,
      timesViewedActiveRoster: this.gameData().timesViewedActiveRoster,
      numberOfGuesses: this.gameData().numberOfGuesses,
      userId: userId,
      leagueId: 1,
      gameTypeId: 1,
    }

    this.updateGame(updateGameRequest, this.gameId()).subscribe({
      error: (err) => {
        console.error('Error updating game: ', err)
      },
    })
  }

  private createGame(request: GameCreateRequest): Observable<Game> {
    const headers = this.auth.getHeaders()
    const reqUrl = `${this.baseUrl}${this.gameEndpoint}`
    const response = this.http.post<GameResponse>(reqUrl, request, { headers })

    return response.pipe(
      map((gameResponse) => {
        return {
          id: gameResponse.id,
          startTime: new Date(gameResponse.start_time),
          endTime: gameResponse.end_time
            ? new Date(gameResponse.end_time)
            : null,
          status: gameResponse.status as GameStatus,
          remainingGuesses: gameResponse.remaining_guesses,
          numberOfGuesses: gameResponse.number_of_guesses,
          timesViewedActiveRoster: gameResponse.times_viewed_active_roster,
          userId: gameResponse.user_id,
          leagueId: gameResponse.league_id,
          gameTypeId: gameResponse.game_type_id,
        }
      })
    )
  }

  private updateGame(
    request: GameUpdateRequest,
    gameId: number
  ): Observable<Game> {
    const headers = this.auth.getHeaders()
    const reqUrl = `${this.baseUrl}${this.gameEndpoint}/${gameId}`
    const response = this.http.post<GameResponse>(reqUrl, request, { headers })

    return response.pipe(
      map((gameResponse) => {
        return {
          id: gameResponse.id,
          startTime: new Date(gameResponse.start_time),
          endTime: gameResponse.end_time
            ? new Date(gameResponse.end_time)
            : null,
          status: gameResponse.status as GameStatus,
          remainingGuesses: gameResponse.remaining_guesses,
          numberOfGuesses: gameResponse.number_of_guesses,
          timesViewedActiveRoster: gameResponse.times_viewed_active_roster,
          userId: gameResponse.user_id,
          leagueId: gameResponse.league_id,
          gameTypeId: gameResponse.game_type_id,
        }
      })
    )
  }

  private setNewAttrColorForAllGuessablePlayers(
    selectedPlayer: UiPlayer
  ): void {
    const coloredPlayerAttributes: PlayerAttr[] = []
    for (const attr of selectedPlayer.colorMap.keys()) {
      if (
        selectedPlayer.colorMap.get(attr as PlayerAttr) !== PlayerAttrColor.NONE
      ) {
        coloredPlayerAttributes.push(attr)
      }
    }

    this.updatePlayerAttrColorForAllGuessablePlayers(
      coloredPlayerAttributes,
      selectedPlayer
    )
  }

  private resetColorMaps(): void {
    const newGuessablePlayers = this.gameData().guessablePlayers
    for (const player of newGuessablePlayers) {
      player.colorMap = this.initializePlaterAttrColorMap()
    }
    this.updateGameDataField('guessablePlayers', newGuessablePlayers)
  }

  private initializePlaterAttrColorMap(): Map<PlayerAttr, PlayerAttrColor> {
    const playerAttributes = Object.values(PlayerAttr).filter(
      (key) => key !== PlayerAttr.NAME
    )
    const playerAttrBackgroundColorMap = new Map<PlayerAttr, PlayerAttrColor>()

    for (const attr of playerAttributes) {
      playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE)
    }
    return playerAttrBackgroundColorMap
  }

  private updatePlayerAttrColorForAllGuessablePlayers(
    attributes?: PlayerAttr[],
    selectedPlayer?: UiPlayer
  ): void {
    if (!attributes && !selectedPlayer) {
      const newGuessablePlayers = this.gameData().guessablePlayers
      for (const player of newGuessablePlayers) {
        player.colorMap = this.initializePlaterAttrColorMap()
      }
      this.updateGameDataField('guessablePlayers', newGuessablePlayers)
      return
    }

    if (attributes && selectedPlayer) {
      const newGuessablePlayers = this.gameData().guessablePlayers
      for (const player of newGuessablePlayers) {
        for (const attr of attributes) {
          if (
            player[attr as PlayerAttr] === selectedPlayer[attr as PlayerAttr]
          ) {
            const selectedPlayerAttrColor = selectedPlayer.colorMap.get(
              attr as PlayerAttr
            )
            player.colorMap.set(
              attr as PlayerAttr,
              selectedPlayerAttrColor as PlayerAttrColor
            )
          }
        }
      }
      this.updateGameDataField('guessablePlayers', newGuessablePlayers)
      return
    }
  }
}
