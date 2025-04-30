import { Component, Input } from '@angular/core';
import { AttributesType, PlayerAttrColor } from 'src/app/game/bio-ball/models/bio-ball.models';
import { EndResultMessage, Header } from 'src/app/game/bio-ball/util/bio-ball.util';
import { BioBallEngineService } from '../services/bio-ball-engine/bio-ball-engine.service';
import { UiPlayer } from 'src/app/game/bio-ball/models/bio-ball.models';

@Component({
    selector: 'attribute-header',
    templateUrl: './attribute-header.component.html',
    styleUrls: ['./attribute-header.component.scss'],
    standalone: false
})
export class AttributeHeaderComponent {
  get endOfGame(): boolean {
    return this.gameService.endOfGame;
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
