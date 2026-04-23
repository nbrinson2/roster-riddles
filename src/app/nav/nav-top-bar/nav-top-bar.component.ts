import {
  Component,
  EventEmitter,
  Inject,
  Input,
  Output,
  Signal,
} from '@angular/core';
import { GameType } from '../../game/shared/constants/game.constants';
import { GamePlayer } from '../../shared/models/common-models';
import { GAME_SERVICE, GameService } from '../../shared/utils/game-service.token';
import { UserMeCapabilitiesService } from '../../auth/user-me-capabilities.service';
import { Difficulty } from '../difficulty-toggle/difficulty-toggle.component';

@Component({
  selector: 'nav-top-bar',
  templateUrl: './nav-top-bar.component.html',
  styleUrls: ['./nav-top-bar.component.scss'],
  standalone: false,
})
export class NavTopBarComponent {
  protected readonly GameType = GameType;

  @Input({ required: true }) leaderboardsUiEnabled!: boolean;
  @Input({ required: true }) weeklyContestsUiEnabled!: boolean;
  @Input({ required: true }) adminDashboardUiEnabled!: boolean;
  @Input({ required: true }) loggedIn!: boolean;

  @Output() menuOpen = new EventEmitter<void>();
  @Output() leaderboardOpen = new EventEmitter<void>();
  @Output() contestsOpen = new EventEmitter<void>();
  @Output() difficultyChange = new EventEmitter<Difficulty>();
  @Output() loginOpen = new EventEmitter<void>();
  @Output() logout = new EventEmitter<void>();
  @Output() adminDashboardOpen = new EventEmitter<void>();
  @Output() profileOpen = new EventEmitter<void>();

  constructor(
    protected readonly userMeCapabilities: UserMeCapabilitiesService,
    @Inject(GAME_SERVICE)
    private readonly gameService: GameService<GamePlayer>,
  ) {}

  get currentGameName(): GameType {
    return this.gameService.currentGame();
  }

  get currentGameMode(): Signal<Difficulty> {
    return this.gameService.currentGameMode;
  }

  protected onDifficultyChange(difficulty: Difficulty): void {
    this.difficultyChange.emit(difficulty);
  }
}
