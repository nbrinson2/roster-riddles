import { InjectionToken } from '@angular/core';
import { GameEngineService } from '../services/game-engine.service';
import { UiPlayer } from '../../shared/models/models';
import { AttributesType } from "src/app/shared/models/models";

export const GAME_SERVICE = new InjectionToken<
  GameEngineService<UiPlayer<AttributesType>>
>('GameService');
