import { Injectable } from '@angular/core';
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
import { MlbPlayersService } from '../../shared/services/mlb-players/mlb-players.service';

interface CareerPathPlayer {
  id: number;
  name: string;
  teams: CareerPathTeam[];
}

interface CareerPathTeam {
  team: string;
  yearStart: number;
  yearEnd: number;
}

@Injectable({
  providedIn: 'root',
})
export class CareerPathPlayerGenerator {
  constructor(private mlbPlayersService: MlbPlayersService) {}

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
            this.mlbPlayersService.getPlayerDebutDate(p.id).pipe(
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
    return this.mlbPlayersService.getTeamListBySeason(year).pipe(
      switchMap((teamsResp) => {
        // map teamId → teamName for easy lookup
        const teamNameMap = new Map<number, string>(
          teamsResp.teams.map((t) => [t.id, t.name])
        );

        // build one roster‐fetch per team
        const rosterCalls = teamsResp.teams.map((team) =>
          this.mlbPlayersService.getRosterBySeason(team.id, year).pipe(
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
  public getMergedPlayersSince1990(): Observable<CareerPathPlayer[]> {
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
        console.log(byId.get(123272));
        return Array.from(byId.values());
      })
    );
  }

  /**
   * Merge newTeams into existingTeams in-place, ensuring:
   *  - yearStart = min(old.yearStart, new.yearStart)
   *  - yearEnd   = max(old.yearEnd,   new.yearEnd)
   */
  public mergeTeams(
    existingTeams: CareerPathTeam[],
    newTeams: CareerPathTeam[]
  ): void {
    newTeams.forEach((incoming) => {
      // Find a matching team entry with no gaps between years (consecutive or overlapping)
      const match = existingTeams.find(
        (t) =>
          t.team === incoming.team &&
          incoming.yearStart <= t.yearEnd + 1 &&
          incoming.yearEnd >= t.yearStart - 1
      );

      if (match) {
        // Extend the existing range to include the incoming years
        match.yearStart = Math.min(match.yearStart, incoming.yearStart);
        match.yearEnd = Math.max(match.yearEnd, incoming.yearEnd);
      } else {
        // No consecutive/overlapping stint found; add as a new entry
        existingTeams.push({ ...incoming });
      }
    });
  }
}
