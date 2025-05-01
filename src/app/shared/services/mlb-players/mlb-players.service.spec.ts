import { TestBed } from '@angular/core/testing';
import { MlbPlayersService } from './mlb-players.service';

describe('PlayersService', () => {
  let service: MlbPlayersService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(MlbPlayersService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
