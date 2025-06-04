import { computed, Injectable, signal, Signal } from '@angular/core';
import { CommonGameService } from 'src/app/shared/services/common-game/common-game.service';
import { NicknameStreakPlayer } from '../models/nickname-streak.models';
import { GameService } from 'src/app/shared/utils/game-service.token';
import { SlideUpService } from 'src/app/shared/components/slide-up/slide-up.service';
import { GameState } from '../../career-path/services/career-path-engine/career-path-engine.service';
import { InputPlaceHolderText } from '../../shared/constants/game.constants';

export interface NicknameStreakPlayerToGuess extends NicknameStreakPlayer {
  isCorrectGuess: boolean;
  nicknameToGuess: string;
}

@Injectable({
  providedIn: 'root',
})
export class NicknameStreakEngineService
  extends CommonGameService<NicknameStreakPlayer>
  implements GameService<NicknameStreakPlayer>
{
  get nicknameToGuess(): Signal<string> {
    return this._nicknameToGuess.asReadonly();
  }

  set nicknameToGuess(nickname: string) {
    this._nicknameToGuess.set(nickname);
  }

  get selectedPlayers(): Signal<NicknameStreakPlayerToGuess[]> {
    return this._selectedPlayers.asReadonly();
  }

  set selectedPlayers(players: NicknameStreakPlayerToGuess[]) {
    this._selectedPlayers.set(players);
  }

  get showAttributeHeader(): Signal<boolean> {
    return this._showAttributeHeader.asReadonly();
  }

  public allPlayers: NicknameStreakPlayer[] = [];
  public guessablePlayers: NicknameStreakPlayer[] = [];

  protected guessableNicknames: string[] = [];

  private _nicknameToGuess = signal<string>('');
  private _selectedPlayers = signal<NicknameStreakPlayerToGuess[]>([]);
  private _showAttributeHeader = signal<boolean>(false);

  constructor(slideUpService: SlideUpService) {
    super(slideUpService);
    this.currentGameMode = 'n/a';
    this.guessableNicknames = this.allPlayers
      .map((player) => player.nicknames)
      .flat();
  }

  public filterPlayers(searchTerm: string | null): NicknameStreakPlayer[] {
    const term = searchTerm?.toLowerCase() ?? '';
    return this.guessablePlayers.filter(
      (player) => !searchTerm || player.name.toLowerCase().includes(term)
    );
  }

  public findMatchingPlayer(
    playerName: string
  ): NicknameStreakPlayer | undefined {
    const filteredPlayers = this.filterPlayers(playerName);
    return filteredPlayers.find((p) => p.name === playerName);
  }

  public handlePlayerSelection(guess: NicknameStreakPlayer): void {
    if (
      !guess ||
      this.gameState() === GameState.LOST ||
      this.isSearchDisabled
    ) {
      return;
    }

    this.updateSelectedPlayerAndGameStatus(guess);
  }

  protected startNewGameNoMode(players?: NicknameStreakPlayer[]): void {
    this.allowedGuesses = 1;
    this.allPlayers = players ?? this.allPlayers;
    this.guessablePlayers = [...this.allPlayers];
    this.selectNewTargetPlayer();
    this.numberOfGuesses = 0;
    this.gameState = GameState.PLAYING;
    this.isSearchDisabled = false;
    this.searchInputPlaceHolderText = InputPlaceHolderText.GUESS;
    this.selectedPlayers = [];
  }

  protected startNewGameEasy(players?: NicknameStreakPlayer[]): void {}
  protected startNewGameHard(players?: NicknameStreakPlayer[]): void {}
  protected updateStateAfterGuess(): void {}

  protected selectNewTargetPlayer(): void {
    if (this.guessablePlayers.length === 0) {
      const randomIndex = Math.floor(Math.random() * this.allPlayers.length);
      this.playerToGuess = this.allPlayers[randomIndex];
      return;
    }

    const randomIndex = Math.floor(
      Math.random() * this.guessablePlayers.length
    );
    this.playerToGuess = this.guessablePlayers[randomIndex];
  }

  private updateSelectedPlayerAndGameStatus(guess: NicknameStreakPlayer): void {
    if (this.isCorrectGuess(guess)) {
      this.onCorrectGuess(guess);
      return;
    }

    this.numberOfGuesses++;

    if (this.isOutOfGuesses()) {
      this.onIncorrectGuess(guess);
      return;
    }
  }

  private isCorrectGuess(guess: NicknameStreakPlayer): boolean {
    return guess.nicknames.includes(this.nicknameToGuess());
  }

  private isOutOfGuesses(): boolean {
    return this.numberOfGuesses >= this.allowedGuesses;
  }

  private onCorrectGuess(guess: NicknameStreakPlayer): void {
    this.selectedPlayers = [
      {
        ...guess,
        isCorrectGuess: true,
        nicknameToGuess: this.nicknameToGuess(),
      },
      ...this.selectedPlayers(),
    ];

    this.updateGuessablePlayersAndNicknames(guess);
    this.numberOfGuesses = 0;
    this.searchInputPlaceHolderText = InputPlaceHolderText.GUESS;
    this.currentStreak = this.currentStreak() + 1;
    this.bestStreak = Math.max(this.bestStreak(), this.currentStreak());
    this.selectNewTargetPlayer();
  }

  private onIncorrectGuess(guess: NicknameStreakPlayer): void {
    this.selectedPlayers = [
      {
        ...guess,
        isCorrectGuess: false,
        nicknameToGuess: this.nicknameToGuess(),
      },
      ...this.selectedPlayers(),
    ];
    this.currentStreak = 0;
    this.onLose();
  }

  private updateGuessablePlayersAndNicknames(guess: NicknameStreakPlayer): void {
    this.guessableNicknames = this.guessableNicknames.filter(
      (nickname) => nickname !== this.nicknameToGuess()
    );
    const updatedGuessedPlayer: NicknameStreakPlayer = {
      ...guess,
      nicknames: guess.nicknames.filter(
        (nickname) => nickname !== this.nicknameToGuess()
      ),
    };

    if (updatedGuessedPlayer.nicknames.length === 0) {
      this.guessablePlayers = this.guessablePlayers.filter(
        (p) => p.name !== guess.name
      );
    } else {
      this.guessablePlayers = this.guessablePlayers.map((p) =>
        p.name === guess.name ? updatedGuessedPlayer : p
      );
    }
  }
}
