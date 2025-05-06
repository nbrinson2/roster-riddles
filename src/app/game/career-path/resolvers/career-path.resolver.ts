import { Injectable } from "@angular/core";
import { ActivatedRouteSnapshot } from "@angular/router";
import { Observable } from "rxjs";
import { CareerPathPlayer } from "../models/career-path.models";
import { CareerPathMlbResolver } from "./career-path-mlb.resolver";

@Injectable({
  providedIn: 'root'
})
export class CareerPathResolver {
  constructor(private mlb: CareerPathMlbResolver) {}

  resolve(route: ActivatedRouteSnapshot): Observable<CareerPathPlayer[]> {
    return this.mlb.resolve(route);
  }
}
