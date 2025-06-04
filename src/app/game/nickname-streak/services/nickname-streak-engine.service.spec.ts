import { TestBed } from '@angular/core/testing';

import { NicknameStreakEngineService } from './nickname-streak-engine.service';

describe('NicknameStreakEngineService', () => {
  let service: NicknameStreakEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NicknameStreakEngineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
