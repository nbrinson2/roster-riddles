import {
  Component,
  EventEmitter,
  Input,
  Output
} from '@angular/core';
import { TeamAbbreviationToFullNameMap } from 'src/app/game/bio-ball/constants/bio-ball-constants';
import {
  AttributesType,
  HiddenPlayerRosterAttributes,
  TeamFullName,
  TeamType,
  TeamUiPlayer,
  UiPlayer,
} from 'src/app/game/bio-ball/models/bio-ball.models';
import { BioBallEngineService } from 'src/app/game/bio-ball/services/bio-ball-engine/bio-ball-engine.service';
import { HintArrowPosition } from 'src/app/shared/components/hint/hint.component';
import {
  HintType
} from 'src/app/shared/components/hint/hint.service';

@Component({
  selector: 'active-roster-table',
  templateUrl: './active-roster-table.component.html',
  styleUrls: ['./active-roster-table.component.scss'],
  standalone: false,
})
export class ActiveRosterTableComponent {
  @Input()
  set roster(value: UiPlayer<AttributesType>[]) {
    this._roster = this.formatAndSortRoster(value);
    if (value?.length) {
      const player = value[0] as TeamUiPlayer<AttributesType>;
      this.teamName = TeamAbbreviationToFullNameMap[
        player.team as TeamType
      ] as TeamFullName;
      this.displayedAttributes = Object.keys(player)
        .filter(
          (attr) =>
            !Object.values(HiddenPlayerRosterAttributes).includes(
              attr as HiddenPlayerRosterAttributes
            )
        )
        .map((attr) => attr.toUpperCase());
    }
  }

  @Output() playerSelected = new EventEmitter<void>();

  get roster(): UiPlayer<AttributesType>[] {
    return this._roster;
  }

  protected readonly HintType = HintType;
  protected readonly HintArrowPosition = HintArrowPosition;

  private _roster: UiPlayer<AttributesType>[] = [];
  protected displayedAttributes!: string[];
  protected teamName!: TeamFullName;

  constructor(
    private gameService: BioBallEngineService<UiPlayer<AttributesType>>
  ) {}

  protected onRowClick(player: UiPlayer<AttributesType>): void {
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
