import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import {
  catchError,
  map,
  Observable,
  of
} from 'rxjs';
import {
  MlbPlayerResponse,
  MlbRosterResponse,
  MlbTeamsResponse,
  MlbUiPlayer,
} from 'src/app/shared/models/mlb.models';

@Injectable({
  providedIn: 'root',
})
export class MlbPlayersService {
  baseUrl = 'https://statsapi.mlb.com/api/v1';
  teamsEndpoint = '/teams';
  playerEndpoint = '/people';
  playerToGuess: MlbUiPlayer = {} as MlbUiPlayer;

  constructor(private http: HttpClient) {}

  public getTeams(): Observable<MlbTeamsResponse> {
    const reqUrl = this.baseUrl + this.teamsEndpoint;
    const response = this.http.get<MlbTeamsResponse>(reqUrl);
    return response;
  }

  public getTeamRoster(id: number): Observable<MlbRosterResponse> {
    const reqUrl = `${this.baseUrl}${this.teamsEndpoint}/${id}/roster`;
    const response = this.http.get<MlbRosterResponse>(reqUrl);
    return response;
  }

  public getPlayer(id: number): Observable<MlbPlayerResponse> {
    const reqUrl = `${this.baseUrl}${this.playerEndpoint}/${id}`;
    const response = this.http.get<MlbPlayerResponse>(reqUrl);
    return response;
  }

  public getRosterBySeason(
    teamId: number,
    year: number
  ): Observable<MlbRosterResponse> {
    const reqUrl = `${this.baseUrl}${this.teamsEndpoint}/${teamId}/roster?season=${year}`;
    const response = this.http.get<MlbRosterResponse>(reqUrl);
    return response;
  }

  public getTeamListBySeason(year: number): Observable<MlbTeamsResponse> {
    const reqUrl = `${this.baseUrl}${this.teamsEndpoint}?sportId=1&season=${year}`;
    const response = this.http.get<MlbTeamsResponse>(reqUrl);
    return response;
  }

  public getTeamIdListBySeason(response: MlbTeamsResponse): number[] {
    return response.teams.map((team) => team.id);
  }

  /** simple wrapper to hit /people/{id} and pluck debutDate */
  public getPlayerDebutDate(id: number): Observable<string> {
    return this.http
      .get<MlbPlayerResponse>(`${this.baseUrl}/people/${id}`)
      .pipe(
        map((resp) => resp.people[0]?.mlbDebutDate),
        catchError((err) => {
          console.error(`Error fetching /people/${id}`, err);
          return of(null as any);
        })
      );
  }
}
