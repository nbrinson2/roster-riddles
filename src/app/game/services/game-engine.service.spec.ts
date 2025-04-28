import { TestBed } from '@angular/core/testing';
import { HintService } from '../../shared/components/hint/hint.service';
import { SlideUpService } from '../../shared/components/slide-up/slide-up.service';
import { MlbUiPlayer } from '../../shared/models/mlb.models';
import { GameEngineService } from './game-engine.service';

describe('GameService', () => {
  let service: GameEngineService<MlbUiPlayer>;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = new GameEngineService<MlbUiPlayer>(
      TestBed.inject(SlideUpService),
      TestBed.inject(HintService)
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
