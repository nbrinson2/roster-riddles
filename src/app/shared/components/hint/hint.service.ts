import { Injectable, Signal, signal } from '@angular/core';

export interface Hint {
  id: number;
  message: string;
  shown: boolean;
}

export enum HintType {
  ROSTER_SELECT = 1,
  ROSTER_COST = 2,
  COLOR_FEEDBACK = 3
}

@Injectable({
  providedIn: 'root'
})
export class HintService {
  private readonly _hints = signal<Hint[]>([
    {
      id: HintType.ROSTER_SELECT,
      message: "You can select players directly from the roster table by clicking on any row!",
      shown: false
    },
    {
      id: HintType.ROSTER_COST,
      message: "Viewing a team's roster will cost you one guess, but it can help narrow down your search!",
      shown: false
    },
    {
      id: HintType.COLOR_FEEDBACK,
      message: "Blue means it's an exact match! Orange means you're close - within 2 years for age, or same league/division for Lg/Div.",
      shown: false
    }
    // Add more hints here as needed
  ]);

  private readonly _currentHint = signal<Hint | null>(null);

  get hints(): Signal<Hint[]> {
    return this._hints.asReadonly();
  }

  get currentHint(): Signal<Hint | null> {
    return this._currentHint.asReadonly();
  }

  showHint(hintId: HintType): void {
    const hint = this._hints().find(h => h.id === hintId);
    if (hint && !hint.shown) {
      hint.shown = true;
      this._currentHint.set(hint);
      this._hints.set([...this._hints()]);
    }
  }

  dismissHint(): void {
    this._currentHint.set(null);
  }

  resetHints(): void {
    this._hints.update(hints => 
      hints.map(hint => ({ ...hint, shown: false }))
    );
    this._currentHint.set(null);
  }
} 