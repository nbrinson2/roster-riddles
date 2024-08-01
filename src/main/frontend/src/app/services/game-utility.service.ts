import { Injectable } from '@angular/core';

import { PlayerAttributeColor, MlbPlayer } from '../shared/models/mlb-models';
import { GameStatus } from './models';
import { InputPlaceHolderText } from './constants';
import { MlbPlayerAttributes } from '../shared/enumeration/attributes';

@Injectable({
  providedIn: 'root',
})
export class GameUtilityService {
  initializePlayerAttrColorMap(): Map<MlbPlayerAttributes, PlayerAttributeColor> {
    const playerAttributes = Object.values(MlbPlayerAttributes).filter(
      (key) => key !== MlbPlayerAttributes.NAME
    );
    const playerAttrBackgroundColorMap = new Map<MlbPlayerAttributes, PlayerAttributeColor>();

    for (const attr of playerAttributes) {
      playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.NONE);
    }
    return playerAttrBackgroundColorMap;
  }

  setSearchInputPlaceHolderText(
    numberOfGuesses: number,
    maxNumberOfGuesses: number,
    gameStatus?: GameStatus
  ): string {
    if (numberOfGuesses === 0) {
      return InputPlaceHolderText.GUESS;
    }

    if (gameStatus === GameStatus.WIN) {
      return InputPlaceHolderText.WIN;
    }

    if (gameStatus === GameStatus.LOSS) {
      return InputPlaceHolderText.LOSE;
    }

    return `${maxNumberOfGuesses - numberOfGuesses} ${InputPlaceHolderText.COUNT}`;
  }

  getPlayerKeyToBackgroundColorMap(
    playerToGuess: MlbPlayer,
    selectedPlayer: MlbPlayer,
    initialize: boolean
  ): Map<MlbPlayerAttributes, PlayerAttributeColor> {
    const playerAttributes = Object.values(MlbPlayerAttributes).filter(
      (key) => key !== MlbPlayerAttributes.NAME
    );
    const backgroundColors = Object.values(PlayerAttributeColor);
    const playerAttrBackgroundColorMap = new Map<MlbPlayerAttributes, PlayerAttributeColor>();

    if (initialize) {
      for (const attr of playerAttributes) {
        playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.NONE);
      }
      return playerAttrBackgroundColorMap;
    }

    for (const attr of playerAttributes) {
      switch (attr) {
        case MlbPlayerAttributes.TEAM:
        case MlbPlayerAttributes.B:
        case MlbPlayerAttributes.T:
        case MlbPlayerAttributes.BORN:
        case MlbPlayerAttributes.POS:
          if (playerToGuess[attr] === selectedPlayer[attr]) {
            playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.BLUE);
            break;
          }

          playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.NONE);
          break;
        case MlbPlayerAttributes.LG_DIV:
          const playerToGuessLgDivArray = playerToGuess[attr].split(' ');
          const selectedPlayerLgDivArray = selectedPlayer[attr].split(' ');
          const mismatchArray = playerToGuessLgDivArray.filter(
            (elem) => selectedPlayerLgDivArray.indexOf(elem) < 0
          );

          if (mismatchArray.length === 0) {
            playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.BLUE);
            break;
          }

          if (mismatchArray.length === 1) {
            playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.ORANGE);
            break;
          }

          playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.NONE);

          break;
        case MlbPlayerAttributes.AGE:
          const ageDifference = Number(playerToGuess[attr]) - Number(selectedPlayer[attr]);

          if (ageDifference === 0) {
            playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.BLUE);
            break;
          }

          if (ageDifference <= 2 && ageDifference >= -2) {
            playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.ORANGE);
            break;
          }

          playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.NONE);
          break;
        default:
          break;
      }
    }

    return playerAttrBackgroundColorMap;
  }
}
