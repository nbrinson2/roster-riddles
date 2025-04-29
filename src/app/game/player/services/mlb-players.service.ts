import { HttpClient } from '@angular/common/http';
import { Injectable, signal, Signal } from '@angular/core';
import { Observable } from 'rxjs';
import {
  MlbUiPlayer,
  MlbPlayerResponse,
  MlbRosterResponse,
  MlbTeamsResponse} from 'src/app/shared/models/mlb.models';

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
}
