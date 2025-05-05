import { Component, Input } from '@angular/core';
import { AttributesType } from 'src/app/game/bio-ball/models/bio-ball.models';
import { PlayerAttrColor } from "src/app/shared/models/common-models";
import { EndResultMessage, Header } from 'src/app/game/bio-ball/util/bio-ball.util';
import { BioBallEngineService } from '../services/bio-ball-engine/bio-ball-engine.service';
import { UiPlayer } from 'src/app/game/bio-ball/models/bio-ball.models';
import { GameState } from '../../career-path/services/career-path-engine/career-path-engine.service';

@Component({
    selector: 'attribute-header',
    templateUrl: './attribute-header.component.html',
    styleUrls: ['./attribute-header.component.scss'],
    standalone: false
})
export class AttributeHeaderComponent {
  get endOfGame(): boolean {
    return this.gameService.gameState() === GameState.LOST;
  }

  get endResultText(): string {
    return this.gameService.endResultText;
  }

  get attrHeaders(): Header[] {
    return this.gameService.headers;
  }

  constructor(private gameService: BioBallEngineService<UiPlayer<AttributesType>>) {}

  protected getEndResultBorderColor(): string {
    if (this.endResultText === EndResultMessage.WIN) {
      return PlayerAttrColor.BLUE;
    }
    return PlayerAttrColor.ORANGE;
  }
}
