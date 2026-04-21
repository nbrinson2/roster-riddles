import { Component, EventEmitter, Input, Output } from '@angular/core';

@Component({
  selector: 'contests-panel-fetch-error',
  templateUrl: './contests-panel-fetch-error.component.html',
  styleUrls: ['../../contests-panel-ui.scss'],
  standalone: false,
})
export class ContestsPanelFetchErrorComponent {
  @Input({ required: true }) message!: string;
  @Output() readonly retry = new EventEmitter<void>();

  protected onRetry(): void {
    this.retry.emit();
  }
}
