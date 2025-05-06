import { Injectable } from '@angular/core';
import {
  ActivatedRouteSnapshot,
  Resolve
} from '@angular/router';
import { Observable } from 'rxjs';
import { AttributesType, UiPlayer } from '../models/bio-ball.models';
import { BioBallMlbResolver } from './bio-ball-mlb.resolver';

@Injectable({ providedIn: 'root' })
export class BioBallResolver implements Resolve<UiPlayer<AttributesType>[]> {
  constructor(
    private mlb: BioBallMlbResolver,
  ) {}

  resolve(route: ActivatedRouteSnapshot): Observable<UiPlayer<AttributesType>[]> {

    // default to MLB if unrecognized or 'mlb'
    return this.mlb.resolve(route);
  }
}
