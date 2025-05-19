import { Injectable, Signal, signal } from '@angular/core';

export interface Hint {
  id: number;
  message: string;
  shown: boolean;
}

export enum HintType {
  BIO_BALL_ROSTER_PLAYER_SELECT = 1,
  BIO_BALL_ROSTER_SELECT = 2,
  CAREER_PATH_ROSTER_SELECT = 3,
  CAREER_PATH_ROSTER_PLAYER_SELECT = 4,
  CAREER_PATH_ATTRIBUTE_REVEAL = 5,
}

@Injectable({
  providedIn: 'root',
})
export class HintService {
  private readonly _hints = signal<Hint[]>([
    {
      id: HintType.BIO_BALL_ROSTER_PLAYER_SELECT,
      message:
        'You can select players directly from the roster table by clicking on any row!',
      shown: false,
    },
    {
      id: HintType.BIO_BALL_ROSTER_SELECT,
      message:
        "Viewing a team's roster will cost you one guess, but it can help narrow down your search!",
      shown: false,
    },
    {
      id: HintType.CAREER_PATH_ROSTER_SELECT,
      message:
        "Click the team logo to view a team's roster for the given year(s). This will cost you one guess, but it can help narrow down your search!",
      shown: false,
    },
    {
      id: HintType.CAREER_PATH_ROSTER_PLAYER_SELECT,
      message:
        'You can select players directly from the roster table by clicking on any row!',
      shown: false,
    },
    {
      id: HintType.CAREER_PATH_ATTRIBUTE_REVEAL,
      message:
        'You can reveal a player\'s attributes by clicking on their name in the timeline. This will cost you one guess, but it can help narrow down your search!',
      shown: false,
    },
  ]);

  private readonly _currentHint = signal<Hint | null>(null);

  get hints(): Signal<Hint[]> {
    return this._hints.asReadonly();
  }

  get currentHint(): Signal<Hint | null> {
    return this._currentHint.asReadonly();
  }

  showHint(hintId: HintType): void {
    const hint = this._hints().find((h) => h.id === hintId);
    if (hint && !hint.shown) {
      this._currentHint.set(hint);
      this._hints.set([...this._hints()]);
    }
  }

  dismissHint(): void {
    this._hints.update((hints) =>
      hints.map((hint) =>
        hint.id === this._currentHint()?.id ? { ...hint, shown: true } : hint
      )
    );
    this._currentHint.set(null);
  }

  resetHints(): void {
    this._hints.update((hints) =>
      hints.map((hint) => ({ ...hint, shown: false }))
    );
    this._currentHint.set(null);
  }
}
