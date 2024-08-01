import { Injectable } from '@angular/core';
import { forkJoin, map, Observable, switchMap } from 'rxjs';
import { MlbPlayerAttributes } from 'src/app/shared/enumeration/attributes';
import {
  CountryBornFullName,
  MlbBattingFullName,
  MlbLeagueDivisionFullName,
  MlbPlayer,
  MlbPlayerDetailed,
  MlbPlayerResponse,
  MlbRoster,
  MlbRosterPlayer,
  MlbRosterResponse,
  MlbTeamFullName,
  MlbTeamResponse,
  MlbTeamsResponse,
  MlbThrowingFullName,
  PlayerAttributeColor,
} from 'src/app/shared/models/mlb-models';
import {
  BattingAbbreviationMap,
  CountryBornAbbreviationMap,
  LeagueDivisionAbbreviationMap,
  MlbTeamAbbreviationMap,
  ThrowingAbbreviationMap,
} from '../constants';
import { HttpClient } from '@angular/common/http';
import { BasePlayersService } from './base-players.service';

@Injectable({
  providedIn: 'root',
})
export class MlbPlayersService extends BasePlayersService {
  mlbBaseUrl = 'https://statsapi.mlb.com/api/v1';
  mlbTeamsEndpoint = '/teams';
  mlbPlayerEndpoint = '/people';

  constructor(private http: HttpClient) {
    super();
  }

  public getAllMlbPlayers(): Observable<MlbPlayer[]> {
    return this.getAllMlbTeamRosters().pipe(
      switchMap((rosters: MlbRoster[]) => {
        const playersWithTeam: MlbRosterPlayer[] = [];

        for (const roster of rosters) {
          for (const player of roster.players) {
            const team = MlbTeamAbbreviationMap[roster.team as MlbTeamFullName];
            playersWithTeam.push({
              player: player,
              team: team,
              division: roster.division,
            });
          }
        }

        const playerObservables = playersWithTeam.map((playerWithTeam: MlbRosterPlayer) =>
          this.getMlbPlayer(playerWithTeam.player.person.id).pipe(
            map((playerResponse: MlbPlayerResponse) => ({
              player: playerResponse.people[0],
              team: playerWithTeam.team,
              division: playerWithTeam.division,
            }))
          )
        );

        return forkJoin(playerObservables);
      }),
      map((playersWithTeamName: MlbPlayerDetailed[]) => {
        const uiPlayers = playersWithTeamName.map((playerWithTeamName) =>
          this.mapMlbPlayerDetailedToUiPlayer(playerWithTeamName)
        );

        return uiPlayers;
      })
    );
  }

  private mapMlbPlayerDetailedToUiPlayer(player: MlbPlayerDetailed): MlbPlayer {
    return {
      name: player.player.fullName,
      team: player.team,
      lgDiv: LeagueDivisionAbbreviationMap[player.division as MlbLeagueDivisionFullName],
      b: BattingAbbreviationMap[player.player.batSide.description as MlbBattingFullName],
      t: ThrowingAbbreviationMap[player.player.pitchHand.description as MlbThrowingFullName],
      born: CountryBornAbbreviationMap[player.player.birthCountry as CountryBornFullName],
      age: player.player.currentAge.toString(),
      pos: player.player.primaryPosition.abbreviation,
      colorMap: this.initializeMlbPlaterAttrColorMap(),
    };
  }

  private initializeMlbPlaterAttrColorMap(): Map<MlbPlayerAttributes, PlayerAttributeColor> {
    const playerAttributes = Object.values(MlbPlayerAttributes).filter(
      (key) => key !== MlbPlayerAttributes.NAME
    );
    const playerAttrBackgroundColorMap = new Map<MlbPlayerAttributes, PlayerAttributeColor>();

    for (const attr of playerAttributes) {
      playerAttrBackgroundColorMap.set(attr, PlayerAttributeColor.NONE);
    }
    return playerAttrBackgroundColorMap;
  }

  private getAllMlbTeamRosters(): Observable<MlbRoster[]> {
    return this.getMlbTeams().pipe(
      map((teamsResponse: MlbTeamsResponse) => teamsResponse.teams),
      switchMap((teams: MlbTeamResponse[]) => {
        const mlbTeams = teams.filter(
          (team: MlbTeamResponse) => team.sport.name === 'Major League Baseball'
        );
        const rosterObservables = mlbTeams.map((team: MlbTeamResponse) =>
          this.getMlbTeamRoster(team.id).pipe(
            map((rosterResponse: MlbRosterResponse) => ({
              team: team.name,
              league: team.league.name!,
              division: team.division!.name,
              players: rosterResponse.roster,
            }))
          )
        );
        return forkJoin(rosterObservables);
      }),
      map((uiRosters: MlbRoster[]) => uiRosters)
    );
  }

  private getMlbTeams(): Observable<MlbTeamsResponse> {
    const reqUrl = this.mlbBaseUrl + this.mlbTeamsEndpoint;
    const response = this.http.get<MlbTeamsResponse>(reqUrl);
    return response;
  }

  private getMlbTeamRoster(id: number): Observable<MlbRosterResponse> {
    const reqUrl = `${this.mlbBaseUrl}${this.mlbTeamsEndpoint}/${id}/roster`;
    const response = this.http.get<MlbRosterResponse>(reqUrl);
    return response;
  }

  private getMlbPlayer(id: number): Observable<MlbPlayerResponse> {
    const reqUrl = `${this.mlbBaseUrl}${this.mlbPlayerEndpoint}/${id}`;
    const response = this.http.get<MlbPlayerResponse>(reqUrl);
    return response;
  }
}
