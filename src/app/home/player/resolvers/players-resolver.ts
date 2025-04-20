import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { UiPlayer } from "../../../shared/models/models";
import { PlayersService } from "../services/players.service";


@Injectable({providedIn: 'root'})
export class PlayersResolver {
    constructor(private playersService: PlayersService) {}

    resolve(route: ActivatedRouteSnapshot): Observable<UiPlayer[]> {
        return this.playersService.getAllPlayers();
    }
}
