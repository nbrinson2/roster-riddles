import { Injectable } from '@angular/core';
import { LeagueType } from 'src/app/shared/models/models';
import { MlbGameService } from './mlb-game.service';
import { NflGameService } from './nfl-game.service';

@Injectable({
  providedIn: 'root',
})
export class GameServiceFactory {
  constructor(
    private mlbGameService: MlbGameService,
    private nflGameService: NflGameService
  ) {}

  getService(leagueType: LeagueType) {
    switch (leagueType) {
      case LeagueType.MLB:
        return this.mlbGameService;
      case LeagueType.NFL:
        return this.nflGameService;
      default:
        throw new Error('Unsupported league type');
    }
  }
}