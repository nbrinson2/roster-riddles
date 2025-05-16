import {
  AfterViewInit,
  Component,
  ElementRef,
  EventEmitter,
  Input,
  Output,
  QueryList,
  ViewChildren,
} from '@angular/core';
import {
  HintService,
  HintType,
} from 'src/app/shared/components/hint/hint.service';
import { TeamStint, TimelineGroup } from '../models/career-path.models';
import { LogoService } from '../services/logo/logo.service';
import { HintArrowPosition } from 'src/app/shared/components/hint/hint.component';
@Component({
  selector: 'player-timeline',
  templateUrl: './player-timeline.component.html',
  styleUrl: './player-timeline.component.scss',
  standalone: false,
})
export class PlayerTimelineComponent implements AfterViewInit {
  @Input() playerName = 'Johnny Player';
  @Input() compact = false;
  @Input() winner = false;
  @Input() groups: TimelineGroup[] = [];
  @Input() showHint = false;
  @Output() selectTeamEvent = new EventEmitter<TeamStint>();

  @ViewChildren('yearsWrapper', { read: ElementRef })
  yearsWrappers!: QueryList<ElementRef<HTMLElement>>;

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

  protected hintType = HintType.CAREER_PATH_ROSTER_SELECT;
  protected arrowPosition = HintArrowPosition.TOP_LEFT;
  protected currentTarget!: HTMLElement;

  constructor(
    public logoService: LogoService,
    private hintService: HintService
  ) {}

  ngAfterViewInit() {
    this.yearsWrappers.changes.subscribe(() => {
      const wrappers = this.yearsWrappers.toArray();
      if (
        wrappers.length > 0 &&
        this.showHint &&
        !this.hintService.hints().find((h) => h.id === this.hintType)?.shown
      ) {
        this.currentTarget = wrappers[0].nativeElement;
        this.hintService.showHint(this.hintType);
      }
    });

    this.yearsWrappers.notifyOnChanges();
  }

  onLogoClick(stint: TeamStint): void {
    this.hintService.dismissHint();
    this.selectTeamEvent.emit(stint);
  }
}
