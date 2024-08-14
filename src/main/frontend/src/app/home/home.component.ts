import { Component, EventEmitter, Input, OnInit, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MlbPlayer } from '../shared/models/mlb-models';

import { AuthenticationService } from '../services/authentication.service';
import { EndResultMessage } from '../services/constants';
import { GameService } from '../services/games/game.service';
import { AttributeHeader } from '../shared/models/models';

@Component({
  selector: 'home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent implements OnInit {
  @Output() selectRosterEvent = new EventEmitter<MlbPlayer[]>();

  get allPlayers(): MlbPlayer[] {
    return this.gameService.allPlayers();
  }

  get headers(): AttributeHeader[] {
    return this.gameService.gameData().headers;
  }

  get searchInputPlaceHolderText(): string {
    return this.gameService.gameData().searchInputPlaceHolderText;
  }

  get numberOfGuesses(): number {
    return this.gameService.gameData().numberOfGuesses;
  }

  get showNewGameButton(): boolean {
    return this.gameService.gameData().showNewGameButton;
  }

  get selectedPlayers(): MlbPlayer[] {
    return this.gameService.gameData().selectedPlayers;
  }

  get playerToGuess(): MlbPlayer {
    return this.gameService.gameData().playerToGuess;
  }

  get endResultText(): EndResultMessage {
    return this.gameService.gameData().endResultText;
  }

  get endOfGame(): boolean {
    return this.gameService.gameData().endOfGame;
  }

  get isSearchDisabled(): boolean {
    return this.gameService.gameData().isSearchDisabled;
  }

  get guessablePlayers(): MlbPlayer[] {
    return this.gameService.gameData().guessablePlayers;
  }

  constructor(
    private route: ActivatedRoute,
    private gameService: GameService,
    private authService: AuthenticationService
  ) {}

  ngOnInit(): void {
    this.gameService.setPlayerToGuess(this.allPlayers);
    this.gameService.initializeGameData();
    this.gameService.updateGameDataField('guessablePlayers', this.allPlayers);
  }

  protected selectPlayer(player: MlbPlayer): void {
    this.gameService.selectPlayer(player);
  }

  protected startNewGame(): void {
    this.gameService.startNewGame(this.authService.activeUser().id);
  }

  protected selectRoster(team: string): void {
    this.gameService.increaseNumberOfGuesses();

    if (this.gameService.isGameFinished()) {
      return;
    }

    this.gameService.setInProgressPlaceHolderText();

    const selectedRoster = this.allPlayers.filter((player) => player.team === team);
    this.selectRosterEvent.emit(selectedRoster);
  }
}
