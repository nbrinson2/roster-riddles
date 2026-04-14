import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot } from '@angular/router';
import { Observable } from 'rxjs';
import { NicknameStreakPlayer } from '../models/nickname-streak.models';
import { MlbPlayersService } from 'src/app/shared/services/mlb-players/mlb-players.service';

@Injectable({
  providedIn: 'root',
})
export class NicknameStreakMlbResolver {
  constructor(private mlbPlayers: MlbPlayersService) {}

  resolve(_route: ActivatedRouteSnapshot): Observable<NicknameStreakPlayer[]> {
    return this.mlbPlayers.getMlbNicknamesSnapshot();
  }
}
