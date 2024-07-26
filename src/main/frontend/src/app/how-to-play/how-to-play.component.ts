import { AfterViewInit, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { PlayerAttributeColor, MlbPlayer } from '../shared/mlb-models';
import { MLB_PLAYERS } from 'src/test-data';
import { MlbPlayerAttributes } from '../shared/enumeration/attributes';
import { LeagueType, Player } from '../shared/models';
import { GameService } from '../services/game.service';

interface HowToPlayExamplePlayer {
  player: Player;
  explanation: string;
}

const mlbExplanationMap = new Map<MlbPlayer, string>([
  [MLB_PLAYERS[0], `<span class="blue">Blue</span> in any column indicates a match!`],
  [
    MLB_PLAYERS[1],
    `Lg/Div: <span class="orange">Orange</span> indicates that the player plays in either the revealed League or Division.`,
  ],
  [
    MLB_PLAYERS[2],
    `Age: <span class="orange">Orange</span> indicates 2 years within the mystery player's age.`,
  ],
  [
    MLB_PLAYERS[3],
    `Team: Click on the team to reveal the active roster, BUT it will cost you a guess!`,
  ],
]);

@Component({
  selector: 'how-to-play',
  templateUrl: './how-to-play.component.html',
  styleUrls: ['./how-to-play.component.scss'],
})
export class HowToPlayComponent implements AfterViewInit {
  get leagueType(): LeagueType {
    return this.gameService.leagueType();
  }

  protected playerExamples: HowToPlayExamplePlayer[] = [];

  protected matchPlayer: MlbPlayer = MLB_PLAYERS[0];
  protected lgDivPlayer: MlbPlayer = MLB_PLAYERS[1];
  protected agePlayer: MlbPlayer = MLB_PLAYERS[2];
  protected teamPlayer: MlbPlayer = MLB_PLAYERS[3];

  constructor(private gameService: GameService, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.setColorMaps();
    this.cdr.detectChanges();
  }

  private setColorMaps(): void {
    switch (this.leagueType) {
      case LeagueType.MLB:
        this.setMlbColorMaps();
        for (const player of MLB_PLAYERS) {
          this.playerExamples.push({
            player: player,
            explanation: mlbExplanationMap.get(player) || '',
          });
        }
        break;
    }
  }

  private setMlbColorMaps(): void {
    switch (this.leagueType) {
      case LeagueType.MLB:
        MLB_PLAYERS[0].colorMap.set(MlbPlayerAttributes.POS, PlayerAttributeColor.BLUE);
        MLB_PLAYERS[0].colorMap.set(MlbPlayerAttributes.B, PlayerAttributeColor.BLUE);
        MLB_PLAYERS[0].colorMap.set(MlbPlayerAttributes.T, PlayerAttributeColor.BLUE);
        MLB_PLAYERS[1].colorMap.set(MlbPlayerAttributes.LG_DIV, PlayerAttributeColor.ORANGE);
        MLB_PLAYERS[2].colorMap.set(MlbPlayerAttributes.AGE, PlayerAttributeColor.ORANGE);
        MLB_PLAYERS[3].colorMap.set(MlbPlayerAttributes.TEAM, PlayerAttributeColor.BLUE);
        break;
      case LeagueType.NFL:
        return;
    }
  }
}
