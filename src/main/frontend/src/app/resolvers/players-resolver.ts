import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { MlbPlayersService } from "../services/players/mlb-players.service";
import { MlbPlayer } from "../shared/mlb-models";


@Injectable({providedIn: 'root'})
export class PlayersResolver {
    constructor(private mlbPlayersService: MlbPlayersService) {}

    resolve(route: ActivatedRouteSnapshot): Observable<MlbPlayer[]> {
        return this.mlbPlayersService.getAllMlbPlayers();
    }
}
