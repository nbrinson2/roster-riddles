import { Component, EventEmitter, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { first } from 'rxjs';
import { UiPlayer } from '../shared/models/models';
import { GameService } from '../shared/services/game.service';
import { SlideUpService } from '../shared/slide-up/slide-up.service';
import { PlayersService } from './player/services/players.service';
import {
  Data,
  EndResultMessage,
  InputPlaceHolderText,
  getPlayerKeyToBackgroundColorMap,
} from './util/util';

@Component({
  selector: 'home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss'],
})
export class HomeComponent {
  @Output() selectRosterEvent = new EventEmitter<UiPlayer[]>();

  get playerToGuess(): UiPlayer {
    return this.playersService.playerToGuess();
  }

  get guessablePlayers(): UiPlayer[] {
    return this.gameService.guessablePlayers;
  }

  get selectedPlayers(): UiPlayer[] {
    return this.gameService.selectedPlayers;
  }

  get headers() {
    return this.gameService.headers;
  }

  get searchInputPlaceHolderText(): string {
    return this.gameService.searchInputPlaceHolderText;
  }

  get isSearchDisabled(): boolean {
    return this.gameService.isSearchDisabled;
  }

  get endOfGame(): boolean {
    return this.gameService.endOfGame;
  }

  get endResultText(): string {
    return this.gameService.endResultText;
  }

  constructor(
    private route: ActivatedRoute,
    private slideUpService: SlideUpService,
    private playersService: PlayersService,
    private gameService: GameService
  ) {
    this.route.data.pipe(first()).subscribe((d) => {
      this.gameService.startNewGame((d as Data).players);
    });
  }

  protected startNewGame(): void {
    if (this.slideUpService.isVisible()) {
      this.gameService.shouldStartNewGame = true;
      this.slideUpService.hide();
      return;
    }

    this.gameService.startNewGame();
  }

  protected selectRoster(team: string): void {
    this.gameService.numberOfGuesses++;

    if (this.gameService.isGameFinished()) {
      if (this.endResultText === EndResultMessage.LOSE) {
        this.slideUpService.show();
      }
      return;
    }

    this.gameService.searchInputPlaceHolderText = `${
      this.gameService.allowedGuesses - this.gameService.numberOfGuesses
    } ${InputPlaceHolderText.COUNT}`;
    const selectedRoster = this.gameService.allPlayers.filter(
      (player) => player.team === team
    );
    this.selectRosterEvent.emit(selectedRoster);
  }
}
