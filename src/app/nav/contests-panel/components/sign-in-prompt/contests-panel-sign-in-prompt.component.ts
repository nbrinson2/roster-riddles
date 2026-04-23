import { Component, EventEmitter, Output } from '@angular/core';

@Component({
  selector: 'contests-panel-sign-in-prompt',
  templateUrl: './contests-panel-sign-in-prompt.component.html',
  styleUrls: ['../../contests-panel-ui.scss'],
  standalone: false,
})
export class ContestsPanelSignInPromptComponent {
  @Output() readonly requestSignIn = new EventEmitter<void>();

  protected onSignIn(): void {
    this.requestSignIn.emit();
  }
}
