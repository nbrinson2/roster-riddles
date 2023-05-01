import { Component, Input } from '@angular/core';

import { getPlayerKeyToHeaderNameMap, Header, Player, PlayerAttr } from 'src/app/home/home.component';

@Component({
  selector: 'player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent {
  @Input() headers!: Header[];
  @Input() player?: Player;

  private readonly playerAttrHeaderMap = getPlayerKeyToHeaderNameMap();
  protected readonly orderedPlayerAttr = Object.values(PlayerAttr);

  protected getColSpan(attr: string): number {
    const headerName = this.playerAttrHeaderMap.get(attr);
    const header = this.headers.filter((header) => header.name === headerName);
    const colSpan = header[0]?.colSpan || 1;

    return colSpan;
  }

  protected getClass(attr: string): string {
    const headerName = this.playerAttrHeaderMap.get(attr);
    const header = this.headers.filter((header) => header.name === headerName);
    const className = header[0]?.class || '';

    return className;
  }

  protected getPlayerAttr(attr: string): string {
    if (!this.player) {
      return '';
    }

    return this.player[attr as keyof Player];
  }
}
