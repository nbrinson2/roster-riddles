import { Injectable } from '@angular/core'

import { PlayerAttr, PlayerAttrColor, UiPlayer } from '../models/models'
import { GameStatus } from './models'
import { InputPlaceHolderText } from './constants'

@Injectable({
  providedIn: 'root',
})
export class GameUtilityService {
  initializePlayerAttrColorMap(): Map<PlayerAttr, PlayerAttrColor> {
    const playerAttributes = Object.values(PlayerAttr).filter(
      (key) => key !== PlayerAttr.NAME
    )
    const playerAttrBackgroundColorMap = new Map<PlayerAttr, PlayerAttrColor>()

    for (const attr of playerAttributes) {
      playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE)
    }
    return playerAttrBackgroundColorMap
  }

  setSearchInputPlaceHolderText(
    numberOfGuesses: number,
    maxNumberOfGuesses: number,
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

    return `${maxNumberOfGuesses - numberOfGuesses} ${
      InputPlaceHolderText.COUNT
    }`
  }

  
  getPlayerKeyToBackgroundColorMap(
    playerToGuess: UiPlayer,
    selectedPlayer: UiPlayer,
    initialize: boolean
  ): Map<PlayerAttr, PlayerAttrColor> {
    const playerAttributes = Object.values(PlayerAttr).filter(
      (key) => key !== PlayerAttr.NAME
    )
    const backgroundColors = Object.values(PlayerAttrColor)
    const playerAttrBackgroundColorMap = new Map<PlayerAttr, PlayerAttrColor>()

    if (initialize) {
      for (const attr of playerAttributes) {
        playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE)
      }
      return playerAttrBackgroundColorMap
    }

    for (const attr of playerAttributes) {
      switch (attr) {
        case PlayerAttr.TEAM:
        case PlayerAttr.B:
        case PlayerAttr.T:
        case PlayerAttr.BORN:
        case PlayerAttr.POS:
          if (playerToGuess[attr] === selectedPlayer[attr]) {
            playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.BLUE)
            break
          }

          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE)
          break
        case PlayerAttr.LG_DIV:
          const playerToGuessLgDivArray = playerToGuess[attr].split(' ')
          const selectedPlayerLgDivArray = selectedPlayer[attr].split(' ')
          const mismatchArray = playerToGuessLgDivArray.filter(
            (elem) => selectedPlayerLgDivArray.indexOf(elem) < 0
          )

          if (mismatchArray.length === 0) {
            playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.BLUE)
            break
          }

          if (mismatchArray.length === 1) {
            playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.ORANGE)
            break
          }

          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE)

          break
        case PlayerAttr.AGE:
          const ageDifference =
            Number(playerToGuess[attr]) - Number(selectedPlayer[attr])

          if (ageDifference === 0) {
            playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.BLUE)
            break
          }

          if (ageDifference <= 2 && ageDifference >= -2) {
            playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.ORANGE)
            break
          }

          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE)
          break
        default:
          break
      }
    }

    return playerAttrBackgroundColorMap
  }
}
