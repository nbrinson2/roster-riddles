import { TestBed } from '@angular/core/testing';

import { CareerPathEngineService } from './career-path-engine.service';

describe('CareerPathEngineService', () => {
  let service: CareerPathEngineService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(CareerPathEngineService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
