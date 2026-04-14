import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { MlbPlayersService } from "src/app/shared/services/mlb-players/mlb-players.service";
import { MlbUiPlayer } from "../models/mlb.models";


@Injectable({providedIn: 'root'})
export class BioBallMlbResolver {
    constructor(private playersService: MlbPlayersService) {}

    resolve(route: ActivatedRouteSnapshot): Observable<MlbUiPlayer[]> {
        return this.playersService.getPlayersSnapshot();
    }
}
