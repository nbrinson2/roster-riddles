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
import { Difficulty } from 'src/app/nav/difficulty-toggle/difficulty-toggle.component';
import { trigger } from '@angular/animations';
import { style } from '@angular/animations';
import { state } from '@angular/animations';
import { animate } from '@angular/animations';
import { transition } from '@angular/animations';
@Component({
  selector: 'player-timeline',
  templateUrl: './player-timeline.component.html',
  styleUrl: './player-timeline.component.scss',
  standalone: false,
  animations: [
    trigger('textSwap', [
      state('name', style({ opacity: 1 })),
      state('value', style({ opacity: 1 })),
      transition('name <=> value', [
        animate('150ms ease-in', style({ opacity: 0 })),
        animate('150ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class PlayerTimelineComponent implements AfterViewInit {
  @Input() playerName!: string;
  @Input() compact = false;
  @Input() winner = false;
  @Input() groups: TimelineGroup[] = [];
  @Input() showHint = false;
  @Input() gameMode: Difficulty = 'easy';
  @Input() isPlayerToGuess = false;
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
