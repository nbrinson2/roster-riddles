import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Headers } from '../util/util';
import {
  UiPlayer,
  TeamUiPlayer,
  AttributesType,
  CommonAttributes,
} from 'src/app/shared/models/models';

@Component({
  selector: 'player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss'],
  standalone: false
})
export class PlayerComponent {
  @Input() set player(player: UiPlayer<AttributesType>) {
    this.playerAttributes = player.colorMap.keys().next()
      .value as AttributesType;
    this.orderedUiPlayerAttr = Object.values(this.playerAttributes).filter(
      (attr) =>
        attr !== CommonAttributes.NAME && attr !== CommonAttributes.COLOR_MAP
    );
    this.playerKeyToHeaderNameMap = this.getPlayerKeyToHeaderNameMap();
  }
  @Input() inSearchResults = true;

  @Output() selectTeamEvent: EventEmitter<string> = new EventEmitter<string>();

  get teamAttribute(): string {
    if (Object.keys(this.player).includes('TEAM')) {
      return 'team';
    }

    return '';
  }

  protected commonAttributes = CommonAttributes;
  protected orderedUiPlayerAttr!: string[];
  protected playerAttributes!: AttributesType;

  private playerKeyToHeaderNameMap!: Map<string, string>;

  protected getColSpan(attr: string): number {
    const headerName = this.playerKeyToHeaderNameMap.get(attr);
    const header = Headers.filter((header) => header.name === headerName);
    const colSpan = header[0]?.colSpan || 1;

    return colSpan;
  }

  protected getClass(attr: string): string {
    const attrKey = attr as AttributesType;
    const headerName = this.playerKeyToHeaderNameMap.get(attr);
    const header = Headers.filter((header) => header.name === headerName);
    const attrColor = this.player.colorMap.get(attrKey);

    const className = header[0]!.class + ' ' + attrColor;

    return className;
  }

  protected getPlayerAttr(attr: string): string {
    const attrKey = attr as keyof UiPlayer<AttributesType>;

    if (!this.player || attrKey === CommonAttributes.COLOR_MAP) {
      return '';
    }

    return this.player[attrKey];
  }

  protected selectTeam(player: UiPlayer<AttributesType>): void {
    this.selectTeamEvent.emit((player as TeamUiPlayer<AttributesType>).team);
  }

  private getPlayerKeyToHeaderNameMap(): Map<string, string> {
    const headerNames: string[] = Headers.map((header) => header.name);
    const playerAttrToHeadersMap = new Map<string, string>();

    for (let i = 0; i < this.playerAttributes.length; i++) {
      playerAttrToHeadersMap.set(this.playerAttributes[i], headerNames[i]);
    }

    return playerAttrToHeadersMap;
  }
}
