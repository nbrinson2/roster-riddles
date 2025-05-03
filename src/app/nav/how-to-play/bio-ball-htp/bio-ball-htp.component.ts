import { Component } from '@angular/core';
import { MlbPlayerAttributes, MlbUiPlayer } from 'src/app/game/bio-ball/models/mlb.models';
import { PlayerAttrColor } from "src/app/shared/models/common-models";
import { PLAYERS } from 'src/app/nav/constants/htp-player-data';

@Component({
    selector: 'bio-ball-htp',
    templateUrl: './bio-ball-htp.component.html',
    styleUrls: ['./bio-ball-htp.component.scss'],
    standalone: false
})
export class BioBallHtpComponent {

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
