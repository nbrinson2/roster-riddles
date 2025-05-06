import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot } from "@angular/router";
import { Observable, switchMap, map, forkJoin } from "rxjs";
import { MlbUiPlayer, MlbUiRoster, MlbUiRosterPlayer, MlbTeam, MlbTeamFullName, MlbPlayerResponse, MlbUiPlayerDetailed, MlbLeagueDivisionFullName, MlbBattingFullName, MlbThrowingFullName, MlbPlayerAttributes, MlbTeamsResponse, MlbTeamDetails, MlbRosterResponse } from "../models/mlb.models";
import { CountryBornFullName } from "../models/bio-ball.models";
import { PlayerAttrColor } from "src/app/shared/models/common-models";
import { MlbPlayersService } from "src/app/shared/services/mlb-players/mlb-players.service";
import { MlbTeamAbbreviationMap, LeagueDivisionAbbreviationMap, BattingAbbreviationMap, ThrowingAbbreviationMap, CountryBornAbbreviationMap } from "../constants/bio-ball-constants";


@Injectable({providedIn: 'root'})
export class BioBallMlbResolver {
    constructor(private playersService: MlbPlayersService) {}

    resolve(route: ActivatedRouteSnapshot): Observable<MlbUiPlayer[]> {
        return this.getAllPlayers();
    }

    private getAllPlayers(): Observable<MlbUiPlayer[]> {
      return this.getAllTeamRosters().pipe(
        switchMap((rosters: MlbUiRoster[]) => {
          const playersWithTeam: MlbUiRosterPlayer[] = [];
  
          for (const roster of rosters) {
            for (const player of roster.players) {
              const team =
                roster.team === 'Athletics'
                  ? MlbTeam.OAK
                  : MlbTeamAbbreviationMap[roster.team as MlbTeamFullName];
  
              playersWithTeam.push({
                player: player,
                team: team as MlbTeam,
                division: roster.division,
              });
            }
          }
  
          const playerObservables = playersWithTeam.map(
            (playerWithTeam: MlbUiRosterPlayer) =>
              this.playersService.getPlayer(playerWithTeam.player.person.id).pipe(
                map((playerResponse: MlbPlayerResponse) => ({
                  player: playerResponse.people[0],
                  team: playerWithTeam.team as MlbTeam,
                  division: playerWithTeam.division,
                }))
              )
          );
  
          return forkJoin(playerObservables);
        }),
        map((playersWithTeamName: MlbUiPlayerDetailed[]) => {
          const uiPlayers = playersWithTeamName.map((playerWithTeamName) =>
            this.mapPlayerDetailedToUiPlayer(playerWithTeamName)
          );
  
          return uiPlayers;
        })
      );
    }
  
    private mapPlayerDetailedToUiPlayer(player: MlbUiPlayerDetailed): MlbUiPlayer {
      return {
        name: player.player.fullName,
        team: player.team,
        lgDiv:
          LeagueDivisionAbbreviationMap[
            player.division as MlbLeagueDivisionFullName
          ],
        b: BattingAbbreviationMap[
          player.player.batSide.description as MlbBattingFullName
        ],
        t: ThrowingAbbreviationMap[
          player.player.pitchHand.description as MlbThrowingFullName
        ],
        born: CountryBornAbbreviationMap[
          player.player.birthCountry as CountryBornFullName
        ],
        age: player.player.currentAge.toString(),
        pos: player.player.primaryPosition.abbreviation,
        colorMap: this.initializePlaterAttrColorMap(),
      };
    }
  
    private initializePlaterAttrColorMap(): Map<MlbPlayerAttributes, PlayerAttrColor> {
      const playerAttributes = Object.values(MlbPlayerAttributes).filter(
        (key) => key !== MlbPlayerAttributes.NAME
      );
      const playerAttrBackgroundColorMap = new Map<MlbPlayerAttributes, PlayerAttrColor>();
  
      for (const attr of playerAttributes) {
        playerAttrBackgroundColorMap.set(attr, PlayerAttrColor.NONE);
      }
      return playerAttrBackgroundColorMap;
    }
  
    private getAllTeamRosters(): Observable<MlbUiRoster[]> {
      return this.playersService.getTeams().pipe(
        map((teamsResponse: MlbTeamsResponse) => teamsResponse.teams),
        switchMap((teams: MlbTeamDetails[]) => {
          const mlbTeams = teams.filter(
            (team: MlbTeamDetails) => team.sport.name === 'Major League Baseball'
          );
          const rosterObservables = mlbTeams.map((team: MlbTeamDetails) =>
            this.playersService.getTeamRoster(team.id).pipe(
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
        map((uiRosters: MlbUiRoster[]) => uiRosters)
      );
    }
}
