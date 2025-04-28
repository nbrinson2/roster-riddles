import { Injectable, Signal, signal } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class SlideUpService {
  get isVisible(): Signal<boolean> {
    return this._isVisible.asReadonly();
  }

  get shouldRender(): Signal<boolean> {
    return this._shouldRender.asReadonly();
  }

  set shouldRender(value: boolean) {
    this._shouldRender.set(value);
  }

  private _isVisible = signal(false);
  private _shouldRender = signal(false);
  private onCloseCallback?: () => void;

  show() {
    this._shouldRender.set(true);
    this._isVisible.set(true);
  }

  hide(onClose?: () => void) {
    this.onCloseCallback = onClose;
    this._isVisible.set(false);
  }

  runOnCloseIfExists() {
    if (this.onCloseCallback) {
      this.onCloseCallback();
      this.onCloseCallback = undefined;
    }
  }
}
