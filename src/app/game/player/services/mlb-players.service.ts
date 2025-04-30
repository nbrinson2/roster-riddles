import { HttpClient } from '@angular/common/http';
import { Injectable, signal, Signal } from '@angular/core';
import {
  catchError,
  filter,
  forkJoin,
  from,
  interval,
  map,
  mergeMap,
  Observable,
  of,
  retry,
  switchMap,
  toArray,
  zip,
} from 'rxjs';
import {
  MlbUiPlayer,
  MlbPlayerResponse,
  MlbRosterResponse,
  MlbTeamsResponse,
} from 'src/app/shared/models/mlb.models';

export interface CareerPathPlayer {
  id: number;
  name: string;
  teams: CareerPathTeam[];
}

export interface CareerPathTeam {
  team: string;
  yearStart: number;
  yearEnd: number;
}

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

  /**
   * Public API: returns CareerPathPlayer[] including mlbDebutDate,
   * filtered to debut >= 1990-01-01, at a max of 5 calls/sec.
   */
  public getCareerPathPlayersSince1990(): Observable<CareerPathPlayer[]> {
    const cutoff = new Date('1990-01-01');

    return this.getMergedPlayersSince1990().pipe(
      // switch into a rate-limited detail lookup
      switchMap((players) =>
        zip(from(players), interval(200)).pipe(
          mergeMap(([p]) =>
            this.getPlayerDebutDate(p.id).pipe(
              map((debut) => ({ ...p, mlbDebutDate: debut })),
              catchError((_) => of(null as any))
            )
          ),
          // drop failed fetches and pre-1990 debuters
          filter(
            (p): p is CareerPathPlayer =>
              !!p && new Date(p.mlbDebutDate) >= cutoff
          ),
          toArray()
        )
      )
    );
  }

  /**
   * Returns all players (with their career‐path of teams for the given season),
   * excluding anyone whose MLB debut was before 1990.
   */
  public getCareerPathPlayersBySeason(
    year: number
  ): Observable<CareerPathPlayer[]> {
    return this.getTeamListBySeason(year).pipe(
      switchMap((teamsResp) => {
        // map teamId → teamName for easy lookup
        const teamNameMap = new Map<number, string>(
          teamsResp.teams.map((t) => [t.id, t.name])
        );

        // build one roster‐fetch per team
        const rosterCalls = teamsResp.teams.map((team) =>
          this.getRosterBySeason(team.id, year).pipe(
            // retry once before erroring out
            retry(1),

            // transform the successful response into CareerPathPlayer[]
            map((rosterResp) =>
              rosterResp.roster.map(
                (r) =>
                  ({
                    id: r.person.id,
                    name: r.person.fullName,
                    teams: [
                      {
                        team: teamNameMap.get(team.id) || '',
                        yearStart: year,
                        yearEnd: year,
                      },
                    ],
                  } as CareerPathPlayer)
              )
            ),

            // if anything goes wrong, log it and return an empty array for this team
            catchError((err) => {
              console.error(
                `Failed to load roster for team ${team.id} (${teamNameMap.get(
                  team.id
                )}) in ${year}:`,
                err
              );
              return of([] as CareerPathPlayer[]);
            })
          )
        );
        // wait for all rosters
        return forkJoin(rosterCalls);
      }),
      // flatten the array of arrays
      map((arrays) => arrays.flat()),
      // group by player name, merge teams, and filter debut date
      map((players) => {
        const byId = new Map<number, CareerPathPlayer>();

        players.forEach((p) => {
          if (!byId.has(p.id)) {
            // first time we see this player
            byId.set(p.id, { ...p, teams: [...p.teams] });
          } else {
            const existing = byId.get(p.id)!;
            // for each team on the new entry...
            p.teams.forEach((newTeam) => {
              // try to find a match in the accumulated list
              const match = existing.teams.find((t) => t.team === newTeam.team);
              if (match) {
                // if already there, bump the yearEnd
                match.yearEnd = newTeam.yearEnd;
              } else {
                // otherwise append it
                existing.teams.push({ ...newTeam });
              }
            });
          }
        });

        return Array.from(byId.values());
      })
    );
  }

  /** fetches merged rosters per season since 1990, WITHOUT debutDate */
  private getMergedPlayersSince1990(): Observable<CareerPathPlayer[]> {
    const startYear = 1990;
    const currentYear = new Date().getFullYear();

    // [currentYear, currentYear-1, …, 1990]
    const seasons = Array.from(
      { length: currentYear - startYear + 1 },
      (_, i) => currentYear - i
    );

    // Kick off one Observable per season
    const seasonCalls = seasons.map((year) =>
      this.getCareerPathPlayersBySeason(year)
    );

    return forkJoin(seasonCalls).pipe(
      // flatten [[], [], …] into one big array
      map((lists) => lists.flat()),
      // reduce into a Map<playerId, CareerPathPlayer> with merged teams
      map((players) => {
        const byId = players.reduce((acc, player) => {
          const existing = acc.get(player.id);
          if (!existing) {
            // first time → clone
            acc.set(player.id, { ...player, teams: [...player.teams] });
          } else {
            // merge teams into the existing entry
            this.mergeTeams(existing.teams, player.teams);
          }
          return acc;
        }, new Map<number, CareerPathPlayer>());
        return Array.from(byId.values());
      })
    );
  }

  /**
   * Merge newTeams into existingTeams in-place, ensuring:
   *  - yearStart = min(old.yearStart, new.yearStart)
   *  - yearEnd   = max(old.yearEnd,   new.yearEnd)
   */
  private mergeTeams(
    existingTeams: CareerPathTeam[],
    newTeams: CareerPathTeam[]
  ): void {
    newTeams.forEach((incoming) => {
      const match = existingTeams.find((t) => t.team === incoming.team);
      if (match) {
        match.yearStart = Math.min(match.yearStart, incoming.yearStart);
        match.yearEnd = Math.max(match.yearEnd, incoming.yearEnd);
      } else {
        existingTeams.push({ ...incoming });
      }
    });
  }

  /** simple wrapper to hit /people/{id} and pluck debutDate */
  private getPlayerDebutDate(id: number): Observable<string> {
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
