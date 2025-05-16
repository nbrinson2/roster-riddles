import { Component, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { first } from 'rxjs';
import { HintArrowPosition } from '../../shared/components/hint/hint.component';
import { HintService, HintType } from '../../shared/components/hint/hint.service';
import { GAME_SERVICE } from '../../shared/utils/game-service.token';
import { GameState } from '../career-path/services/career-path-engine/career-path-engine.service';
import {
  AttributesType,
  TeamUiPlayer,
  UiPlayer,
} from './models/bio-ball.models';
import { BioBallEngineService } from './services/bio-ball-engine/bio-ball-engine.service';
import { RosterSelectionService } from './services/roster-selection/roster-selection.service';
import { Data, InputPlaceHolderText } from './util/bio-ball.util';

@Component({
  selector: 'bio-ball',
  templateUrl: './bio-ball.component.html',
  styleUrls: ['./bio-ball.component.scss'],
  standalone: false
})
export class BioBallComponent {
  get selectedPlayers(): UiPlayer<AttributesType>[] {
    return this.gameService.selectedPlayers();
  }

  constructor(
    private route: ActivatedRoute,
    private hintService: HintService,
    private rosterSelectionService: RosterSelectionService,
    @Inject(GAME_SERVICE)
    private gameService: BioBallEngineService<UiPlayer<AttributesType>>
  ) {
    this.route.data.pipe(first()).subscribe((d) => {
      this.gameService.startNewGame((d as Data).players);
    });
  }

  ngAfterViewInit(): void {
    this.hintService.showHint(HintType.BIO_BALL_ROSTER_SELECT);
  }

  protected selectRoster(team: string): void {
    this.hintService.dismissHint();
    this.gameService.numberOfGuesses++;

    if (this.gameService.gameState() === GameState.LOST) {
      this.gameService.onLose();
      return;
    }

    this.gameService.searchInputPlaceHolderText = `${
      this.gameService.allowedGuesses - this.gameService.numberOfGuesses
    } ${InputPlaceHolderText.COUNT}`;
    const selectedRoster = this.gameService.allPlayers.filter(
      (player) => (player as TeamUiPlayer<AttributesType>).team === team
    );
    this.rosterSelectionService.selectActiveRoster(selectedRoster);
  }
}
