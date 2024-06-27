import { Component, EventEmitter, Input, Output } from '@angular/core'
import { PlayerAttr, PlayerAttrColor, UiPlayer } from '../models/models'
import { ActivatedRoute } from '@angular/router'
import { first } from 'rxjs'
import {
  Data,
  EndResultMessage,
  Headers,
  InputPlaceHolderText,
  getPlayerKeyToBackgroundColorMap,
} from './util/util'
import { GameService } from '../services/game.service'
import { GameCreateRequest } from '../services/models'

@Component({
  selector: 'home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  @Output() selectRosterEvent = new EventEmitter<UiPlayer[]>()

  private allPlayers: UiPlayer[] = []
  private numberOfGuesses = 0

  protected headers = Headers
  protected guessablePlayers: UiPlayer[] = []
  protected selectedPlayers: UiPlayer[] = []
  protected playerToGuess!: UiPlayer
  protected endResultText = EndResultMessage.WIN
  protected endOfGame = false
  protected isSearchDisabled = false
  protected searchInputPlaceHolderText: string = InputPlaceHolderText.GUESS

  constructor(private route: ActivatedRoute, private gameService: GameService) {
    this.initializePlayerColorMapAndGuessablePlayers()
    this.route.data.pipe(first()).subscribe((d) => {
      this.allPlayers = (d as Data).players
    })
  }

  private initializePlayerColorMapAndGuessablePlayers(): void {
    this.route.data.pipe(first()).subscribe((data) => {
      const players = (data as Data).players
      this.guessablePlayers = players
      const randomIndex = Math.floor(
        Math.random() * (data as Data).players.length
      )
      this.playerToGuess = players[randomIndex]
    })
  }

  protected selectPlayer(selectedPlayer: UiPlayer): void {
    this.numberOfGuesses++
    selectedPlayer.colorMap = getPlayerKeyToBackgroundColorMap(
      this.playerToGuess,
      selectedPlayer,
      false
    )
    const colorMapValuesArray = Array.from(selectedPlayer.colorMap.values())
    this.selectedPlayers.unshift(selectedPlayer)

    if (this.isGameFinished(colorMapValuesArray)) {
      return
    }

    this.searchInputPlaceHolderText = `${9 - this.numberOfGuesses} ${
      InputPlaceHolderText.COUNT
    }`
    this.setNewAttrColorForAllGuessablePlayers(selectedPlayer)
  }

  protected startNewGame(): void {
    const newGameRequest: GameCreateRequest = {
      userId: 1,
      leagueId: 1,
      gameTypeId: 1,
    }

    this.gameService.createGame(newGameRequest).subscribe(() => {
      this.resetColorMaps()
      this.getNewPlayerToGuess()
      this.numberOfGuesses = 0
      this.endOfGame = false
      this.searchInputPlaceHolderText = InputPlaceHolderText.GUESS
      this.isSearchDisabled = false
      this.selectedPlayers = []
      this.updatePlayerAttrColorForAllGuessablePlayers()
    })
  }

  protected selectRoster(team: string): void {
    this.numberOfGuesses++

    if (this.isGameFinished()) {
      return
    }

    this.searchInputPlaceHolderText = `${9 - this.numberOfGuesses} ${
      InputPlaceHolderText.COUNT
    }`
    const selectedRoster = this.allPlayers.filter(
      (player) => player.team === team
    )
    this.selectRosterEvent.emit(selectedRoster)
  }

  private isGameFinished(colorMapValuesArray?: string[]): boolean {
    if (
      !!colorMapValuesArray &&
      !colorMapValuesArray.includes(PlayerAttrColor.NONE) &&
      !colorMapValuesArray.includes(PlayerAttrColor.ORANGE)
    ) {
      this.endResultText = EndResultMessage.WIN
      this.endOfGame = true
      this.searchInputPlaceHolderText = InputPlaceHolderText.WIN
      this.isSearchDisabled = true
      return true
    }

    if (this.numberOfGuesses >= 9) {
      this.endResultText = EndResultMessage.LOSE
      this.endOfGame = true
      this.searchInputPlaceHolderText = InputPlaceHolderText.LOSE
      this.isSearchDisabled = true
      return true
    }

    return false
  }

  private getNewPlayerToGuess(): void {
    const randomIndex = Math.floor(Math.random() * this.allPlayers.length)
    this.playerToGuess = this.allPlayers[randomIndex]
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
    for (const player of this.guessablePlayers) {
      player.colorMap = this.initializePlaterAttrColorMap()
    }
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
      for (const player of this.guessablePlayers) {
        player.colorMap = this.initializePlaterAttrColorMap()
      }
      return
    }

    if (attributes && selectedPlayer) {
      for (const player of this.guessablePlayers) {
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
      return
    }
  }
}
