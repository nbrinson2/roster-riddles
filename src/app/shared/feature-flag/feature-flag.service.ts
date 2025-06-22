import { Injectable } from '@angular/core';
import { environment } from 'src/environment';
import { BehaviorSubject, Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';

export type FlagKey = 'mlbTeamLogos';

export interface FeatureFlags {
  [key: string]: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class FeatureFlagService {
  private readonly _flags$ = new BehaviorSubject<FeatureFlags>(environment.featureFlags);
  readonly flags$ = this._flags$.asObservable();

  /** Async check (for consistency with older code) */
  isEnabled(key: FlagKey): Observable<boolean> {
    return of(!!this._flags$.getValue()[key]);
  }

  /** Synchronous check */
  isEnabledSnapshot(key: FlagKey): boolean {
    return !!this._flags$.getValue()[key];
  }
}
