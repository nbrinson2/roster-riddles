import { BIO_BALL_PLAYERS, CAREER_PATH_PLAYERS } from "./htp-player.constants";
import { AttributesType, UiPlayer } from "src/app/game/bio-ball/models/bio-ball.models";
import { CareerPathPlayer } from "src/app/game/career-path/models/career-path.models";
export interface BioBallRule {
  player: UiPlayer<AttributesType>;
  description: string;
}

export interface CareerPathRule {
  player: CareerPathPlayer;
  description: string;
}

export const HTP_BIO_BALL_RULES: BioBallRule[] = [
  {
    player: BIO_BALL_PLAYERS[0],
    description: '<span style="color: rgb(104, 195, 240);">Blue</span> in any column indicates a match!',
  },
  {
    player: BIO_BALL_PLAYERS[1],
    description: 'Lg/Div: <span style="color: rgb(252, 174, 91);">Orange</span> indicates that the player plays in either the revealed League or Division.',
  },
  {
    player: BIO_BALL_PLAYERS[2],
    description: 'Age: <span style="color: rgb(252, 174, 91);">Orange</span> indicates 2 years within the mystery player\'s age.',
  },
  {
    player: BIO_BALL_PLAYERS[3],
    description: 'Team: Click on the team to reveal the active roster, BUT it will cost you a guess!',
  },
];

export const HTP_CAREER_PATH_RULES: CareerPathRule[] = [
  {
    player: CAREER_PATH_PLAYERS[0],
    description: 'Team logo: A <span style="color: rgb(104, 195, 240);">Blue</span> border indicates a match for the given years!',
  },
  {
    player: CAREER_PATH_PLAYERS[1],
    description: 'Team logo: An <span style="color: rgb(252, 174, 91);">Orange</span> border indicates a team that the mystery player has played for, but not in the given years!',
  },
  {
    player: CAREER_PATH_PLAYERS[2],
    description: 'Years: <span style="color: rgb(104, 195, 240);">Blue</span> indicates the mystery player played all of the given years!',
  },
  {
    player: CAREER_PATH_PLAYERS[3],
    description: 'Years: <span style="color: rgb(252, 174, 91);">Orange</span> indicates the mystery player played during some of the given years, but not all!',
  },
  {
    player: CAREER_PATH_PLAYERS[4],
    description: 'Team logo: Click on the team logo to reveal players who played for the given team in the given years!',
  }
];
