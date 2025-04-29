import { Component } from '@angular/core';
import { MlbPlayerAttributes, MlbUiPlayer } from 'src/app/shared/models/mlb.models';
import { PlayerAttrColor } from 'src/app/shared/models/models';
import { PLAYERS } from 'src/test-data';

@Component({
    selector: 'how-to-play',
    templateUrl: './how-to-play.component.html',
    styleUrls: ['./how-to-play.component.scss'],
    standalone: false
})
export class HowToPlayComponent {

  protected matchPlayer: MlbUiPlayer = PLAYERS[0];
  protected lgDivPlayer: MlbUiPlayer = PLAYERS[1];
  protected agePlayer: MlbUiPlayer = PLAYERS[2];
  protected teamPlayer: MlbUiPlayer = PLAYERS[3];

  constructor() {
    this.matchPlayer.colorMap.set(MlbPlayerAttributes.POS, PlayerAttrColor.BLUE);
    this.matchPlayer.colorMap.set(MlbPlayerAttributes.B, PlayerAttrColor.BLUE);
    this.matchPlayer.colorMap.set(MlbPlayerAttributes.T, PlayerAttrColor.BLUE);
    this.lgDivPlayer.colorMap.set(MlbPlayerAttributes.LG_DIV, PlayerAttrColor.ORANGE);
    this.agePlayer.colorMap.set(MlbPlayerAttributes.AGE, PlayerAttrColor.ORANGE);
    this.teamPlayer.colorMap.set(MlbPlayerAttributes.TEAM, PlayerAttrColor.BLUE);
  }
}
