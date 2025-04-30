import { Component, computed } from '@angular/core';
import { SlideUpService } from './slide-up.service';
import {
  animate,
  state,
  style,
  transition,
  trigger,
} from '@angular/animations';
import { AttributesType, UiPlayer } from '../../../game/bio-ball/models/bio-ball.models';
import { BioBallEngineService } from 'src/app/game/bio-ball/services/bio-ball-engine/bio-ball-engine.service';
@Component({
    selector: 'slide-up',
    templateUrl: './slide-up.component.html',
    styleUrls: ['./slide-up.component.scss'],
    animations: [
        trigger('slideAnimation', [
            state('up', style({ transform: 'translateY(0)', opacity: 1 })),
            state('down', style({ transform: 'translateY(100%)', opacity: 0 })),
            transition('void => up', [
                style({ transform: 'translateY(100%)', opacity: 0 }),
                animate('400ms ease-out'),
            ]),
            transition('up => down', [animate('400ms ease-in')]),
        ]),
    ],
    standalone: false
})
export class SlideUpComponent {
  get isVisible(): boolean {
    return this.slideUpService.isVisible();
  }

  get shouldRender(): boolean {
    return this.slideUpService.shouldRender();
  }

  constructor(
    private slideUpService: SlideUpService,
    private gameService: BioBallEngineService<UiPlayer<AttributesType>>
  ) {}

  dismiss() {
    this.slideUpService.hide();
  }

  onAnimationDone() {
    if (!this.isVisible) {
      this.gameService.startNewGame();
      this.slideUpService.shouldRender = false;
      return;
    }

    if (!this.isVisible) {
      this.slideUpService.shouldRender = false;
    }
  }

  startNewGame() {
    this.slideUpService.hide();
  }
}
