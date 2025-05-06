import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewChild,
} from '@angular/core';
import { MlbTeamFullNameToKeyMap } from 'src/app/game/bio-ball/constants/bio-ball-constants';
import { TeamFullName } from 'src/app/game/bio-ball/models/bio-ball.models';
import {
  MlbTeamFullName,
  MlbTeamKey,
} from 'src/app/game/bio-ball/models/mlb.models';
import { CareerPathPlayer } from 'src/app/game/career-path/models/career-path.models';
import { CareerPathEngineService } from 'src/app/game/career-path/services/career-path-engine/career-path-engine.service';
import { LogoService } from 'src/app/game/career-path/services/logo/logo.service';
import {
  HintService,
  HintType,
} from 'src/app/shared/components/hint/hint.service';
import {
  CommonTableComponent,
  RowHeight,
} from 'src/app/shared/components/table/common-table.component';

interface RosterByYearsTableData {
  id: number;
  name: string;
  teams: RosterTeam[];
}

interface RosterTeam {
  teamKey: MlbTeamKey;
  from: number;
}

@Component({
  selector: 'roster-by-years-table',
  standalone: false,
  templateUrl: './roster-by-years-table.component.html',
  styleUrl: './roster-by-years-table.component.scss',
})
export class RosterByYearsTableComponent {
  protected readonly RowHeight = RowHeight;

  @ViewChild('table', { read: CommonTableComponent, static: false })
  table!: CommonTableComponent<CareerPathPlayer>;

  @Input() teamName!: TeamFullName;
  @Input() years!: string;
  @Input()
  set roster(value: CareerPathPlayer[]) {
    this._roster = value;
    this._rosterTableData = this.formatAndSortRoster(value);
  }

  @Output() playerSelected = new EventEmitter<CareerPathPlayer>();

  get rosterTableData(): RosterByYearsTableData[] {
    return this._rosterTableData;
  }

  protected readonly HintType = HintType;

  private _roster: CareerPathPlayer[] = [];
  private _rosterTableData: RosterByYearsTableData[] = [];
  protected columns: string[] = ['NAME', 'TEAMS'];
  protected firstRowElement: HTMLElement | null = null;

  constructor(
    private hintService: HintService,
    private gameService: CareerPathEngineService,
    public logoService: LogoService
  ) {}

  ngAfterViewChecked() {
    const el = this.table.firstRowElement?.nativeElement;
    if (el) {
      this.hintService.showHint(HintType.ROSTER_SELECT);
    }
  }

  protected onRowClick(rosterPlayer: RosterByYearsTableData): void {
    const player = this._roster.find((p) => p.id === rosterPlayer.id);
    if (player) {
      this.gameService.handlePlayerSelection(player);
      this.playerSelected.emit(player);
    }
  }

  private formatAndSortRoster(
    roster: CareerPathPlayer[]
  ): RosterByYearsTableData[] {
    const currentTeamKey =
      MlbTeamFullNameToKeyMap[this.teamName as MlbTeamFullName];

    return roster
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((player) => {
        const careerTeams = this.extractCareerTeams(player);
        const uniqueTeams = this.dedupeAndPrioritizeTeams(
          careerTeams,
          currentTeamKey
        );

        return {
          id: player.id,
          name: player.name,
          teams: uniqueTeams,
        };
      });
  }

  private extractCareerTeams(player: CareerPathPlayer): RosterTeam[] {
    return player.groups.flatMap((group) =>
      group.stints.map((s) => ({
        teamKey: s.teamKey as MlbTeamKey,
        from: s.from,
      }))
    );
  }

  private dedupeAndPrioritizeTeams(
    careerTeams: RosterTeam[],
    currentTeamKey: MlbTeamKey
  ): RosterTeam[] {
    // Build a map of teamKey → earliest RosterTeam
    const map = new Map<MlbTeamKey, RosterTeam>();
    for (const entry of careerTeams) {
      const existing = map.get(entry.teamKey);
      if (!existing || entry.from < existing.from) {
        map.set(entry.teamKey, entry);
      }
    }

    // Pull out the current team (if any)
    const current = map.get(currentTeamKey);

    // Collect all the others, sorted alphabetically by teamKey
    const others = Array.from(map.values())
      .filter((e) => e.teamKey !== currentTeamKey)
      .sort((a, b) => a.teamKey.localeCompare(b.teamKey));

    // Return current first (if present), then the rest
    return current ? [current, ...others] : others;
  }
}
