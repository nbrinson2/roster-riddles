import { Component, Input } from '@angular/core';
import { GameType } from 'src/app/game/shared/constants/game.constants';
import {
  BioBallRule,
  CareerPathRule,
  HTP_BIO_BALL_RULES,
  HTP_CAREER_PATH_EASY_RULES,
  HTP_CAREER_PATH_RULES,
} from '../constants/htp.constants';
import { Difficulty } from '../../difficulty-toggle/difficulty-toggle.component';
import { CAREER_PATH_ATTRIBUTE_HEADERS } from '../constants/htp-player.constants';

@Component({
  selector: 'game-rule-list',
  standalone: false,
  templateUrl: './game-rule-list.component.html',
  styleUrl: './game-rule-list.component.scss',
})
export class GameRuleListComponent {
  @Input() description!: string;
  @Input() set gameType(value: GameType) {
    this._gameType = value;
    this.setRules(value);
  }
  @Input() set currentGameMode(value: Difficulty) {
    this._currentGameMode = value;
    this.setRules(this.gameType);
  }

  get gameType(): GameType {
    return this._gameType;
  }

  get currentGameMode(): Difficulty {
    return this._currentGameMode;
  }

  protected readonly GameType = GameType;
  protected readonly CAREER_PATH_ATTRIBUTE_HEADERS = CAREER_PATH_ATTRIBUTE_HEADERS;
  protected bioBallRules?: BioBallRule[];
  protected careerPathRules?: CareerPathRule[];
  private _gameType!: GameType;
  private _currentGameMode!: Difficulty;

  protected setRules(gameType: GameType): void {
    if (gameType === GameType.BIO_BALL) {
      this.bioBallRules = HTP_BIO_BALL_RULES;
    } else if (gameType === GameType.CAREER_PATH) {
      if (this.currentGameMode === 'hard') {
        this.careerPathRules = HTP_CAREER_PATH_RULES;
      } else {
        this.careerPathRules = HTP_CAREER_PATH_EASY_RULES;
      }
    }
  }
}
