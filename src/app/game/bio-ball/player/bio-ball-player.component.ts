import { Component, EventEmitter, Input, Output } from '@angular/core';

import { Headers } from '../util/bio-ball.util';
import {
  UiPlayer,
  TeamUiPlayer,
  AttributesType,
  CommonAttributes,
} from 'src/app/game/bio-ball/models/bio-ball.models';
import { HintType } from 'src/app/shared/components/hint/hint.service';
import { HintArrowPosition } from 'src/app/shared/components/hint/hint.component';

@Component({
  selector: 'bio-ball-player',
  templateUrl: './bio-ball-player.component.html',
  styleUrls: ['./bio-ball-player.component.scss'],
  standalone: false
})
export class BioBallPlayerComponent {
  @Input() set player(player: UiPlayer<AttributesType>) {
    this._player = player;
    this.playerAttributes = Object.keys(this._player).filter(
      (attr) =>
        attr !== CommonAttributes.NAME && attr !== CommonAttributes.COLOR_MAP
    );
    this.orderedUiPlayerAttr = Object.values(this.playerAttributes).filter(
      (attr) =>
        attr !== CommonAttributes.NAME && attr !== CommonAttributes.COLOR_MAP
    );
    this.playerKeyToHeaderNameMap = this.getPlayerKeyToHeaderNameMap();
  }
  @Input() inSearchResults = true;

  @Output() selectTeamEvent: EventEmitter<string> = new EventEmitter<string>();

  get teamAttribute(): string {
    if (Object.keys(this._player).includes('team')) {
      return 'team';
    }

    return '';
  }

  protected readonly HintType = HintType;
  protected readonly HintArrowPosition = HintArrowPosition;

  protected commonAttributes = CommonAttributes;
  protected orderedUiPlayerAttr!: string[];
  protected playerAttributes!: string[];

  private _player!: UiPlayer<AttributesType>;
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
    const attrColor = this._player.colorMap.get(attrKey);

    const className = header[0]!.class + ' ' + attrColor;

    return className;
  }

  protected getPlayerAttr(attr: string): string {
    const attrKey = attr as keyof UiPlayer<AttributesType>;

    if (!this._player || attrKey === CommonAttributes.COLOR_MAP) {
      return '';
    }

    return this._player[attrKey];
  }

  protected selectTeam(): void {
    this.selectTeamEvent.emit(
      (this._player as TeamUiPlayer<AttributesType>).team
    );
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
