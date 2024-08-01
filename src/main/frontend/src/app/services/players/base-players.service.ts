import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { MlbHeaders, NflHeaders } from '../../shared/constants/attribute-headers';
import { MlbPlayerAttributes, NflPlayerAttributes } from '../../shared/enumeration/attributes';
import { AttributeHeader, LeagueType } from '../../shared/models/models';

@Injectable({
  providedIn: 'root',
})
export class BasePlayersService {

  public getPlayerHeaders(leagueType: LeagueType): AttributeHeader[] {
    switch (leagueType) {
      case LeagueType.MLB:
        return MlbHeaders;
      case LeagueType.NFL:
        return NflHeaders;
      default:
        return [];
    }
  }

  public getPlayerAttributes(leagueType: LeagueType): any {
    switch (leagueType) {
      case LeagueType.MLB:
        return MlbPlayerAttributes;
      case LeagueType.NFL:
        return NflPlayerAttributes;
      default:
        return [];
    }
  }
}
