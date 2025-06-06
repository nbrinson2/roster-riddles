import { Component, Input } from '@angular/core';
import { GameType } from 'src/app/game/shared/constants/game.constants';
import { Difficulty } from '../difficulty-toggle/difficulty-toggle.component';

export enum HowToPlayDescription {
  BIO_BALL = 'Guess the mystery player within 9 guesses.',
  CAREER_PATH = 'Guess the mystery player within 9 guesses.',
  NICKNAME_STREAK = 'Guess the name of the mystery player from their nickname.',
}

@Component({
  selector: 'how-to-play',
  templateUrl: './how-to-play.component.html',
  styleUrl: './how-to-play.component.scss',
  standalone: false,
})
export class HowToPlayComponent {
  protected readonly GameType = GameType;

  @Input() currentGameMode: Difficulty = 'easy';
  @Input() set gameType(value: GameType) {
    this._gameType = value;
    this.description =
      value === GameType.BIO_BALL
        ? HowToPlayDescription.BIO_BALL
        : value === GameType.CAREER_PATH
        ? HowToPlayDescription.CAREER_PATH
        : HowToPlayDescription.NICKNAME_STREAK;
  }

  get gameType(): GameType {
    return this._gameType;
  }

  protected description!: HowToPlayDescription;
  private _gameType!: GameType;
}
