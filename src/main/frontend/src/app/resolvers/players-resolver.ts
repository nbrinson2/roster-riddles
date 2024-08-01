import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { GameService } from '../services/game.service';
import { MlbPlayersService } from '../services/players/mlb-players.service';
import { NflPlayersService } from '../services/players/nfl-players.service';
import { LeagueType, Player } from '../shared/models/models';

@Injectable({ providedIn: 'root' })
export class PlayersResolver {
  constructor(
    private mlbPlayersService: MlbPlayersService,
    private nflPlayersService: NflPlayersService,
    private gameService: GameService
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<Player[]> {
    if (this.gameService.leagueType() === LeagueType.NFL) {
      return this.nflPlayersService.getAllNflPlayers();
    }
    return this.mlbPlayersService.getAllMlbPlayers();
  }
}
