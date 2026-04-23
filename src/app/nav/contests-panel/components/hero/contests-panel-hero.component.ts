import { Component, Input } from '@angular/core';

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
}
