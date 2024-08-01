import { AfterViewInit, ChangeDetectorRef, Component, OnInit } from '@angular/core';
import { PlayerAttributeColor, MlbPlayer } from '../shared/mlb-models';
import { MLB_PLAYERS, NFL_PLAYERS } from 'src/test-data';
import { MlbPlayerAttributes, NflPlayerAttributes } from '../shared/enumeration/attributes';
import { LeagueType, Player } from '../shared/models';
import { GameService } from '../services/game.service';

interface HowToPlayExamplePlayer {
  player: Player;
  explanation: string;
}

const mlbExplanationMap = new Map<MlbPlayer, string>([
  [MLB_PLAYERS[0], `<font color="#68C3F0">Blue</font> in any column indicates a match!`],
  [
    MLB_PLAYERS[1],
    `Lg/Div: <font color="FCAE5B">Orange</font> indicates that the player plays in either the revealed League or Division.`,
  ],
  [
    MLB_PLAYERS[2],
    `Age: <font color="FCAE5B">Orange</font> indicates 2 years within the mystery player's age.`,
  ],
  [
    MLB_PLAYERS[3],
    `Team: Click on the team to reveal the active roster, BUT it will cost you a guess!`,
  ],
]);

const nflExplanationMap = new Map<Player, string>([
  [NFL_PLAYERS[0], `<font color="#68C3F0">Blue</font> in any column indicates a match!`],
  [
    NFL_PLAYERS[1],
    `Lg/Div: <font color="FCAE5B">Orange</font> indicates that the player plays in either the revealed League or Division.`,
  ],
  [
    NFL_PLAYERS[2],
    `Age: <font color="FCAE5B">Orange</font> indicates 2 years within the mystery player's age.`,
  ],
  [
    NFL_PLAYERS[3],
    `Draft Year: <font color="FCAE5B">Orange</font> indicates 2 years within the mystery player's draft year.`,
  ],
  [
    NFL_PLAYERS[4],
    `Jersey Number: <font color="#FCAE5B">Orange</font> indicates 2 numbers within the mystery player's jersey number.`,
  ],
  [
    NFL_PLAYERS[5],
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

  constructor(private gameService: GameService, private cdr: ChangeDetectorRef) {}

  ngAfterViewInit(): void {
    this.setPlayerColorMaps();
    this.populatePlayerExampleList();
    this.cdr.detectChanges();
  }

  private populatePlayerExampleList(): void {
    switch (this.leagueType) {
      case LeagueType.MLB:
        for (const player of MLB_PLAYERS) {
          this.playerExamples.push({
            player: player,
            explanation: mlbExplanationMap.get(player) || '',
          });
        }
        break;
      case LeagueType.NFL:
        for (const player of NFL_PLAYERS) {
          this.playerExamples.push({
            player: player,
            explanation: nflExplanationMap.get(player) || '',
          });
        }
        break;
    }
  }

  private setPlayerColorMaps(): void {
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
        NFL_PLAYERS[0].colorMap.set(NflPlayerAttributes.POSITION, PlayerAttributeColor.BLUE);
        NFL_PLAYERS[0].colorMap.set(NflPlayerAttributes.COLLEGE, PlayerAttributeColor.BLUE);
        NFL_PLAYERS[1].colorMap.set(NflPlayerAttributes.LG_DIV, PlayerAttributeColor.ORANGE);
        NFL_PLAYERS[2].colorMap.set(NflPlayerAttributes.AGE, PlayerAttributeColor.ORANGE);
        NFL_PLAYERS[3].colorMap.set(NflPlayerAttributes.DRAFT_YEAR, PlayerAttributeColor.ORANGE);
        NFL_PLAYERS[4].colorMap.set(NflPlayerAttributes.JERSEY_NUMBER, PlayerAttributeColor.ORANGE);
        NFL_PLAYERS[5].colorMap.set(NflPlayerAttributes.TEAM, PlayerAttributeColor.BLUE);
        break;
    }
  }
}
