import { TestBed } from '@angular/core/testing';

import { CommonGameService } from './common-game.service';

describe('CommonGameService', () => {
  let service: CommonGameService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CommonGameService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
