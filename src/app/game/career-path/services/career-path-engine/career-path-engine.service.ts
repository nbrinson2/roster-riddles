import { Injectable, signal, Signal } from '@angular/core';
import { HintService } from 'src/app/shared/components/hint/hint.service';
import { SlideUpService } from 'src/app/shared/components/slide-up/slide-up.service';
import { CommonGameService } from 'src/app/shared/services/common-game/common-game.service';
import { GameService } from 'src/app/shared/utils/game-service.token';
import { CareerPathPlayer } from '../../models/career-path.models';
import { applyFeedbackColors } from '../../utils/career-path.util';
import { InputPlaceHolderText } from 'src/app/game/shared/constants/game.constants';
import { MlbPlayersService } from 'src/app/shared/services/mlb-players/mlb-players.service';
import { CountryBornFullName } from 'src/app/game/bio-ball/models/bio-ball.models';
import { CountryBornAbbreviationMap } from 'src/app/game/bio-ball/constants/bio-ball-constants';

export enum GameState {
  PLAYING = 'PLAYING',
  WON = 'WON',
  LOST = 'LOST',
}

@Injectable({
  providedIn: 'root',
})
export class CareerPathEngineService
  extends CommonGameService<CareerPathPlayer>
  implements GameService<CareerPathPlayer>
{
  get selectedPlayers(): Signal<CareerPathPlayer[]> {
    return this._selectedPlayers.asReadonly();
  }

  set selectedPlayers(players: CareerPathPlayer[]) {
    this._selectedPlayers.set(players);
  }

  get showAttributeHeader(): Signal<boolean> {
    return this._showAttributeHeader.asReadonly();
  }

  public allPlayers: CareerPathPlayer[] = [];
  public guessablePlayers: CareerPathPlayer[] = [];

  private _selectedPlayers = signal<CareerPathPlayer[]>([]);
  private _showAttributeHeader = signal<boolean>(false);

  constructor(
    slideUpService: SlideUpService,
    private mlbPlayersService: MlbPlayersService,
    private hintService: HintService
  ) {
    super(slideUpService);
    this.currentGameMode = 'easy';
  }

  public filterPlayers(searchTerm: string | null): CareerPathPlayer[] {
    const term = searchTerm?.toLowerCase() ?? '';
    return this.guessablePlayers.filter(
      (player) =>
        !this.selectedPlayers().includes(player) &&
        (!searchTerm || player.name.toLowerCase().includes(term))
    );
  }

  public findMatchingPlayer(playerName: string): CareerPathPlayer | undefined {
    return this.filterPlayers(playerName).find((p) => p.name === playerName);
  }

  public handlePlayerSelection(guess: CareerPathPlayer): void {
    if (
      !guess ||
      this.gameState() === GameState.LOST ||
      this.isSearchDisabled
    ) {
      return;
    }

    if (this.selectedPlayers().length === 1) {
      this.hintService.dismissHint();
    }

    this.numberOfGuesses++;

    if (this.currentGameMode() === 'easy') {
      this.updateSelectedPlayersAndGameStatus(guess);
    } else {
      applyFeedbackColors(guess, this.playerToGuess() as CareerPathPlayer);
      this.updateSelectedPlayersAndGameStatus(guess);
    }
  }

  protected updateStateAfterGuess(): void {
    this.updatePlaceholderWithRemainingGuesses();
  }

  protected startNewGameEasy(players?: CareerPathPlayer[]): void {
    this.startNewGameHard(players);
    if (this.playerToGuess()) {
      this.setCareerPathAttributeHeaders();
    }
  }

  protected startNewGameHard(players?: CareerPathPlayer[]): void {
    this.allPlayers = players ?? this.allPlayers;
    this.guessablePlayers = [...this.allPlayers];
    this.selectNewTargetPlayer();
    console.log('selectNewTargetPlayer', this.playerToGuess());
    this.numberOfGuesses = 0;
    this.gameState = GameState.PLAYING;
    this.isSearchDisabled = false;
    this.searchInputPlaceHolderText = InputPlaceHolderText.GUESS;
    this.selectedPlayers = [];
  }

  protected startNewGameNoMode(players?: CareerPathPlayer[]): void {
    this.startNewGameHard(players);
  }

  private selectNewTargetPlayer(): void {
    const index = Math.floor(Math.random() * this.allPlayers.length);
    this.playerToGuess = this.allPlayers[index];
  }

  /** Did the user guess the exact player? */
  private isCorrectGuess(guess: CareerPathPlayer): boolean {
    const playerToGuess = this.playerToGuess() as CareerPathPlayer;
    return playerToGuess.id === guess.id;
  }

  /** Have they used up all allowed guesses? */
  private isOutOfGuesses(): boolean {
    return this.numberOfGuesses >= this.allowedGuesses;
  }

  /** Update the placeholder to show how many guesses remain */
  private updatePlaceholderWithRemainingGuesses(): void {
    const remaining = this.allowedGuesses - this.numberOfGuesses;
    this.searchInputPlaceHolderText = `${remaining} ${InputPlaceHolderText.COUNT}`;
  }

  private updateSelectedPlayersAndGameStatus(guess: CareerPathPlayer): void {
    if (this.isCorrectGuess(guess)) {
      if (this.currentGameMode() !== 'easy') {
        this.selectedPlayers = [guess, ...this.selectedPlayers()];
      }
      this.onWin();
      return;
    }

    this.selectedPlayers = [guess, ...this.selectedPlayers()];

    if (this.isOutOfGuesses()) {
      this.onLose();
      return;
    }

    this.updatePlaceholderWithRemainingGuesses();
  }

  private setCareerPathAttributeHeaders(): void {
    this.mlbPlayersService
      .getPlayer(this.playerToGuess().id)
      .subscribe((player) => {
        const playerDetails = player.people[0];
        const countryAbbreviation =
          CountryBornAbbreviationMap[
            playerDetails.birthCountry as CountryBornFullName
          ];
        this.attributeHeaders = [
          {
            name: 'Drafted',
            value: playerDetails.draftYear.toString(),
            colSpan: 1,
            class: 'bats-throws',
          },
          {
            name: 'Bats/Throws',
            value: `${playerDetails.batSide.code}/${playerDetails.pitchHand.code}`,
            colSpan: 1,
            class: 'bats-throws',
          },
          {
            name: 'Born',
            value: countryAbbreviation,
            colSpan: 1,
            class: 'bats-throws',
          },
          {
            name: '#',
            value: playerDetails.primaryNumber,
            colSpan: 1,
            class: 'bats-throws',
          },
          {
            name: 'Pos',
            value: playerDetails.primaryPosition.abbreviation,
            colSpan: 1,
            class: 'bats-throws',
          },
        ];
      });
  }
}
