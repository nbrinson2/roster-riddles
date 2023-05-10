import { Component, EventEmitter, Input, Output, QueryList, ViewChild, ViewChildren } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith, take, takeUntil } from 'rxjs/operators';

import { Player } from '../home/home.component';
import { MatOption } from '@angular/material/core';
import { FloatLabelType } from '@angular/material/form-field';

@Component({
  selector: 'search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent {
  @Input() players?: Player[];
  @Input() disabled: boolean = false;
  @Input() placeHolderText!: string;

  @Output() selectPlayerEvent = new EventEmitter<Player>();

  @ViewChildren('playerOption') playerOptions!: QueryList<MatOption>;

  protected selectedPlayer?: Player;
  protected guessCount = 0;
  protected maxGuessNum = 9;
  protected searchControl = new FormControl();
  protected filteredPlayers: Observable<Player[]>;

  constructor() {
    this.filteredPlayers = this.searchControl.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value))
    );
  }

  protected getFloatLabelValue(): FloatLabelType {
    const floatControl = new FormControl('never' as FloatLabelType);
    return floatControl.value || 'auto';
  }

  protected selectPlayer(player: Player): void {
    if (this.searchControl.value !== null) {
      this.selectPlayerEvent.emit(player);
      this.searchControl.setValue(null);
    }

    for (const option of this.playerOptions) {
      option.deselect();
    }
  }

  private _filter(value: string): Player[] {
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
