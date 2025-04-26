import { TestBed } from '@angular/core/testing';

import { MlbGameService } from './mlb-game.service';

describe('MlbGameService', () => {
  let service: MlbGameService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MlbGameService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
