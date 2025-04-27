import { Component, Input } from '@angular/core';
import { AttributesType, PlayerAttrColor } from 'src/app/shared/models/models';
import { EndResultMessage, Header } from 'src/app/game/util/util';
import { GameEngineService } from '../services/game-engine.service';
import { UiPlayer } from 'src/app/shared/models/models';

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

  constructor(private gameService: GameEngineService<UiPlayer<AttributesType>>) {}

  protected getEndResultBorderColor(): string {
    if (this.endResultText === EndResultMessage.WIN) {
      return PlayerAttrColor.BLUE;
    }
    return PlayerAttrColor.ORANGE;
  }
}
