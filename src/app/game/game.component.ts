import { Component, EventEmitter, Inject, Output } from '@angular/core';
import { AttributesType } from './bio-ball/models/bio-ball.models';
import { SlideUpService } from '../shared/components/slide-up/slide-up.service';
import { BioBallEngineService } from './bio-ball/services/bio-ball-engine/bio-ball-engine.service';
import { UiPlayer } from './bio-ball/models/bio-ball.models';
import { BIO_BALL_SERVICE } from './bio-ball/util/bio-ball.token';
@Component({
  selector: 'app-game',
  templateUrl: './game.component.html',
  styleUrl: './game.component.scss',
  standalone: false
})
export class GameComponent {

  constructor(
    private slideUpService: SlideUpService,
    @Inject(BIO_BALL_SERVICE)
    private gameService: BioBallEngineService<UiPlayer<AttributesType>>
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
}
