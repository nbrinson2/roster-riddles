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
  @Input() groups: TimelineGroup[] = [];
  @Input() compact = false;
  @Input() winner = false;
  @Output() selectTeamEvent = new EventEmitter<TeamStint>();

  /** when in compact mode we ignore date-grouping and just show every logo */
  get flattenedStints(): TeamStint[] {
    return this.groups.flatMap((g) => g.stints);
  }

  constructor(public logoService: LogoService) {}

  onLogoClick(stint: TeamStint): void {
    this.selectTeamEvent.emit(stint);
  }
}
