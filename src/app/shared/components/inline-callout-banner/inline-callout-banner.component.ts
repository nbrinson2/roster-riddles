import {
  Component,
  EventEmitter,
  Input,
  Output,
  ViewEncapsulation,
} from '@angular/core';

export type InlineCalloutVariant = 'info' | 'success' | 'warning' | 'neutral';

/**
 * Generic dismissible inline banner: body + optional action row + optional feedback slot,
 * plus optional dismiss control. Use for notices, post-sign-up prompts, maintenance, etc.
 */
@Component({
  selector: 'inline-callout-banner',
  templateUrl: './inline-callout-banner.component.html',
  styleUrls: ['./inline-callout-banner.component.scss'],
  encapsulation: ViewEncapsulation.None,
  standalone: false,
  host: { class: 'inline-callout-host' },
})
export class InlineCalloutBannerComponent {
  @Input() variant: InlineCalloutVariant = 'info';
  /** e.g. `status`, `alert`, or `null` to omit. */
  @Input() role: string | null = 'status';
  @Input() showDismiss = true;
  @Input() dismissLabel = 'Dismiss';

  @Output() dismiss = new EventEmitter<void>();
}
