import { Injectable, Signal, signal } from '@angular/core'

@Injectable({
  providedIn: 'root',
})
export class ToastService {
  get toastState(): Signal<string> {
    return this._toastState.asReadonly()
  }

  get isVisible(): Signal<boolean> {
    return this._isVisible.asReadonly()
  }

  private _toastState = signal<string>('')
  private _isVisible = signal<boolean>(false)

  showToast(message: string) {
    this._toastState.set(message)
    this._isVisible.set(true)
    setTimeout(() => this.hideToast(), 3000)
  }

  hideToast() {
    this._isVisible.set(false)
  }
}
