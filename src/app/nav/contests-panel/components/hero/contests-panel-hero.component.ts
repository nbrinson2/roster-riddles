import { Component, Input } from '@angular/core';

@Component({
  selector: 'contests-panel-hero',
  templateUrl: './contests-panel-hero.component.html',
  styleUrls: ['../../contests-panel-ui.scss'],
  standalone: false,
})
export class ContestsPanelHeroComponent {
  @Input({ required: true }) heroTagline!: string;
  /** Unified calendar + sim/live + Stripe copy for the dashed yellow panel. */
  @Input({ required: true }) dryRunCopy!: string;
}
