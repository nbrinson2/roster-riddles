import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, first, forkJoin, map, switchMap } from 'rxjs';
import { MlbTeam, MlbTeamFullName, Player, PlayerDetailed, PlayerResponse, RosterResponse, Team, TeamsResponse, UiPlayer, UiRosterPlayer, UiRoster, UiPlayerDetailed, PlayerAttr, PlayerAttrColor, LeagueDivisionFullName, LeagueDivision, BattingFullName, Batting, ThrowingFullName, Throwing } from '../models/models';

const MlbTeamAbbreviationMap: { [key in MlbTeamFullName]: MlbTeam } = {
  [MlbTeamFullName.ARIZONA_DIAMONDBACKS]: MlbTeam.ARI,
  [MlbTeamFullName.ATLANTA_BRAVES]: MlbTeam.ATL,
  [MlbTeamFullName.BALTIMORE_ORIOLES]: MlbTeam.BAL,
  [MlbTeamFullName.BOSTON_RED_SOX]: MlbTeam.BOS,
  [MlbTeamFullName.CHICAGO_CUBS]: MlbTeam.CHC,
  [MlbTeamFullName.CHICAGO_WHITE_SOX]: MlbTeam.CHW,
  [MlbTeamFullName.CINCINNATI_REDS]: MlbTeam.CIN,
  [MlbTeamFullName.CLEVELAND_GUARDIANS]: MlbTeam.CLE,
  [MlbTeamFullName.COLORADO_ROCKIES]: MlbTeam.COL,
  [MlbTeamFullName.DETROIT_TIGERS]: MlbTeam.DET,
  [MlbTeamFullName.HOUSTON_ASTROS]: MlbTeam.HOU,
  [MlbTeamFullName.KANSAS_CITY_ROYALS]: MlbTeam.KCR,
  [MlbTeamFullName.LOS_ANGELES_ANGELS]: MlbTeam.LAA,
  [MlbTeamFullName.LOS_ANGELES_DODGERS]: MlbTeam.LAD,
  [MlbTeamFullName.MIAMI_MARLINS]: MlbTeam.MIA,
  [MlbTeamFullName.MILWAUKEE_BREWERS]: MlbTeam.MIL,
  [MlbTeamFullName.MINNESOTA_TWINS]: MlbTeam.MIN,
  [MlbTeamFullName.NEW_YORK_METS]: MlbTeam.NYM,
  [MlbTeamFullName.NEW_YORK_YANKEES]: MlbTeam.NYY,
  [MlbTeamFullName.OAKLAND_ATHLETICS]: MlbTeam.OAK,
  [MlbTeamFullName.PHILADELPHIA_PHILLIES]: MlbTeam.PHI,
  [MlbTeamFullName.PITTSBURGH_PIRATES]: MlbTeam.PIT,
  [MlbTeamFullName.SAN_DIEGO_PADRES]: MlbTeam.SDP,
  [MlbTeamFullName.SAN_FRANCISCO_GIANTS]: MlbTeam.SFG,
  [MlbTeamFullName.SEATTLE_MARINERS]: MlbTeam.SEA,
  [MlbTeamFullName.ST_LOUIS_CARDINALS]: MlbTeam.STL,
  [MlbTeamFullName.TAMPA_BAY_RAYS]: MlbTeam.TBR,
  [MlbTeamFullName.TEXAS_RANGERS]: MlbTeam.TEX,
  [MlbTeamFullName.TORONTO_BLUE_JAYS]: MlbTeam.TOR,
  [MlbTeamFullName.WASHINGTON_NATIONALS]: MlbTeam.WSN,
};

const LeagueDivisionAbbreviationMap: { [key in LeagueDivisionFullName]: LeagueDivision} = {
  [LeagueDivisionFullName.AL_EAST]: LeagueDivision.AL_EAST,
  [LeagueDivisionFullName.AL_WEST]: LeagueDivision.AL_WEST,
  [LeagueDivisionFullName.AL_CENTRAL]: LeagueDivision.AL_CENTRAL,
  [LeagueDivisionFullName.NL_EAST]: LeagueDivision.NL_EAST,
  [LeagueDivisionFullName.NL_WEST]: LeagueDivision.NL_WEST,
  [LeagueDivisionFullName.NL_CENTRAL]: LeagueDivision.NL_CENTRAL,
};

const BattingAbbreviationMap: { [key in BattingFullName]: Batting} = {
  [BattingFullName.R]: Batting.R,
  [BattingFullName.L]: Batting.L,
  [BattingFullName.S]: Batting.S,
}

const ThrowingAbbreviationMap: { [key in ThrowingFullName]: Throwing} = {
  [ThrowingFullName.R]: Throwing.R,
  [ThrowingFullName.L]: Throwing.L,
  [ThrowingFullName.B]: Throwing.B,
}

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
      born: player.player.birthCountry,
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
