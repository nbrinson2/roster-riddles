import { Component, Inject } from '@angular/core';
import { NicknameStreakPlayer } from './models/nickname-streak.models';
import { GAME_SERVICE } from 'src/app/shared/utils/game-service.token';
import { NicknameStreakEngineService, NicknameStreakPlayerToGuess } from './services/nickname-streak-engine.service';
import { first } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

interface Data {
  players: NicknameStreakPlayer[];
}

@Component({
  selector: 'nickname-streak',
  standalone: false,
  templateUrl: './nickname-streak.component.html',
  styleUrl: './nickname-streak.component.scss',
})
export class NicknameStreakComponent {
  get selectedPlayers(): NicknameStreakPlayerToGuess[] {
    return this.gameService.selectedPlayers();
  }

  constructor(
    private route: ActivatedRoute,
    @Inject(GAME_SERVICE) private gameService: NicknameStreakEngineService
  ) {
    this.route.data.pipe(first()).subscribe((d) => {
      const players = (d as Data).players;
      this.gameService.startNewGame(players);
    });
  }
}
