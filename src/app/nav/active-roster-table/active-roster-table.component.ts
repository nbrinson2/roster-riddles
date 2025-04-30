import {
  AfterViewChecked,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { BioBallEngineService } from 'src/app/game/bio-ball/services/bio-ball-engine/bio-ball-engine.service';
import {
  HintService,
  HintType,
} from 'src/app/shared/components/hint/hint.service';
import { TeamAbbreviationToFullNameMap } from 'src/app/game/bio-ball/constants/bio-ball-constants';
import { MlbUiPlayer } from 'src/app/game/bio-ball/models/mlb.models';
import {
  AttributesType,
  CommonAttributes,
  HiddenPlayerRosterAttributes,
  TeamFullName,
  TeamType,
  TeamUiPlayer,
  UiPlayer,
} from 'src/app/game/bio-ball/models/bio-ball.models';
@Component({
    selector: 'active-roster-table',
    templateUrl: './active-roster-table.component.html',
    styleUrls: ['./active-roster-table.component.scss'],
    standalone: false
})
export class ActiveRosterTableComponent implements AfterViewChecked {
  protected readonly HintType = HintType;

  @Input()
  set roster(value: UiPlayer<AttributesType>[]) {
    this._roster = this.formatAndSortRoster(value);
    if (value?.length) {
      const player = value[0] as TeamUiPlayer<AttributesType>;
      this.teamName = TeamAbbreviationToFullNameMap[
        player.team as TeamType
      ] as TeamFullName;
      this.displayedAttributes = Object.keys(player).filter(
        (attr) =>
          !Object.values(HiddenPlayerRosterAttributes).includes(
            attr as HiddenPlayerRosterAttributes
          )
      ).map((attr) => attr.toUpperCase());
    }
  }

  get roster(): UiPlayer<AttributesType>[] {
    return this._roster;
  }

  @Output() playerSelected = new EventEmitter<void>();
  @ViewChild('firstRow', { read: ElementRef })
  firstRowRef!: ElementRef<HTMLElement>;

  private _roster: UiPlayer<AttributesType>[] = [];
  protected displayedAttributes!: string[];
  protected teamName!: TeamFullName;
  protected firstRowElement: HTMLElement | null = null;

  constructor(
    private gameService: BioBallEngineService<UiPlayer<AttributesType>>,
    private hintService: HintService
  ) {}

  ngAfterViewChecked() {
    // only run once, when the row actually appears
    if (this.firstRowRef?.nativeElement) {
      this.firstRowElement = this.firstRowRef.nativeElement;
      this.hintService.showHint(HintType.ROSTER_SELECT);
    }
  }

  protected getAttr(
    player: UiPlayer<AttributesType>,
    attrValue: string
  ): string {
    const attr = attrValue.toLowerCase();
    if (attr === CommonAttributes.COLOR_MAP.toString()) {
      return '';
    }
    const value = player[attr as keyof UiPlayer<AttributesType>];
    return typeof value === 'string' ? value : '';
  }

  protected onRowClick(player: MlbUiPlayer): void {
    this.gameService.handlePlayerSelection(player);
    this.playerSelected.emit();
  }

  private formatAndSortRoster(
    roster: UiPlayer<AttributesType>[]
  ): UiPlayer<AttributesType>[] {
    if (!roster) return [];

    const sortedRoster = roster.sort((playerOne, playerTwo) => {
      // Compare by position
      const positionComparison = (
        playerOne as TeamUiPlayer<AttributesType>
      ).pos.localeCompare((playerTwo as TeamUiPlayer<AttributesType>).pos);

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
