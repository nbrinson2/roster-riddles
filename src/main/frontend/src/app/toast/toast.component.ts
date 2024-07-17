import { Component, computed } from '@angular/core'
import { ToastService } from '../services/toast.service'

@Component({
  selector: 'toast',
  templateUrl: './toast.component.html',
  styleUrls: ['./toast.component.scss'],
})
export class ToastComponent {
  get message(): string {
    return this.toastService.toastState()
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
