import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { ActivatedRouteSnapshot } from '@angular/router';
import { map, Observable } from 'rxjs';
import {
  CareerPathPlayer,
  CareerPathPlayerResponse,
  TeamStint,
  TimelineGroup,
} from '../models/career-path.models';
import { PlayerAttrColor } from 'src/app/shared/models/common-models';
import { teamKeyMap } from '../constants/career-path.constants';
import { MlbTeamKey } from '../../bio-ball/models/mlb.models';

@Injectable({
  providedIn: 'root',
})
export class CareerPathMlbResolver {
  constructor(private http: HttpClient) {}

  resolve(route: ActivatedRouteSnapshot): Observable<CareerPathPlayer[]> {
    return this.http
      .get<CareerPathPlayerResponse[]>('assets/career-path-players.json')
      .pipe(
        map((players) =>
          players.map((player) => {
            // 1) sort raw input by yearStart
            const sorted = [...player.teams].sort(
              (a, b) => a.yearStart - b.yearStart
            );

            // 2) map into TeamStint[]
            const stints: TeamStint[] = sorted.map((t) => {
              // pick from map or slugify fallback
              const isLosAngelesAngels = t.team === 'Los Angeles Angels' && t.yearStart >= 2005 && t.yearStart <= 2013;
              const raw = isLosAngelesAngels ? 'Los Angeles Angels of Anaheim' : t.team;
              const slug =
                teamKeyMap[raw] ||
                raw
                  .toLowerCase()
                  .replace(/[\s’'.]+/g, '-')   // spaces, apostrophes, periods → hyphens
                  .replace(/-+/g, '-');        // collapse multiple hyphens

              return {
                teamKey: slug as MlbTeamKey,
                from: t.yearStart,
                to:   t.yearEnd,
                logoBorderColor: PlayerAttrColor.NONE,
                yearColor:       PlayerAttrColor.NONE
              };
            });

            // 3) group contiguous stints with identical dates
            const groups: TimelineGroup[] = [];
            for (const s of stints) {
              const last = groups[groups.length - 1];
              if (last && last.from === s.from && last.to === s.to) {
                last.stints.push(s);
              } else {
                groups.push({ from: s.from, to: s.to, stints: [s] });
              }
            }

            return {
              id:     player.id,
              name:   player.name,
              groups
            };
          })
        )
      );
  }

}
