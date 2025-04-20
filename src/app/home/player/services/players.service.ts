import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, map, switchMap } from 'rxjs';
import { BattingFullName, CountryBornFullName, LeagueDivisionFullName, MlbTeamFullName, PlayerAttr, PlayerAttrColor, PlayerResponse, RosterResponse, Team, TeamsResponse, ThrowingFullName, UiPlayer, UiPlayerDetailed, UiRoster, UiRosterPlayer } from 'src/app/shared/models/models';
import { BattingAbbreviationMap, CountryBornAbbreviationMap, LeagueDivisionAbbreviationMap, MlbTeamAbbreviationMap, ThrowingAbbreviationMap } from 'src/app/shared/constants/constants';

@Injectable({
  providedIn: 'root'
})
export class PlayersService {
  baseUrl = 'https://statsapi.mlb.com/api/v1';
  teamsEndpoint = '/teams';
  playerEndpoint = '/people';

  constructor(private http: HttpClient) { }

  public getAllPlayers(): Observable<UiPlayer[]> {
    return this.getAllTeamRosters().pipe(
      switchMap((rosters: UiRoster[]) => {
        const playersWithTeam: UiRosterPlayer[] = [];

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

        const playerObservables = playersWithTeam.map((playerWithTeam: UiRosterPlayer) =>
          this.getPlayer(playerWithTeam.player.person.id).pipe(
            map((playerResponse: PlayerResponse) => ({
              player: playerResponse.people[0],
              team: playerWithTeam.team,
              division: playerWithTeam.division,
            }))
          )
        );

        return forkJoin(playerObservables);
      }),
      map((playersWithTeamName: UiPlayerDetailed[]) => {
        const uiPlayers = playersWithTeamName.map(playerWithTeamName =>
          this.mapPlayerDetailedToUiPlayer(playerWithTeamName)
        );

        return uiPlayers;
      })
    );
  }

  private mapPlayerDetailedToUiPlayer(player: UiPlayerDetailed): UiPlayer {
    return {
      name: player.player.fullName,
      team: player.team,
      lgDiv: LeagueDivisionAbbreviationMap[player.division as LeagueDivisionFullName],
      b: BattingAbbreviationMap[player.player.batSide.description as BattingFullName],
      t: ThrowingAbbreviationMap[player.player.pitchHand.description as ThrowingFullName],
      born: CountryBornAbbreviationMap[player.player.birthCountry as CountryBornFullName],
      age: player.player.currentAge.toString(),
      pos: player.player.primaryPosition.abbreviation,
      colorMap: this.initializePlaterAttrColorMap(),
    };
  }

  private initializePlaterAttrColorMap(): Map<PlayerAttr, PlayerAttrColor> {
    const playerAttributes = Object.values(PlayerAttr).filter((key) => key !== PlayerAttr.NAME);
    const playerAttrBackgroundColorMap = new Map<PlayerAttr, PlayerAttrColor>();
  
    for (const attr of playerAttributes) {
      playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);
    }
    return playerAttrBackgroundColorMap;
  }

  private getAllTeamRosters(): Observable<UiRoster[]> {
    return this.getTeams().pipe(
      map((teamsResponse: TeamsResponse) => teamsResponse.teams),
      switchMap((teams: Team[]) => {
        const mlbTeams = teams.filter((team: Team) => team.sport.name === 'Major League Baseball');
        const rosterObservables = mlbTeams.map((team: Team) => this.getTeamRoster(team.id).pipe(
          map((rosterResponse: RosterResponse) => ({
            team: team.name,
            league: team.league.name!,
            division: team.division!.name,
            players: rosterResponse.roster,
          }))
        ));
        return forkJoin(rosterObservables);
      }),
      map((uiRosters: UiRoster[]) => uiRosters)
    );
  }

  private getTeams(): Observable<TeamsResponse> {
    const reqUrl = this.baseUrl + this.teamsEndpoint;
    const response = this.http.get<TeamsResponse>(reqUrl);
    return response;
  }

  private getTeamRoster(id: number): Observable<RosterResponse> {
    const reqUrl = `${this.baseUrl}${this.teamsEndpoint}/${id}/roster`;
    const response = this.http.get<RosterResponse>(reqUrl);
    return response;
  }

  private getPlayer(id: number): Observable<PlayerResponse> {
    const reqUrl = `${this.baseUrl}${this.playerEndpoint}/${id}`;
    const response = this.http.get<PlayerResponse>(reqUrl);
    return response;
  }
}
