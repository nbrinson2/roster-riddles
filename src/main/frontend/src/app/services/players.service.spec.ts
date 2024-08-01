import { TestBed } from '@angular/core/testing';

import { BasePlayersService } from './players/base-players.service';

describe('PlayersService', () => {
  let service: BasePlayersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BasePlayersService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
