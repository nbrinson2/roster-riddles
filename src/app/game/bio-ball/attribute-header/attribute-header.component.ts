import { Component } from '@angular/core';
import { AttributesType, UiPlayer } from 'src/app/game/bio-ball/models/bio-ball.models';
import { PlayerAttrColor } from "src/app/shared/models/common-models";
import { GameState } from '../../career-path/services/career-path-engine/career-path-engine.service';
import { Header } from '../../shared/common-attribute-header/common-attribute-header.component';
import { BioBallEngineService } from '../services/bio-ball-engine/bio-ball-engine.service';

@Component({
    selector: 'attribute-header',
    templateUrl: './attribute-header.component.html',
    styleUrls: ['./attribute-header.component.scss'],
    standalone: false
})
export class AttributeHeaderComponent {
  get endOfGame(): boolean {
    const s = this.gameService.gameState();
    return s === GameState.LOST || s === GameState.WON;
  }

  get endResultText(): string {
    return this.gameService.endResultText;
  }

  get attrHeaders(): Header[] {
    return this.gameService.attributeHeaders();
  }

  constructor(private gameService: BioBallEngineService<UiPlayer<AttributesType>>) {}

  /** Win and loss share the same strip; outline uses Roster Riddles blue (`$color-secondary`). */
  protected getEndResultBorderColor(): string {
    return PlayerAttrColor.BLUE;
  }
}
