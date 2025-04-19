import { Injectable } from '@angular/core';
import { NflHeaders } from 'src/app/shared/constants/attribute-headers';
import { NflPlayer } from 'src/app/shared/models/nfl-models';
import { FootballPlayerRequest, GuessCreateRequest } from '../models';

@Injectable({
  providedIn: 'root',
})
export class NflGameService {
  getHeaders() {
    return NflHeaders;
  }

  initializeGameData(): void {
    this.updateGameDataField('headers', NflHeaders);
    this.updateGameDataField('guessablePlayers', []);
    this.updateGameDataField('selectedPlayers', []);
    this.updateGameDataField('endResultText', 'LOSE');
    this.updateGameDataField('endOfGame', false);
    this.updateGameDataField('isSearchDisabled', false);
    this.updateGameDataField('searchInputPlaceHolderText', this.gameUtilityService.setSearchInputPlaceHolderText(0, 1, 'IN_PROCESS'));
    this.updateGameDataField('numberOfGuesses', 0);
    this.updateGameDataField('showNewGameButton', false);
    this.updateGameDataField('timesViewedActiveRoster', 0);
  }

  createPlayerRequest(player: NflPlayer): FootballPlayerRequest {
    return {
      name: player.name,
      team: player.team,
      position: player.pos,
      age: Number(player.age),
      countryOfBirth: player.born,
      leagueDivision: player.lgDiv,
      type: 'FOOTBALL',
    };
  }

  setPlayerToGuess(players: NflPlayer[]): void {
    const playerToGuess = players[Math.floor(Math.random() * players.length)];
    this.updateGameDataField('playerToGuess', playerToGuess);
  }

  selectPlayer(selectedPlayer: NflPlayer): void {
    this.updateGameDataField('numberOfGuesses', this.gameData().numberOfGuesses + 1);
    this.updateGameDataField('showNewGameButton', true);

    const colorMapValuesArray = this.updateSelectedPlayer(selectedPlayer);
    const guessRequest = this.createGuessRequest(selectedPlayer, colorMapValuesArray);

    this.guessService.createGuess(this.gameId(), guessRequest).subscribe((response) => {
      console.log('Guess created:', response);
    });

    if (this.isGameFinished(colorMapValuesArray)) {
      if (this.gameData().endResultText === 'LOSE') {
        const correctPlayer = this.gameData().playerToGuess;
        this.resetPlayerColorMap(correctPlayer);
        this.toastService.showToast(correctPlayer);
      }
      return;
    }

    const numberOfGuesses = this.gameData().numberOfGuesses;
    const inputPlaceHolderText = this.gameUtilityService.setSearchInputPlaceHolderText(numberOfGuesses, 1, 'IN_PROCESS');
    this.updateGameDataField('searchInputPlaceHolderText', inputPlaceHolderText);
    this.setNewAttrColorForAllGuessablePlayers(selectedPlayer);
  }

  createGuessRequest(selectedPlayer: NflPlayer, colorMapValuesArray: string[]): GuessCreateRequest {
    const playerRequest = this.createPlayerRequest(selectedPlayer);
    const colorMapString = JSON.stringify(Array.from(selectedPlayer.colorMap.entries()));
    return {
      player: playerRequest,
      isCorrect: this.isGameFinished(colorMapValuesArray),
      colorMap: colorMapString,
    };
  }
}
