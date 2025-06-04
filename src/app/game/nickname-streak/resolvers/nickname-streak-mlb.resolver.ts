import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { NicknameStreakPlayer } from "../models/nickname-streak.models";

@Injectable({
  providedIn: 'root',
})
export class NicknameStreakMlbResolver {
  constructor(private http: HttpClient) {}

  resolve(route: ActivatedRouteSnapshot): Observable<NicknameStreakPlayer[]> {
    return this.http.get<NicknameStreakPlayer[]>('assets/mlb-nicknames.json');
  }
}
