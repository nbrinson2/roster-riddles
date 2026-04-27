import { Component, EventEmitter, Input, Output } from '@angular/core';
import {
  CONTEST_PANEL_EMPTY_BODY,
  CONTEST_PANEL_EMPTY_STRIP_TIP,
  CONTEST_PANEL_EMPTY_TITLE,
} from '../../shared/contest-engagement-copy';

@Component({
  selector: 'contests-panel-empty-state',
  templateUrl: './contests-panel-empty-state.component.html',
  styleUrls: ['../../contests-panel-ui.scss'],
  standalone: false,
})
export class ContestsPanelEmptyStateComponent {
  @Input() nextPlayHint: string | null = null;
  @Output() readonly refreshList = new EventEmitter<void>();

  protected readonly emptyTitle = CONTEST_PANEL_EMPTY_TITLE;
  protected readonly emptyBody = CONTEST_PANEL_EMPTY_BODY;
  protected readonly stripTip = CONTEST_PANEL_EMPTY_STRIP_TIP;

  protected onRefreshList(): void {
    this.refreshList.emit();
  }
}
