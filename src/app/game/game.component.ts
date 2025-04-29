import { Component, EventEmitter, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { first } from 'rxjs';
import { HintArrowPosition } from '../shared/components/hint/hint.component';
import { HintService, HintType } from '../shared/components/hint/hint.service';
import { SlideUpService } from '../shared/components/slide-up/slide-up.service';
import { AttributesType, TeamUiPlayer, UiPlayer } from '../shared/models/models';
import { GameEngineService } from './services/game.service';
import {
  Data,
  EndResultMessage,
  InputPlaceHolderText
} from './util/util';

@Component({
  selector: 'game',
  templateUrl: './game.component.html',
  styleUrls: ['./game.component.scss'],
  standalone: false
})
export class GameComponent {
  protected readonly HintType = HintType;
  protected readonly HintArrowPosition = HintArrowPosition;

  @Output() selectRosterEvent = new EventEmitter<UiPlayer<AttributesType>[]>();

  get playerToGuess(): UiPlayer<AttributesType> {
    return this.gameService.playerToGuess;
  }

  get guessablePlayers(): UiPlayer<AttributesType>[] {
    return this.gameService.guessablePlayers;
  }

  get selectedPlayers(): UiPlayer<AttributesType>[] {
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

  get hasShownFirstPlayerHint(): boolean {
    return this.hintService.hasShownFirstPlayerHint();
  }

  constructor(
    private route: ActivatedRoute,
    private slideUpService: SlideUpService,
    private gameService: GameEngineService<UiPlayer<AttributesType>>,
    private hintService: HintService
  ) {
    this.route.data.pipe(first()).subscribe((d) => {
      this.gameService.startNewGame((d as Data).players);
    });
  }

  protected startNewGame(): void {
    if (this.slideUpService.isVisible()) {
      this.slideUpService.hide(() => {
        this.gameService.startNewGame();
      });
      return;
    }

    this.gameService.startNewGame();
  }

  protected selectRoster(team: string): void {
    this.hintService.hasShownFirstPlayerHint = true;
    this.gameService.numberOfGuesses++;

    if (this.gameService.endOfGame) {
      if (this.endResultText === EndResultMessage.LOSE) {
        this.slideUpService.show();
      }
      return;
    }

    this.gameService.searchInputPlaceHolderText = `${
      this.gameService.allowedGuesses - this.gameService.numberOfGuesses
    } ${InputPlaceHolderText.COUNT}`;
    const selectedRoster = this.gameService.allPlayers.filter(
      (player) => (player as TeamUiPlayer<AttributesType>).team === team
    );
    this.selectRosterEvent.emit(selectedRoster);
  }
}
