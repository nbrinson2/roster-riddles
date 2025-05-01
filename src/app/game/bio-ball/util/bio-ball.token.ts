import { InjectionToken } from '@angular/core';
import { BioBallEngineService } from '../services/bio-ball-engine/bio-ball-engine.service';
import { UiPlayer } from '../models/bio-ball.models';
import { AttributesType } from 'src/app/game/bio-ball/models/bio-ball.models';

export const BIO_BALL_SERVICE = new InjectionToken<
  BioBallEngineService<UiPlayer<AttributesType>>
>('GameService');
