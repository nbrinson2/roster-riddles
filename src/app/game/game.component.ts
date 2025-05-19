import { Component, Inject } from '@angular/core';
import { GameType } from '../game/shared/constants/game.constants';
import { Difficulty } from '../nav/difficulty-toggle/difficulty-toggle.component';
import { SlideUpService } from '../shared/components/slide-up/slide-up.service';
import { GamePlayer } from '../shared/models/common-models';
import { GAME_SERVICE, GameService } from '../shared/utils/game-service.token';
import { RosterSelectionService } from './bio-ball/services/roster-selection/roster-selection.service';
import { Header } from './shared/common-attribute-header/common-attribute-header.component';

@Component({
  selector: 'game',
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
  standalone: false
})
export class GameComponent {
  get currentGameType(): GameType {
    return this.gameService.currentGame();
  }

  get currentGameMode(): Difficulty {
    return this.gameService.currentGameMode();
  }

  get showAttributeHeader(): boolean {
    return this.gameService.showAttributeHeader();
  }

  get attributeHeaders(): Header[] {
    return this.gameService.attributeHeaders();
  }

  constructor(
    private slideUpService: SlideUpService,
    private rosterSelectionService: RosterSelectionService,
    @Inject(GAME_SERVICE)
    private gameService: GameService<GamePlayer>,
  ) {}

  protected startNewGame(): void {
    if (this.slideUpService.isVisible()) {
      this.slideUpService.hide(() => {
        this.gameService.startNewGame();
      });
      return;
    }

    this.gameService.startNewGame();
  }

  protected resetState(): void {
    this.slideUpService.hide();
    this.rosterSelectionService.resetRosterSelection();
  }
}
