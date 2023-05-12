import { Component, Input } from '@angular/core';

import { getPlayerKeyToHeaderNameMap, Headers } from 'src/app/home/home.component';
import { PlayerAttr, UiPlayer } from '../models/models';

const playerAttrHeaderMap = getPlayerKeyToHeaderNameMap();

@Component({
  selector: 'player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent {
  @Input() player!: UiPlayer;

  protected readonly orderedUiPlayerAttr = Object.values(PlayerAttr).filter((attr) => attr !== PlayerAttr.NAME && attr !== PlayerAttr.COLOR_MAP);

  protected getColSpan(attr: string): number {
    const headerName = playerAttrHeaderMap.get(attr);
    const header = Headers.filter((header) => header.name === headerName);
    const colSpan = header[0]?.colSpan || 1;

    return colSpan;
  }

  protected getClass(attr: string): string {
    const attrKey = attr as PlayerAttr;
    const headerName = playerAttrHeaderMap.get(attr);
    const header = Headers.filter((header) => header.name === headerName);
    const attrColor = this.player[PlayerAttr.COLOR_MAP].get(attrKey);

    const className = header[0]!.class + ' ' + attrColor;

    return className;
  }

  protected getPlayerAttr(attr: string): string {
    const attrKey = attr as keyof UiPlayer;

    if (!this.player || attrKey === PlayerAttr.COLOR_MAP) {
      return '';
    }

    return this.player[attrKey];
  }
}
