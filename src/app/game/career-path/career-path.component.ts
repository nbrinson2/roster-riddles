import { Component, Inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { first } from 'rxjs';
import { GAME_SERVICE } from '../../shared/utils/game-service.token';
import { CareerPathPlayer } from './models/career-path.models';
import { CareerPathEngineService, GameState } from './services/career-path-engine/career-path-engine.service';

export interface Data {
  players: CareerPathPlayer[];
}

@Component({
  selector: 'career-path',
  templateUrl: './career-path.component.html',
  styleUrl: './career-path.component.scss',
  standalone: false
})
export class CareerPathComponent {
  public readonly GameState = GameState;
  
  get selectedPlayers(): CareerPathPlayer[] {
    return this.gameService.selectedPlayers();
  }

  get gameState(): GameState {
    return this.gameService.gameState();
  }

  constructor(private route: ActivatedRoute, @Inject(GAME_SERVICE) private gameService: CareerPathEngineService) {
    this.route.data.pipe(first()).subscribe((d) => {
      const players = (d as Data).players;
      this.gameService.startNewGame(players);
    });
  }
}
