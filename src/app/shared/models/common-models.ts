import { AttributesType, UiPlayer } from "src/app/game/bio-ball/models/bio-ball.models";
import { CareerPathPlayer } from "src/app/game/career-path/models/career-path.models";
import { NicknameStreakPlayer } from "src/app/game/nickname-streak/models/nickname-streak.models";

export enum PlayerAttrColor {
  BLUE = 'blue',
  ORANGE = 'orange',
  NONE = 'none'
}

export type GamePlayer = UiPlayer<AttributesType> | CareerPathPlayer | NicknameStreakPlayer;