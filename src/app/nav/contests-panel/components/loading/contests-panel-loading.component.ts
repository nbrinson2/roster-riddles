import { Component } from '@angular/core';

@Component({
  selector: 'contests-panel-loading',
  templateUrl: './contests-panel-loading.component.html',
  styleUrls: ['../../contests-panel-ui.scss'],
  standalone: false,
})
export class ContestsPanelLoadingComponent {
  protected readonly skeletonPlaceholders = [1, 2, 3] as const;
}
