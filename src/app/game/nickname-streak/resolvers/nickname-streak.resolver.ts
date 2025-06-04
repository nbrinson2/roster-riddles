import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { NicknameStreakMlbResolver } from "./nickname-streak-mlb.resolver";
import { NicknameStreakPlayer } from "../models/nickname-streak.models";

@Injectable({
  providedIn: 'root',
})
export class NicknameStreakResolver {
  constructor(private mlb: NicknameStreakMlbResolver) {}

  resolve(route: ActivatedRouteSnapshot): Observable<NicknameStreakPlayer[]> {
    return this.mlb.resolve(route);
  }
}
