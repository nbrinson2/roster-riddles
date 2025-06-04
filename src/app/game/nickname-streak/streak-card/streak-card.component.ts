import { Component, Inject, Input } from '@angular/core';
import { NicknameStreakPlayer } from '../models/nickname-streak.models';
import { GAME_SERVICE } from 'src/app/shared/utils/game-service.token';
import { NicknameStreakEngineService } from '../services/nickname-streak-engine.service';

@Component({
  selector: 'streak-card',
  standalone: false,
  templateUrl: './streak-card.component.html',
  styleUrl: './streak-card.component.scss'
})
export class StreakCardComponent {
  @Input() bestStreak!: number;
  @Input() currentStreak!: number;
  @Input() set player(player: NicknameStreakPlayer) {
    this.nickname = player.nicknames[Math.floor(Math.random() * player.nicknames.length)];
    this.gameService.nicknameToGuess = this.nickname;
  }

  protected nickname = '';

  constructor(@Inject(GAME_SERVICE) private gameService: NicknameStreakEngineService) {}
}
