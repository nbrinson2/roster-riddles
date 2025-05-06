import { TestBed } from '@angular/core/testing';

import { BioBallMlbService } from './bio-ball-mlb.service';

describe('MlbGameService', () => {
  let service: BioBallMlbService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BioBallMlbService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
