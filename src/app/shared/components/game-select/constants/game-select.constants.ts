// game-select.constants.ts
import { APP_ROUTES } from 'src/app/app-routing.module';
import { Routes } from '@angular/router';
import { GameType } from 'src/app/shared/services/common-game/common-game.service';

export interface GameOption {
  type: GameType;
  label: string;
  icon: string;
  path: string;
}

/** Map route “path” → Material icon name */
const ICON_MAP: Record<string, string> = {
  'bio-ball': 'sports_cricket',
  'career-path': 'timeline',
};

function formatLabel(path: string): string {
  return path
    .split('-')
    .map((s) => s[0].toUpperCase() + s.slice(1))
    .join(' ');
}

/**
 * Build a list of games from the top‐level routes that have a :league param.
 * We assume each route is `/game-key/:league` and we default `:league` to 'mlb' here.
 */
export const GAME_OPTIONS: GameOption[] = (APP_ROUTES as Routes)
  .filter(r => typeof r.path === 'string' && r.path.includes(':league'))
  .map(r => {
    const base = (r.path as string).replace('/:league', '') as GameType;
    return {
      type: base,
      label: formatLabel(base),
      icon: ICON_MAP[base],
      path: `/${base}/mlb`,
    };
  });
