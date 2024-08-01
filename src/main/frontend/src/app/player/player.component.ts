import { Component, computed, EventEmitter, Input, Output } from '@angular/core';

import { MlbHeaders, NflHeaders } from '../shared/constants/attribute-headers';
import { MlbPlayerAttributes, NflPlayerAttributes } from '../shared/enumeration/attributes';
import { AttributeHeader, LeagueType, Player } from '../shared/models/models';
import { GameService } from '../services/game.service';

@Component({
  selector: 'player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss'],
})
export class PlayerComponent {
  @Input() player!: Player;
  @Input() inSearchResults = true;

  @Output() selectTeamEvent: EventEmitter<string> = new EventEmitter<string>();

  get leagueType(): LeagueType {
    return this.gameService.leagueType();
  }

  get leagueSpecificPlayerAttributes(): any {
    switch (this.gameService.leagueType()) {
      case LeagueType.MLB:
        return MlbPlayerAttributes;
      case LeagueType.NFL:
        return NflPlayerAttributes;
      default:
        return [];
    }
  }

  get leagueSpecificPlayerHeaders(): AttributeHeader[] {
    switch (this.gameService.leagueType()) {
      case LeagueType.MLB:
        return MlbHeaders;
      case LeagueType.NFL:
        return NflHeaders;
      default:
        return [];
    }
  }

  get visibleAttributes(): any {
    return Object.values(this.leagueSpecificPlayerAttributes).filter(
      (attr) =>
        attr !== this.leagueSpecificPlayerAttributes.NAME &&
        attr !== this.leagueSpecificPlayerAttributes.COLOR_MAP
    );
  }

  get playerAttrHeaderMap(): Map<string, string> {
    return this.getPlayerKeyToHeaderNameMap();
  }

  constructor(private gameService: GameService) {}

  protected getColSpan(attribute: string): number {
    const headerName = this.playerAttrHeaderMap.get(attribute);
    const header = this.leagueSpecificPlayerHeaders.filter((header) => header.name === headerName);
    const colSpan = header[0]?.colSpan || 1;

    return colSpan;
  }

  protected getClass(attribute: string): string {
    const headerName = this.playerAttrHeaderMap.get(attribute);
    const header = this.leagueSpecificPlayerHeaders.filter((header) => header.name === headerName);
    const attrColor = this.player[this.leagueSpecificPlayerAttributes.COLOR_MAP].get(attribute);

    const className = header[0]!.class + ' ' + attrColor;

    return className;
  }

  protected getPlayerAttr(attribute: string): string {
    if (!this.player || attribute === this.leagueSpecificPlayerAttributes.COLOR_MAP) {
      return '';
    }

    return this.player[attribute];
  }

  protected selectTeam(player: Player): void {
    this.selectTeamEvent.emit(player['team']);
  }

  private getPlayerKeyToHeaderNameMap(): Map<string, string> {
    const filteredPlayerAttributes = Object.values(this.leagueSpecificPlayerAttributes).filter(
      (key) => key !== this.leagueSpecificPlayerAttributes.NAME
    );
    const headerNames: string[] = this.leagueSpecificPlayerHeaders.map((header) => header.name);
    const playerAttrToHeadersMap = new Map<string, string>();

    for (let i = 0; i < filteredPlayerAttributes.length; i++) {
      playerAttrToHeadersMap.set(filteredPlayerAttributes[i] as string, headerNames[i]);
    }

    return playerAttrToHeadersMap;
  }
}
