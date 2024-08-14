import { Injectable } from '@angular/core';
import { MlbHeaders } from 'src/app/shared/constants/attribute-headers';
import { MlbPlayer, PlayerAttributeColor } from 'src/app/shared/models/mlb-models';
import { BaseballPlayerRequest, GameStatus, GuessCreateRequest, PlayerType } from '../models';
import { BaseGameService } from './base-game.service';
import { GameService } from './models';
import { EndResultMessage } from '../constants';
import { LeagueType } from 'src/app/shared/models/models';
import { MlbPlayerAttributes } from 'src/app/shared/enumeration/attributes';

@Injectable({
  providedIn: 'root',
})
export class MlbGameService extends BaseGameService {
  getHeaders() {
    return MlbHeaders;
  }

  initializeGameData(): void {
    this.updateGameDataField('headers', MlbHeaders);
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
  }

  createPlayerRequest(player: MlbPlayer): BaseballPlayerRequest {
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

  setPlayerToGuess(players: MlbPlayer[]): void {
    const playerToGuess = players[Math.floor(Math.random() * players.length)];
    this.updateGameDataField('playerToGuess', playerToGuess);
  }

  updateSelectedPlayer(selectedPlayer: MlbPlayer): string[] {
    const playerToGuess = this.gameData().playerToGuess;
    selectedPlayer.colorMap = this.gameUtilityService.getPlayerKeyToBackgroundColorMap(
      playerToGuess,
      selectedPlayer,
      false,
      LeagueType.MLB
    ) as Map<MlbPlayerAttributes, PlayerAttributeColor>;

    const colorMapValuesArray = Array.from(selectedPlayer.colorMap.values());
    const newSelectedPlayers = [selectedPlayer, ...this.gameData().selectedPlayers];
    this.updateGameDataField('selectedPlayers', newSelectedPlayers);
    return colorMapValuesArray;
  }

  selectPlayer(selectedPlayer: MlbPlayer): void {
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
        this.gameUtilityService.resetPlayerColorMap(correctPlayer, LeagueType.MLB);
        this.toastService.showToast(correctPlayer);
      }
      return;
    }

    const numberOfGuesses = this.gameData().numberOfGuesses;
    const inputPlaceHolderText = this.gameUtilityService.setSearchInputPlaceHolderText(
      numberOfGuesses,
      1,
      GameStatus.IN_PROCESS
    );
    this.updateGameDataField('searchInputPlaceHolderText', inputPlaceHolderText);
    this.setNewAttributeColorForAllGuessablePlayers(selectedPlayer);
  }

  createGuessRequest(selectedPlayer: MlbPlayer, colorMapValuesArray: string[]): GuessCreateRequest {
    const playerRequest = this.createPlayerRequest(selectedPlayer);
    const colorMapString = JSON.stringify(Array.from(selectedPlayer.colorMap.entries()));
    return {
      player: playerRequest,
      isCorrect: this.isGameFinished(colorMapValuesArray),
      colorMap: colorMapString,
    };
  }
}
