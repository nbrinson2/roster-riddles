import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { MlbPlayer } from "../shared/mlb-models";
import { PlayersService } from "../services/players.service";


@Injectable({providedIn: 'root'})
export class PlayersResolver {
    constructor(private playersService: PlayersService) {}

    resolve(route: ActivatedRouteSnapshot): Observable<MlbPlayer[]> {
        return this.playersService.getAllMlbPlayers();
    }
}
