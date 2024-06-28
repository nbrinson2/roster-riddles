import { Component, EventEmitter, Input, Output } from '@angular/core';

import { PlayerAttr, UiPlayer } from '../models/models';
import { MlbHeaders } from '../home/util/util';

const playerAttrHeaderMap = getPlayerKeyToHeaderNameMap();

export function getPlayerKeyToHeaderNameMap(): Map<string, string> {
  const playerAttributes = Object.values(PlayerAttr).filter((key) => key !== PlayerAttr.NAME);
  const headerNames: string[] = MlbHeaders.map((header) => header.name);
  const playerAttrToHeadersMap = new Map<string, string>();

  for (let i = 0; i < playerAttributes.length; i++) {
    playerAttrToHeadersMap.set(playerAttributes[i], headerNames[i]);
  }

  return playerAttrToHeadersMap;
}

@Component({
  selector: 'player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent {
  @Input() player!: UiPlayer;
  @Input() inSearchResults = true;

  @Output() selectTeamEvent: EventEmitter<string> = new EventEmitter<string>();

  protected readonly orderedUiPlayerAttr = Object.values(PlayerAttr).filter((attr) => attr !== PlayerAttr.NAME && attr !== PlayerAttr.COLOR_MAP);
  protected readonly PlayerAttr = PlayerAttr;

  protected getColSpan(attr: string): number {
    const headerName = playerAttrHeaderMap.get(attr);
    const header = MlbHeaders.filter((header) => header.name === headerName);
    const colSpan = header[0]?.colSpan || 1;

    return colSpan;
  }

  protected getClass(attr: string): string {
    const attrKey = attr as PlayerAttr;
    const headerName = playerAttrHeaderMap.get(attr);
    const header = MlbHeaders.filter((header) => header.name === headerName);
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

  protected selectTeam(player: UiPlayer): void {
    this.selectTeamEvent.emit(player.team);
  }
}
