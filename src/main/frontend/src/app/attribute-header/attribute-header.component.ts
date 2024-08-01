import { Component, Input } from '@angular/core';
import { PlayerAttributeColor } from '../shared/models/mlb-models';
import { AttributeHeader } from '../shared/models/models';
import { EndResultMessage } from '../services/constants';

@Component({
  selector: 'attribute-header',
  templateUrl: './attribute-header.component.html',
  styleUrls: ['./attribute-header.component.scss'],
})
export class AttributeHeaderComponent {
  @Input() attrHeaders!: AttributeHeader[];
  @Input() endResultText!: string;
  @Input() endOfGame!: boolean;

  protected getEndResultBorderColor(): string {
    if (this.endResultText === EndResultMessage.WIN) {
      return PlayerAttributeColor.BLUE;
    }
    return PlayerAttributeColor.ORANGE;
  }
}
