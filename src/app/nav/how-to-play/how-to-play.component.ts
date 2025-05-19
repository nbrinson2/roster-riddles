import { Component, Input } from '@angular/core';
import { GameType } from 'src/app/game/shared/constants/game.constants';

export enum HowToPlayDescription {
  BIO_BALL = 'Guess the mystery player within 9 guesses.',
  CAREER_PATH = 'Guess the mystery player within 9 guesses.',
}

@Component({
  selector: 'how-to-play',
  templateUrl: './how-to-play.component.html',
  styleUrl: './how-to-play.component.scss',
  standalone: false,
})
export class HowToPlayComponent {
  protected readonly GameType = GameType;

  @Input() set gameType(value: GameType) {
    this._gameType = value;
    this.description = value === GameType.BIO_BALL ? HowToPlayDescription.BIO_BALL : HowToPlayDescription.CAREER_PATH;
  }

  get gameType(): GameType {
    return this._gameType;
  }

  protected description!: HowToPlayDescription;
  private _gameType!: GameType;
}
