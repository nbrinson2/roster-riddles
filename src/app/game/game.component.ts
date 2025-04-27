import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { first } from 'rxjs';
import { HintArrowPosition } from '../shared/components/hint/hint.component';
import { HintService, HintType } from '../shared/components/hint/hint.service';
import { SlideUpService } from '../shared/components/slide-up/slide-up.service';
import {
  AttributesType,
  TeamUiPlayer,
  UiPlayer,
} from '../shared/models/models';
import { GameEngineService } from './services/game-engine.service';
import { GAME_SERVICE } from './util/game.token';
import { Data, EndResultMessage, InputPlaceHolderText } from './util/util';
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

  get hasShownFirstPlayerHint(): boolean {
    return this.hintService.hasShownFirstPlayerHint();
  }

  constructor(
    private route: ActivatedRoute,
    private slideUpService: SlideUpService,
    private hintService: HintService,
    @Inject(GAME_SERVICE)
    private gameService: GameEngineService<UiPlayer<AttributesType>>
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
      if (this.gameService.endResultText === EndResultMessage.LOSE) {
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
