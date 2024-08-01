import { Injectable } from '@angular/core';
import { BasePlayersService } from './base-players.service';
import { NflRosterResponse } from './models/nfl-models';
import { Observable } from 'rxjs';
import { HttpClient } from '@angular/common/http';

@Injectable({
  providedIn: 'root',
})
export class NflPlayersService extends BasePlayersService {
    nflBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';
    nflRosterEndpoint = '/roster';
    
    constructor(private http: HttpClient) {
        super();
    }

    private getNflTeamRoster(teamId: number): Observable<NflRosterResponse> {
        return this.http.get<NflRosterResponse>(`${this.nflBaseUrl}/${teamId}${this.nflRosterEndpoint}`);
    }
}
