import {
  Component,
  Input,
  Output,
  EventEmitter,
  ViewChild,
  ElementRef,
  AfterViewChecked,
  OnInit,
} from '@angular/core';
import {
  MlbTeam,
  MlbTeamFullName,
  PlayerAttr,
  UiPlayer,
} from 'src/app/shared/models/models';
import { GameService } from 'src/app/shared/services/game.service';
import { HintService, HintType } from 'src/app/shared/components/hint/hint.service';

const MlbAbbreviationToFullNameMap: { [key in MlbTeam]: MlbTeamFullName } = {
  [MlbTeam.ARI]: MlbTeamFullName.ARIZONA_DIAMONDBACKS,
  [MlbTeam.ATL]: MlbTeamFullName.ATLANTA_BRAVES,
  [MlbTeam.BAL]: MlbTeamFullName.BALTIMORE_ORIOLES,
  [MlbTeam.BOS]: MlbTeamFullName.BOSTON_RED_SOX,
  [MlbTeam.CHC]: MlbTeamFullName.CHICAGO_CUBS,
  [MlbTeam.CHW]: MlbTeamFullName.CHICAGO_WHITE_SOX,
  [MlbTeam.CIN]: MlbTeamFullName.CINCINNATI_REDS,
  [MlbTeam.CLE]: MlbTeamFullName.CLEVELAND_GUARDIANS,
  [MlbTeam.COL]: MlbTeamFullName.COLORADO_ROCKIES,
  [MlbTeam.DET]: MlbTeamFullName.DETROIT_TIGERS,
  [MlbTeam.HOU]: MlbTeamFullName.HOUSTON_ASTROS,
  [MlbTeam.KCR]: MlbTeamFullName.KANSAS_CITY_ROYALS,
  [MlbTeam.LAA]: MlbTeamFullName.LOS_ANGELES_ANGELS,
  [MlbTeam.LAD]: MlbTeamFullName.LOS_ANGELES_DODGERS,
  [MlbTeam.MIA]: MlbTeamFullName.MIAMI_MARLINS,
  [MlbTeam.MIL]: MlbTeamFullName.MILWAUKEE_BREWERS,
  [MlbTeam.MIN]: MlbTeamFullName.MINNESOTA_TWINS,
  [MlbTeam.NYM]: MlbTeamFullName.NEW_YORK_METS,
  [MlbTeam.NYY]: MlbTeamFullName.NEW_YORK_YANKEES,
  [MlbTeam.OAK]: MlbTeamFullName.OAKLAND_ATHLETICS,
  [MlbTeam.PHI]: MlbTeamFullName.PHILADELPHIA_PHILLIES,
  [MlbTeam.PIT]: MlbTeamFullName.PITTSBURGH_PIRATES,
  [MlbTeam.SDP]: MlbTeamFullName.SAN_DIEGO_PADRES,
  [MlbTeam.SFG]: MlbTeamFullName.SAN_FRANCISCO_GIANTS,
  [MlbTeam.SEA]: MlbTeamFullName.SEATTLE_MARINERS,
  [MlbTeam.STL]: MlbTeamFullName.ST_LOUIS_CARDINALS,
  [MlbTeam.TBR]: MlbTeamFullName.TAMPA_BAY_RAYS,
  [MlbTeam.TEX]: MlbTeamFullName.TEXAS_RANGERS,
  [MlbTeam.TOR]: MlbTeamFullName.TORONTO_BLUE_JAYS,
  [MlbTeam.WSN]: MlbTeamFullName.WASHINGTON_NATIONALS,
};

@Component({
  selector: 'active-roster-table',
  templateUrl: './active-roster-table.component.html',
  styleUrls: ['./active-roster-table.component.scss'],
})
export class ActiveRosterTableComponent implements OnInit, AfterViewChecked {
  protected readonly HintType = HintType;

  @Input()
  set roster(value: UiPlayer[]) {
    this._roster = this.formatAndSortRoster(value);
    if (value?.length) {
      this.teamName =
        MlbAbbreviationToFullNameMap[this.roster[0].team as MlbTeam];
    }
  }

  get roster(): UiPlayer[] {
    return this._roster;
  }

  @Output() playerSelected = new EventEmitter<void>();
  @ViewChild('firstRow', { read: ElementRef })
  firstRowRef!: ElementRef<HTMLElement>;

  private _roster: UiPlayer[] = [];
  protected displayedAttributes = Object.values(PlayerAttr)
    .filter(
      (attr) =>
        attr !== PlayerAttr.TEAM &&
        attr !== PlayerAttr.LG_DIV &&
        attr !== PlayerAttr.COLOR_MAP
    )
    .map((attr) => attr.toUpperCase());
  protected teamName?: MlbTeamFullName;
  protected firstRowElement: HTMLElement | null = null;

  constructor(
    private gameService: GameService,
    private hintService: HintService
  ) {}

  ngAfterViewChecked() {
    // only run once, when the row actually appears
    if (this.firstRowRef?.nativeElement) {
      this.firstRowElement = this.firstRowRef.nativeElement;
      this.hintService.showHint(HintType.ROSTER_SELECT);
    }
  }

  ngOnInit() {
    if (this.roster.length > 0) {
      this.teamName =
        MlbAbbreviationToFullNameMap[this.roster[0].team as MlbTeam];
    }
  }

  protected getAttr(player: UiPlayer, attrValue: string): string {
    const attr = attrValue.toLowerCase() as PlayerAttr;
    if (attr === PlayerAttr.COLOR_MAP) {
      return '';
    }
    return player[attr];
  }

  protected onRowClick(player: UiPlayer): void {
    this.gameService.handlePlayerSelection(player);
    this.playerSelected.emit();
  }

  private formatAndSortRoster(roster: UiPlayer[]): UiPlayer[] {
    if (!roster) return [];

    const sortedRoster = roster.sort((playerOne, playerTwo) => {
      // Compare by position
      const positionComparison = playerOne.pos.localeCompare(playerTwo.pos);

      if (positionComparison !== 0) {
        // Positions are not equal, return the result of this comparison
        return positionComparison;
      } else {
        // Positions are equal, compare by name
        return playerOne.name.localeCompare(playerTwo.name);
      }
    });

    return sortedRoster.map((player) => {
      const nameArray = player.name.split(' ');
      const firstNameInitial = nameArray[0][0];
      const lastName = nameArray[nameArray.length - 1];
      return { ...player, name: `${firstNameInitial}. ${lastName}` };
    });
  }
}
