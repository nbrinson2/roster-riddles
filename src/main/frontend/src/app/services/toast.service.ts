import { Injectable, Signal, signal } from '@angular/core'
import { MlbPlayer } from '../shared/mlb-models';

@Injectable({
  providedIn: 'root',
})
export class ToastService {

  get isVisible(): Signal<boolean> {
    return this._isVisible.asReadonly()
  }

  get playerCorrectAnswer(): Signal<MlbPlayer> {
    return this._playerCorrectAnswer.asReadonly();
  }

  private _isVisible = signal<boolean>(false)
  private _playerCorrectAnswer = signal<MlbPlayer>({} as MlbPlayer);

  showToast(player: MlbPlayer): void {
    this._playerCorrectAnswer.set(player);
    this._isVisible.set(true)
    // setTimeout(() => this.hideToast(), 4000)
  }

  hideToast() {
    this._isVisible.set(false)
  }
}
