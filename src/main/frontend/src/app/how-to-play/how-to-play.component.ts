import { Component } from '@angular/core';
import { MlbPlayerAttr, PlayerAttrColor, MlbPlayer } from '../shared/mlb-models';
import { PLAYERS } from 'src/test-data';

@Component({
  selector: 'how-to-play',
  templateUrl: './how-to-play.component.html',
  styleUrls: ['./how-to-play.component.scss']
})
export class HowToPlayComponent {

  protected matchPlayer: MlbPlayer = PLAYERS[0];
  protected lgDivPlayer: MlbPlayer = PLAYERS[1];
  protected agePlayer: MlbPlayer = PLAYERS[2];
  protected teamPlayer: MlbPlayer = PLAYERS[3];

  constructor() {
    this.matchPlayer.colorMap.set(MlbPlayerAttr.POS, PlayerAttrColor.BLUE);
    this.matchPlayer.colorMap.set(MlbPlayerAttr.B, PlayerAttrColor.BLUE);
    this.matchPlayer.colorMap.set(MlbPlayerAttr.T, PlayerAttrColor.BLUE);
    this.lgDivPlayer.colorMap.set(MlbPlayerAttr.LG_DIV, PlayerAttrColor.ORANGE);
    this.agePlayer.colorMap.set(MlbPlayerAttr.AGE, PlayerAttrColor.ORANGE);
    this.teamPlayer.colorMap.set(MlbPlayerAttr.TEAM, PlayerAttrColor.BLUE);
  }
}
