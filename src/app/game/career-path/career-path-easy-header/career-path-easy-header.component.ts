import { Component, Inject, Input } from '@angular/core';
import { CareerPathPlayer } from '../models/career-path.models';
import { Header } from 'src/app/game/shared/common-attribute-header/common-attribute-header.component';
import {
  GAME_SERVICE,
  GameService,
} from 'src/app/shared/utils/game-service.token';
import { GameState } from '../services/career-path-engine/career-path-engine.service';

@Component({
  selector: 'career-path-easy-header',
  standalone: false,
  templateUrl: './career-path-easy-header.component.html',
  styleUrl: './career-path-easy-header.component.scss',
})
export class CareerPathEasyHeaderComponent {
  @Input() attributeHeaders!: Header[];
  @Input() numberOfColumns!: number;

  get gameState(): GameState {
    return this.gameService.gameState();
  }

  get playerToGuess(): CareerPathPlayer {
    return this.gameService.playerToGuess() as CareerPathPlayer;
  }

  protected readonly GameState = GameState;
  
  constructor(
    @Inject(GAME_SERVICE) private gameService: GameService<CareerPathPlayer>
  ) {}

  protected handleRevealAttribute(): void {
    this.gameService.incrementNumberOfGuesses();
  }
}
