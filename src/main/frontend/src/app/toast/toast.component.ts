import { Component, computed, Input } from '@angular/core'
import { ToastService } from '../services/toast.service'
import { MlbPlayer } from '../shared/models/mlb-models'

@Component({
  selector: 'toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
})
export class ToastComponent {
  get player(): MlbPlayer {
    return this.toastService.playerCorrectAnswer();
  }

  get isVisible(): boolean {
    return this.toastService.isVisible()
  }

  constructor(private toastService: ToastService) {}

  hideToast(): void {
    this.toastService.hideToast()
  }

  ngAfterContentChecked(): void {
    const toast = document.getElementById('toast')
    toast?.focus()
  }
}
