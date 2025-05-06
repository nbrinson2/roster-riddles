import { Component, EventEmitter, Input, Output } from '@angular/core';
import { TeamStint, TimelineGroup } from '../models/career-path.models';
import { LogoService } from '../services/logo/logo.service';

@Component({
  selector: 'player-timeline',
  templateUrl: './player-timeline.component.html',
  styleUrl: './player-timeline.component.scss',
  standalone: false,
})
export class PlayerTimelineComponent {
  @Input() playerName = 'Johnny Player';
  @Input() compact = false;
  @Input() winner = false;
  @Input() groups: TimelineGroup[] = [];
  @Output() selectTeamEvent = new EventEmitter<TeamStint>();

  /** when in compact mode we ignore date-grouping and just show every logo */
  get flattenedStints(): TeamStint[] {
    const seen = new Set<string>();
    return this.groups
      .flatMap((g) => g.stints)
      .sort((a, b) => a.teamKey.localeCompare(b.teamKey))
      .filter((stint) => {
        if (seen.has(stint.teamKey)) {
          return false;
        }
        seen.add(stint.teamKey);
        return true;
      });
  }
  
  constructor(public logoService: LogoService) {}

  onLogoClick(stint: TeamStint): void {
    this.selectTeamEvent.emit(stint);
  }
}
