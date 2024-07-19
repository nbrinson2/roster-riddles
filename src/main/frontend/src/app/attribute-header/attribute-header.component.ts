import { Component, Input } from '@angular/core';
import { PlayerAttrColor } from '../models/models';
import { Header } from '../services/models';
import { EndResultMessage } from '../services/constants';

@Component({
  selector: 'attribute-header',
  templateUrl: './attribute-header.component.html',
  styleUrls: ['./attribute-header.component.scss']
})
export class AttributeHeaderComponent {
  @Input() attrHeaders!: Header[];
  @Input() endResultText!: string;
  @Input() endOfGame!: boolean;

  protected getEndResultBorderColor(): string {
    if (this.endResultText === EndResultMessage.WIN) {
      return PlayerAttrColor.BLUE;
    }
    return PlayerAttrColor.ORANGE;
  }
}
