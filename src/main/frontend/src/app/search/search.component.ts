import { Component, EventEmitter, Input, Output, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith, take, takeUntil } from 'rxjs/operators';

import { MatOption } from '@angular/material/core';
import { FloatLabelType } from '@angular/material/form-field';
import { MlbPlayer } from '../shared/models/mlb-models';

@Component({
  selector: 'search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent {
  @Input() players?: MlbPlayer[];
  @Input() disabled: boolean = false;
  @Input() placeHolderText!: string;

  @Output() selectPlayerEvent = new EventEmitter<MlbPlayer>();

  @ViewChildren('playerOption') playerOptions!: QueryList<MatOption>;

  protected selectedPlayer?: MlbPlayer;
  protected guessCount = 0;
  protected maxGuessNum = 9;
  protected searchControl = new FormControl();
  protected filteredPlayers: Observable<MlbPlayer[]>;

  constructor() {
    // Only include 10 players from filtered list for performance
    this.filteredPlayers = this.searchControl.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value).slice(0, 10))
    );
  }

  protected getFloatLabelValue(): FloatLabelType {
    const floatControl = new FormControl('never' as FloatLabelType);
    return floatControl.value || 'auto';
  }

  protected selectPlayer(player: MlbPlayer): void {
    if (this.searchControl.value !== null) {
      this.selectPlayerEvent.emit(player);
      this.searchControl.setValue(null);
    }

    for (const option of this.playerOptions) {
      option.deselect();
    }
  }

  private _filter(value: string): MlbPlayer[] {
    if (!this.players) {
      return [];
    }
    if (!value) {
      return this.players;
    }
    const filterValue = value.toLowerCase();
    return this.players.filter((player) => player.name.toLowerCase().includes(filterValue));
  }
}
