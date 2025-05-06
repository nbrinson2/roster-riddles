import { TestBed } from '@angular/core/testing';

import { RosterSelectionService } from './roster-selection.service';

describe('RosterSelectionService', () => {
  let service: RosterSelectionService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RosterSelectionService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
