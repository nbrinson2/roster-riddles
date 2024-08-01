import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { forkJoin, Observable, switchMap } from 'rxjs';
import { nflTeamToDivisionMap } from 'src/app/shared/constants/league';
import { NflPlayerAttributes } from 'src/app/shared/enumeration/attributes';
import { NflTeam } from 'src/app/shared/enumeration/nfl-enums';
import { PlayerAttributeColor } from 'src/app/shared/models/mlb-models';
import { NflPlayer } from 'src/app/shared/models/nfl-models';
import { BasePlayersService } from './base-players.service';
import { NflRosterResponse } from './models/nfl-models';

@Injectable({
  providedIn: 'root',
})
export class NflPlayersService extends BasePlayersService {
  nflBaseUrl = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams';
  nflRosterEndpoint = '/roster';

  constructor(private http: HttpClient) {
    super();
  }

  public getAllNflPlayers(): Observable<NflPlayer[]> {
    return this.getAllNflTeamRosters().pipe(
      switchMap((rosters: NflRosterResponse[]) => {
        const playersWithTeam: NflPlayer[] = [];

        for (const roster of rosters) {
          for (const athletes of roster.athletes) {
            for (const player of athletes.items) {
              const team = roster.team.abbreviation;
              const lgDiv = nflTeamToDivisionMap[roster.team.abbreviation as NflTeam];
              playersWithTeam.push({
                name: player.displayName,
                team,
                lgDiv,
                '#': player.jersey,
                college: player.college?.name || 'N/A',
                draftYear: player.debutYear?.toString() || 'R',
                age: player.age.toString(),
                position: player.position.abbreviation,
                colorMap: this.initializeNflPlayerColorMap(),
              });
            }
          }
        }

        return forkJoin([playersWithTeam]);
      })
    );
  }

  private initializeNflPlayerColorMap(): Map<NflPlayerAttributes, PlayerAttributeColor> {
    const playerAttributes = Object.values(NflPlayerAttributes).filter(
      (attribute) => attribute !== NflPlayerAttributes.NAME
    );
    const colorMap = new Map<NflPlayerAttributes, PlayerAttributeColor>();

    for (const attribute of playerAttributes) {
      colorMap.set(attribute, PlayerAttributeColor.NONE);
    }
    return colorMap;
  }

  private getAllNflTeamRosters(): Observable<NflRosterResponse[]> {
    const teamIds = Array.from({ length: 32 }, (_, i) => i + 1);
    const teamObservables = teamIds.map((id) => this.getNflTeamRoster(id));
    return forkJoin(teamObservables);
  }

  private getNflTeamRoster(teamId: number): Observable<NflRosterResponse> {
    return this.http.get<NflRosterResponse>(
      `${this.nflBaseUrl}/${teamId}${this.nflRosterEndpoint}`
    );
  }
}
