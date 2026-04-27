import { Component, Input } from '@angular/core';
import { CONTEST_CALENDAR_CANONICAL_LINE } from '../../shared/contest-engagement-copy';

@Component({
  selector: 'contests-panel-hero',
  templateUrl: './contests-panel-hero.component.html',
  styleUrls: ['../../contests-panel-ui.scss'],
  standalone: false,
})
export class ContestsPanelHeroComponent {
  @Input({ required: true }) heroTagline!: string;
  @Input({ required: true }) dryRunCopy!: string;
  @Input() realMoneyPaymentsCopy: string | null = null;
  /** Canonical “my contests” framing; override only if product copy changes. */
  @Input() calendarCanonicalLine: string = CONTEST_CALENDAR_CANONICAL_LINE;
}
