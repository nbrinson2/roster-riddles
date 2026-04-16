import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { doc, docData, Firestore } from '@angular/fire/firestore';
import {
  catchError,
  combineLatest,
  map,
  Observable,
  of,
  switchMap,
} from 'rxjs';
import {
  MlbPlayerResponse,
  MlbRosterResponse,
  MlbTeamsResponse,
  MlbUiPlayer,
} from 'src/app/game/bio-ball/models/mlb.models';
import { CareerPathPlayerResponse } from 'src/app/game/career-path/models/career-path.models';
import { NicknameStreakPlayer } from 'src/app/game/nickname-streak/models/nickname-streak.models';

export interface MlbPlayerCache {
  players: MlbUiPlayer[];
  count: number;
  lastUpdated: string;
  generatedAt: string;
}

@Injectable({
  providedIn: 'root',
})
export class MlbPlayersService {
  baseUrl = 'https://statsapi.mlb.com/api/v1';
  teamsEndpoint = '/teams';
  playerEndpoint = '/people';

  constructor(private http: HttpClient, private firestore: Firestore) {}

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

  /**
   * Always uses same-origin `/api/v1/mlb/people/:id` (Express → MLB).
   * The browser cannot call `statsapi.mlb.com` directly (CORS); dev uses `proxy.conf.json` → :3000.
   */
  public getPlayer(id: number): Observable<MlbPlayerResponse> {
    return this.http.get<MlbPlayerResponse>(this.playerProxyUrl(id));
  }

  /** Relative path only — resolves to the app origin in the browser (Cloud Run + Express). */
  private playerProxyUrl(id: number): string {
    return `/api/v1/mlb/people/${id}`;
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
    const url = this.playerProxyUrl(id);
    return this.http
      .get<MlbPlayerResponse>(url)
      .pipe(
        map((resp) => resp.people[0]?.mlbDebutDate),
        catchError((err) => {
          console.error(`Error fetching /people/${id}`, err);
          return of(null as any);
        })
      );
  }

  getPlayersSnapshot(): Observable<MlbUiPlayer[]> {
    const cacheDocRef = doc(this.firestore, 'cache', 'mlb_players_snapshot');

    return docData(cacheDocRef, { idField: 'id' }).pipe(
      map((data: any) => {
        if (!data || !data.players) {
          console.warn('No MLB cache found in Firestore');
          return [];
        }
        return data.players as MlbUiPlayer[];
      }),
      catchError(err => {
        console.error('Error fetching MLB cache:', err);
        return of([]); // fallback to empty → prevent app crash
      })
    );
  }

  /**
   * cache/career_path_players_snapshot_meta + {shardDocPrefix}{0..n-1} (default career_path_shard_),
   * or legacy cache/career_path_players_snapshot.
   */
  getCareerPathPlayersSnapshot(): Observable<CareerPathPlayerResponse[]> {
    const metaRef = doc(
      this.firestore,
      'cache',
      'career_path_players_snapshot_meta'
    );
    const legacyRef = doc(
      this.firestore,
      'cache',
      'career_path_players_snapshot'
    );

    return docData(metaRef).pipe(
      switchMap((meta: any) => {
        if (meta && typeof meta.shardCount === 'number') {
          if (meta.shardCount === 0) {
            return of([]);
          }
          if (meta.shardCount > 0) {
            const prefix =
              typeof meta.shardDocPrefix === 'string' &&
              meta.shardDocPrefix.length > 0
                ? meta.shardDocPrefix
                : 'career_path_shard_';
            const shardRefs = Array.from(
              { length: meta.shardCount },
              (_, i) =>
                doc(this.firestore, 'cache', `${prefix}${i}`)
            );
            return combineLatest(shardRefs.map((r) => docData(r))).pipe(
              map((docs: any[]) =>
                docs.flatMap(
                  (d) => (d?.players as CareerPathPlayerResponse[]) ?? []
                )
              )
            );
          }
        }

        return docData(legacyRef).pipe(
          map((data: any) => {
            if (!data?.players) {
              console.warn('No career path cache found in Firestore');
              return [];
            }
            return data.players as CareerPathPlayerResponse[];
          })
        );
      }),
      catchError((err) => {
        console.error('Error fetching career path cache:', err);
        return of([]);
      })
    );
  }

  /** cache/mlb_nicknames — same shape as former assets/mlb-nicknames.json */
  getMlbNicknamesSnapshot(): Observable<NicknameStreakPlayer[]> {
    const ref = doc(this.firestore, 'cache', 'mlb_nicknames');
    return docData(ref).pipe(
      map((data: any) => {
        if (!data?.entries || !Array.isArray(data.entries)) {
          console.warn('No MLB nicknames cache found in Firestore');
          return [];
        }
        return data.entries as NicknameStreakPlayer[];
      }),
      catchError((err) => {
        console.error('Error fetching MLB nicknames cache:', err);
        return of([]);
      })
    );
  }
}
