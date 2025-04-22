import { TestBed } from '@angular/core/testing';

import { SlideUpService } from './slide-up.service';

describe('SlideUpService', () => {
  let service: SlideUpService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(SlideUpService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
