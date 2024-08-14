import { Injectable } from '@angular/core';
import { MlbPlayerAttributes, NflPlayerAttributes } from 'src/app/shared/enumeration/attributes';
import { PlayerAttributeColor, MlbPlayer } from 'src/app/shared/models/mlb-models';
import { InputPlaceHolderText } from '../constants';
import { GameStatus } from '../models';
import { LeagueType, Player } from 'src/app/shared/models/models';
import { PlayerType } from './base-game.service';
import { NflPlayer } from 'src/app/shared/models/nfl-models';

type PlayerAttributes = MlbPlayerAttributes | NflPlayerAttributes;

@Injectable({
  providedIn: 'root',
})
export class GameUtilityService {
  public initializePlayerAttrColorMap(
    league: LeagueType
  ): Map<PlayerAttributes, PlayerAttributeColor> {
    const playerAttributes =
      league === LeagueType.MLB
        ? Object.values(MlbPlayerAttributes).filter((key) => key !== MlbPlayerAttributes.NAME)
        : Object.values(NflPlayerAttributes).filter((key) => key !== NflPlayerAttributes.NAME);

    const playerAttrBackgroundColorMap = new Map<PlayerAttributes, PlayerAttributeColor>();

    for (const attr of playerAttributes) {
      playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.NONE);
    }
    return playerAttrBackgroundColorMap;
  }

  public setSearchInputPlaceHolderText(
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

  public getPlayerKeyToBackgroundColorMap(
    playerToGuess: PlayerType,
    selectedPlayer: PlayerType,
    initialize: boolean,
    league: LeagueType
  ): Map<PlayerAttributes, PlayerAttributeColor> {
    const playerAttributes =
      league === LeagueType.MLB
        ? Object.values(MlbPlayerAttributes).filter((key) => key !== MlbPlayerAttributes.NAME)
        : Object.values(NflPlayerAttributes).filter((key) => key !== NflPlayerAttributes.NAME);

    playerToGuess =
      league === LeagueType.MLB ? (playerToGuess as MlbPlayer) : (playerToGuess as NflPlayer);
    selectedPlayer =
      league === LeagueType.MLB ? (selectedPlayer as MlbPlayer) : (selectedPlayer as NflPlayer);

    const playerAttrBackgroundColorMap = new Map<PlayerAttributes, PlayerAttributeColor>();

    if (initialize) {
      for (const attr of playerAttributes) {
        playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.NONE);
      }
      return playerAttrBackgroundColorMap;
    }

    for (const attr of playerAttributes) {
      playerAttrBackgroundColorMap.set(
        attr,
        this.getAttributeColor(playerToGuess, selectedPlayer, attr, league)
      );
    }

    return playerAttrBackgroundColorMap;
  }

  public resetPlayerColorMap(player: PlayerType, league: LeagueType): void {
    switch (league) {
      case LeagueType.MLB:
        (player as MlbPlayer).colorMap = this.initializePlayerAttrColorMap(league) as Map<
          MlbPlayerAttributes,
          PlayerAttributeColor
        >;
        break;
      case LeagueType.NFL:
        (player as NflPlayer).colorMap = this.initializePlayerAttrColorMap(league) as Map<
          NflPlayerAttributes,
          PlayerAttributeColor
        >;
        break;
    }
  }

  public updateAllPlayersAttributeColors(
    players: PlayerType[],
    league: LeagueType,
    selectedPlayer?: PlayerType
  ): void {
    switch (league) {
      case LeagueType.MLB:
        this.setAllMlbPlayersAttributeColors(players as MlbPlayer[], selectedPlayer as MlbPlayer);
        break;
      case LeagueType.NFL:
        this.setAllNflPlayersAttributeColors(players as NflPlayer[], selectedPlayer as NflPlayer);
        break;
      default:
        break;
    }
  }

  private setAllMlbPlayersAttributeColors(players: MlbPlayer[], selectedPlayer?: MlbPlayer): void {
    if (!selectedPlayer) {
      for (const player of players as MlbPlayer[]) {
        this.resetPlayerColorMap(player, LeagueType.MLB);
      }
    }
    if (selectedPlayer) {
      const selectedPlayerAttributes = this.getPlayerAttributesWithColor(selectedPlayer, LeagueType.MLB) as MlbPlayerAttributes[];
      const mlbSelectedPlayer = selectedPlayer as MlbPlayer;
      for (const player of players as MlbPlayer[]) {
        for (const attribute of selectedPlayerAttributes) {
          const mlbAttribute = attribute as MlbPlayerAttributes;
          if (player[mlbAttribute] === mlbSelectedPlayer[mlbAttribute]) {
            const selectedPlayerAttributeColor = mlbSelectedPlayer.colorMap.get(mlbAttribute) as PlayerAttributeColor;
            player.colorMap.set(mlbAttribute, selectedPlayerAttributeColor);
          }
        }
      }
    }
  }

  private setAllNflPlayersAttributeColors(players: NflPlayer[], selectedPlayer?: NflPlayer): void {
    if (!selectedPlayer) {
      for (const player of players as NflPlayer[]) {
        this.resetPlayerColorMap(player, LeagueType.NFL);
      }
    }
    if (selectedPlayer) {
      const selectedPlayerAttributes = this.getPlayerAttributesWithColor(selectedPlayer, LeagueType.NFL) as NflPlayerAttributes[];
      const nflSelectedPlayer = selectedPlayer as NflPlayer;
      for (const player of players as NflPlayer[]) {
        for (const attribute of selectedPlayerAttributes) {
          const nflAttribute = attribute as NflPlayerAttributes;
          if (player[nflAttribute] === nflSelectedPlayer[nflAttribute]) {
            const selectedPlayerAttributeColor = nflSelectedPlayer.colorMap.get(nflAttribute) as PlayerAttributeColor;
            player.colorMap.set(nflAttribute, selectedPlayerAttributeColor);
          }
        }
      }
    }
  }

  private getPlayerAttributesWithColor(player: PlayerType, league: LeagueType): PlayerAttributes[] {
    switch (league) {
      case LeagueType.MLB:
        const mlbPlayer = player as MlbPlayer;
        return Array.from(mlbPlayer.colorMap.keys()).filter(
          (attr) =>
            mlbPlayer.colorMap.get(attr as MlbPlayerAttributes) !== PlayerAttributeColor.NONE
        );

      case LeagueType.NFL:
        const nflPlayer = player as NflPlayer;
        return Array.from((player as NflPlayer).colorMap.keys()).filter(
          (attr) =>
            nflPlayer.colorMap.get(attr as NflPlayerAttributes) !== PlayerAttributeColor.NONE
        );
      default:
        return [];
    }
  }

  private getAttributeColor(
    playerToGuess: PlayerType,
    selectedPlayer: PlayerType,
    attribute: PlayerAttributes,
    league: LeagueType
  ): PlayerAttributeColor {
    switch (league) {
      case LeagueType.MLB:
        return this.getMlbAttributeColor(
          playerToGuess as MlbPlayer,
          selectedPlayer as MlbPlayer,
          attribute as MlbPlayerAttributes
        );
      case LeagueType.NFL:
        return this.getNflAttributeColor(
          playerToGuess as NflPlayer,
          selectedPlayer as NflPlayer,
          attribute as NflPlayerAttributes
        );
      default:
        return PlayerAttributeColor.NONE;
    }
  }

  private getMlbAttributeColor(
    playerToGuess: MlbPlayer,
    selectedPlayer: MlbPlayer,
    attr: MlbPlayerAttributes
  ): PlayerAttributeColor {
    switch (attr) {
      case MlbPlayerAttributes.TEAM:
      case MlbPlayerAttributes.B:
      case MlbPlayerAttributes.T:
      case MlbPlayerAttributes.BORN:
      case MlbPlayerAttributes.POS:
        return playerToGuess[attr] === selectedPlayer[attr]
          ? PlayerAttributeColor.BLUE
          : PlayerAttributeColor.NONE;
      case MlbPlayerAttributes.LG_DIV:
        return this.getLeagueDivisionColor(playerToGuess[attr], selectedPlayer[attr]);
      case MlbPlayerAttributes.AGE:
        return this.getAgeColor(playerToGuess[attr], selectedPlayer[attr]);
      default:
        return PlayerAttributeColor.NONE;
    }
  }

  private getNflAttributeColor(
    playerToGuess: NflPlayer,
    selectedPlayer: NflPlayer,
    attr: NflPlayerAttributes
  ): PlayerAttributeColor {
    switch (attr) {
      case NflPlayerAttributes.TEAM:
      case NflPlayerAttributes.POSITION:
      case NflPlayerAttributes.COLLEGE:
        return playerToGuess[attr] === selectedPlayer[attr]
          ? PlayerAttributeColor.BLUE
          : PlayerAttributeColor.NONE;
      case NflPlayerAttributes.JERSEY_NUMBER:
        return this.getJerseyNumberColor(playerToGuess[attr], selectedPlayer[attr]);
      case NflPlayerAttributes.DRAFT_YEAR:
        return this.getDraftYearColor(playerToGuess[attr], selectedPlayer[attr]);
      case NflPlayerAttributes.LG_DIV:
        return this.getLeagueDivisionColor(playerToGuess[attr], selectedPlayer[attr]);
      case NflPlayerAttributes.AGE:
        return this.getAgeColor(playerToGuess[attr], selectedPlayer[attr]);
      default:
        return PlayerAttributeColor.NONE;
    }
  }

  private getLeagueDivisionColor(
    playerToGuessLgDiv: string,
    selectedPlayerLgDiv: string
  ): PlayerAttributeColor {
    const playerToGuessLgDivArray = playerToGuessLgDiv.split(' ');
    const selectedPlayerLgDivArray = selectedPlayerLgDiv.split(' ');
    const mismatchArray = playerToGuessLgDivArray.filter(
      (elem) => selectedPlayerLgDivArray.indexOf(elem) < 0
    );

    if (mismatchArray.length === 0) {
      return PlayerAttributeColor.BLUE;
    }

    if (mismatchArray.length === 1) {
      return PlayerAttributeColor.ORANGE;
    }

    return PlayerAttributeColor.NONE;
  }

  private getAgeColor(playerToGuessAge: string, selectedPlayerAge: string): PlayerAttributeColor {
    const ageDifference = Number(playerToGuessAge) - Number(selectedPlayerAge);

    if (ageDifference === 0) {
      return PlayerAttributeColor.BLUE;
    }

    if (ageDifference <= 2 && ageDifference >= -2) {
      return PlayerAttributeColor.ORANGE;
    }

    return PlayerAttributeColor.NONE;
  }

  private getJerseyNumberColor(
    playerToGuessJerseyNumber: string,
    selectedPlayerJerseyNumber: string
  ): PlayerAttributeColor {
    const jerseyNumberDifference =
      Number(playerToGuessJerseyNumber) - Number(selectedPlayerJerseyNumber);

    if (jerseyNumberDifference === 0) {
      return PlayerAttributeColor.BLUE;
    }

    if (jerseyNumberDifference <= 2 && jerseyNumberDifference >= -2) {
      return PlayerAttributeColor.ORANGE;
    }

    return PlayerAttributeColor.NONE;
  }

  private getDraftYearColor(
    playerToGuessDraftYear: string,
    selectedPlayerDraftYear: string
  ): PlayerAttributeColor {
    const draftYearDifference = Number(playerToGuessDraftYear) - Number(selectedPlayerDraftYear);

    if (draftYearDifference === 0) {
      return PlayerAttributeColor.BLUE;
    }

    if (draftYearDifference <= 2 && draftYearDifference >= -2) {
      return PlayerAttributeColor.ORANGE;
    }

    return PlayerAttributeColor.NONE;
  }
}
