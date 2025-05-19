import { Component, Input } from '@angular/core';
import { GameType } from 'src/app/game/shared/constants/game.constants';
import {
  BioBallRule,
  CareerPathRule,
  HTP_BIO_BALL_RULES,
  HTP_CAREER_PATH_RULES,
} from '../constants/htp.constants';

@Component({
  selector: 'game-rule-list',
  standalone: false,
  templateUrl: './game-rule-list.component.html',
  styleUrl: './game-rule-list.component.scss',
})
export class GameRuleListComponent {
  protected readonly GameType = GameType;

  @Input() description!: string;
  @Input() set gameType(value: GameType) {
    this._gameType = value;
    this.setRules(value);
  }

  get gameType(): GameType {
    return this._gameType;
  }

  protected bioBallRules?: BioBallRule[];
  protected careerPathRules?: CareerPathRule[];
  private _gameType!: GameType;

  protected setRules(gameType: GameType): void {
    if (gameType === GameType.BIO_BALL) {
      this.bioBallRules = HTP_BIO_BALL_RULES;
    } else if (gameType === GameType.CAREER_PATH) {
      this.careerPathRules = HTP_CAREER_PATH_RULES;
    }
  }
}
