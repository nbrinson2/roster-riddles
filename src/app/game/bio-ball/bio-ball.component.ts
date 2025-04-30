import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { first } from 'rxjs';
import { HintArrowPosition } from '../../shared/components/hint/hint.component';
import { HintService, HintType } from '../../shared/components/hint/hint.service';
import { SlideUpService } from '../../shared/components/slide-up/slide-up.service';
import {
  AttributesType,
  TeamUiPlayer,
  UiPlayer,
} from './models/bio-ball.models';
import { BioBallEngineService } from './services/bio-ball-engine/bio-ball-engine.service';
import { BIO_BALL_SERVICE } from './util/bio-ball.token';
import { Data, EndResultMessage, InputPlaceHolderText } from './util/bio-ball.util';
import { RosterSelectionService } from './services/roster-selection/roster-selection.service';

@Component({
  selector: 'bio-ball',
  templateUrl: './bio-ball.component.html',
  styleUrls: ['./bio-ball.component.scss'],
  standalone: false
})
export class BioBallComponent {
  protected readonly HintType = HintType;
  protected readonly HintArrowPosition = HintArrowPosition;

  get selectedPlayers(): UiPlayer<AttributesType>[] {
    return this.gameService.selectedPlayers();
  }

  get hasShownFirstPlayerHint(): boolean {
    return this.hintService.hasShownFirstPlayerHint();
  }

  constructor(
    private route: ActivatedRoute,
    private slideUpService: SlideUpService,
    private hintService: HintService,
    private rosterSelectionService: RosterSelectionService,
    @Inject(BIO_BALL_SERVICE)
    private gameService: BioBallEngineService<UiPlayer<AttributesType>>
  ) {
    this.route.data.pipe(first()).subscribe((d) => {
      this.gameService.startNewGame((d as Data).players);
    });
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
    this.rosterSelectionService.selectRoster(selectedRoster);
  }
}
