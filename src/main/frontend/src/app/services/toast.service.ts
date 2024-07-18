import { Injectable, Signal, signal } from '@angular/core'
import { UiPlayer } from '../models/models';

@Injectable({
  providedIn: 'root',
})
export class ToastService {

  get isVisible(): Signal<boolean> {
    return this._isVisible.asReadonly()
  }

  get playerCorrectAnswer(): Signal<UiPlayer> {
    return this._playerCorrectAnswer.asReadonly();
  }

  private _isVisible = signal<boolean>(false)
  private _playerCorrectAnswer = signal<UiPlayer>({} as UiPlayer);

  showToast(player: UiPlayer): void {
    this._playerCorrectAnswer.set(player);
    this._isVisible.set(true)
    // setTimeout(() => this.hideToast(), 4000)
  }

  hideToast() {
    this._isVisible.set(false)
  }
}
