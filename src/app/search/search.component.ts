import { Component, Input } from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { Player } from '../home/home.component';

@Component({
  selector: 'search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss']
})
export class SearchComponent {
  @Input() players!: Player[];

  protected guessCount = 0;
  protected maxGuessNum = 9;
  protected searchControl = new FormControl();
  protected filteredPlayers: Observable<Player[]>;
  protected showAutoComplete = false;

  constructor() {
    this.filteredPlayers = this.searchControl.valueChanges.pipe(
      startWith(''),
      map((value) => this._filter(value))
    );
  }

  private _filter(value: string): Player[] {
    const filterValue = value.toLowerCase();
    return this.players.filter((player) => player.name.toLowerCase().includes(filterValue));
  }

  protected onInputFocus(): void {
    this.showAutoComplete = true;
  }

  protected onInputBlur(): void {
    setTimeout(() => {
      this.showAutoComplete = false;
    }, 200);
  }

  protected selectPlayer(player: Player) {
    console.log(player);
  }

}
