import { MlbPlayerAttributes, MlbUiPlayer } from "src/app/game/bio-ball/models/mlb.models";
import { PlayerAttrColor } from "src/app/shared/models/common-models";
import { Header } from "src/app/game/shared/common-attribute-header/common-attribute-header.component";

export interface Data {
  players: MlbUiPlayer[];
}

export const Headers: Header[] = [
  { name: 'TEAM', colSpan: 1, class: 'team-column' },
  { name: 'LG./DIV.', colSpan: 2, class: 'lg-div-column' },
  { name: 'B', colSpan: 1, class: 'b-column' },
  { name: 'T', colSpan: 1, class: 't-column' },
  { name: 'BORN', colSpan: 2, class: 'born-column' },
  { name: 'AGE', colSpan: 1, class: 'age-column' },
  { name: 'POS.', colSpan: 1, class: 'pos-column' },
];

export function getPlayerKeyToBackgroundColorMap(playerToGuess: MlbUiPlayer, selectedPlayer: MlbUiPlayer, initialize: boolean): Map<MlbPlayerAttributes, PlayerAttrColor> {
  const playerAttributes = Object.values(MlbPlayerAttributes).filter((key) => key !== MlbPlayerAttributes.NAME);
  const playerAttrBackgroundColorMap = new Map<MlbPlayerAttributes, PlayerAttrColor>();

  if (initialize) {
    for (const attr of playerAttributes) {
      playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);
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
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.BLUE)
          break;
        }

        playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);
        break;
      case MlbPlayerAttributes.LG_DIV:
        const playerToGuessLgDivArray = playerToGuess[attr].split(' ');
        const selectedPlayerLgDivArray = selectedPlayer[attr].split(' ');
        const mismatchArray = playerToGuessLgDivArray.filter((elem) => selectedPlayerLgDivArray.indexOf(elem) < 0);

        if (mismatchArray.length === 0) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.BLUE);
          break;
        }

        if (mismatchArray.length === 1) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.ORANGE);
          break;
        }

        playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);

        break;
      case MlbPlayerAttributes.AGE:
        const ageDifference = Number(playerToGuess[attr]) - Number(selectedPlayer[attr]);

        if (ageDifference === 0) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.BLUE);
          break;
        }

        if (ageDifference <= 2 && ageDifference >= -2) {
          playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.ORANGE);
          break;
        }

        playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);
        break;
      default:
        break;
    }
  }

  return playerAttrBackgroundColorMap;
}