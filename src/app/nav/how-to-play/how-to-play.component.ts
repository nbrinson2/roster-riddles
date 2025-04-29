import { Component } from '@angular/core';
import { PlayerAttr, PlayerAttrColor, UiPlayer } from 'src/app/shared/models/models';
import { PLAYERS } from 'src/test-data';

@Component({
    selector: 'how-to-play',
    templateUrl: './how-to-play.component.html',
    styleUrls: ['./how-to-play.component.scss'],
    standalone: false
})
export class HowToPlayComponent {

  protected matchPlayer: UiPlayer = PLAYERS[0];
  protected lgDivPlayer: UiPlayer = PLAYERS[1];
  protected agePlayer: UiPlayer = PLAYERS[2];
  protected teamPlayer: UiPlayer = PLAYERS[3];

  constructor() {
    this.matchPlayer.colorMap.set(PlayerAttr.POS, PlayerAttrColor.BLUE);
    this.matchPlayer.colorMap.set(PlayerAttr.B, PlayerAttrColor.BLUE);
    this.matchPlayer.colorMap.set(PlayerAttr.T, PlayerAttrColor.BLUE);
    this.lgDivPlayer.colorMap.set(PlayerAttr.LG_DIV, PlayerAttrColor.ORANGE);
    this.agePlayer.colorMap.set(PlayerAttr.AGE, PlayerAttrColor.ORANGE);
    this.teamPlayer.colorMap.set(PlayerAttr.TEAM, PlayerAttrColor.BLUE);
  }
}
