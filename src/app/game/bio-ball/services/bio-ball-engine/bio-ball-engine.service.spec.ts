import { TestBed } from '@angular/core/testing';
import { HintService } from 'src/app/shared/components/hint/hint.service';
import { SlideUpService } from 'src/app/shared/components/slide-up/slide-up.service';
import { MlbUiPlayer } from 'src/app/game/bio-ball/models/mlb.models';
import { GameplayTelemetryService } from 'src/app/shared/services/gameplay-telemetry/gameplay-telemetry.service';
import { BioBallEngineService } from './bio-ball-engine.service';

describe('GameService', () => {
  let service: BioBallEngineService<MlbUiPlayer>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        {
          provide: GameplayTelemetryService,
          useValue: jasmine.createSpyObj<GameplayTelemetryService>(
            'GameplayTelemetryService',
            ['onRoundStarted', 'recordWin', 'recordLoss'],
          ),
        },
      ],
    });
    service = new BioBallEngineService<MlbUiPlayer>(
      TestBed.inject(SlideUpService),
      TestBed.inject(HintService),
      TestBed.inject(GameplayTelemetryService),
    );
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
