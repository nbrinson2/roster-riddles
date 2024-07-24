import { Injectable } from '@angular/core'

import { MlbPlayerAttr, PlayerAttrColor, MlbPlayer } from '../shared/mlb-models'
import { GameStatus } from './models'
import { InputPlaceHolderText } from './constants'

@Injectable({
  providedIn: 'root',
})
export class GameUtilityService {
  initializePlayerAttrColorMap(): Map<MlbPlayerAttr, PlayerAttrColor> {
    const playerAttributes = Object.values(MlbPlayerAttr).filter(
      (key) => key !== MlbPlayerAttr.NAME
    )
    const playerAttrBackgroundColorMap = new Map<MlbPlayerAttr, PlayerAttrColor>()

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
    playerToGuess: MlbPlayer,
    selectedPlayer: MlbPlayer,
    initialize: boolean
  ): Map<MlbPlayerAttr, PlayerAttrColor> {
    const playerAttributes = Object.values(MlbPlayerAttr).filter(
      (key) => key !== MlbPlayerAttr.NAME
    )
    const backgroundColors = Object.values(PlayerAttrColor)
    const playerAttrBackgroundColorMap = new Map<MlbPlayerAttr, PlayerAttrColor>()

    if (initialize) {
      for (const attr of playerAttributes) {
        playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE)
      }
      return playerAttrBackgroundColorMap
    }

    for (const attr of playerAttributes) {
      switch (attr) {
        case MlbPlayerAttr.TEAM:
        case MlbPlayerAttr.B:
        case MlbPlayerAttr.T:
        case MlbPlayerAttr.BORN:
        case MlbPlayerAttr.POS:
          if (playerToGuess[attr] === selectedPlayer[attr]) {
            playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.BLUE)
            break
          }

          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE)
          break
        case MlbPlayerAttr.LG_DIV:
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
        case MlbPlayerAttr.AGE:
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
