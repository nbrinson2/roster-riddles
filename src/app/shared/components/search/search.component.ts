import {
  Component,
  ElementRef,
  Inject,
  OnInit,
  QueryList,
  ViewChild,
  ViewChildren
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { MatOption } from '@angular/material/core';
import { FloatLabelType } from '@angular/material/form-field';
import { BioBallEngineService } from 'src/app/game/bio-ball/services/bio-ball-engine/bio-ball-engine.service';
import { AttributesType, UiPlayer } from 'src/app/game/bio-ball/models/bio-ball.models';
import { BIO_BALL_SERVICE } from 'src/app/game/bio-ball/util/bio-ball.token';

@Component({
    selector: 'search',
    templateUrl: './search.component.html',
    styleUrls: ['./search.component.scss'],
    standalone: false
})
export class SearchComponent implements OnInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChildren('playerOption') playerOptions!: QueryList<MatOption>;

  get disabled(): boolean {
    return this.gameService.isSearchDisabled;
  }

  get placeHolderText(): string {
    return this.gameService.searchInputPlaceHolderText();
  }

  protected searchControl = new FormControl();
  protected filteredPlayers: Observable<UiPlayer<AttributesType>[]>;

  constructor(
    @Inject(BIO_BALL_SERVICE)
    private gameService: BioBallEngineService<UiPlayer<AttributesType>>
  ) {
    this.filteredPlayers = this.searchControl.valueChanges.pipe(
      startWith(''),
      map((value) => this.gameService.filterPlayers(value).slice(0, 10))
    );
  }

  ngOnInit() {
    this.searchInput.nativeElement.focus();
  }

  protected getFloatLabelValue(): FloatLabelType {
    const floatControl = new FormControl('never' as FloatLabelType);
    return floatControl.value || 'auto';
  }

  protected selectPlayer(player: UiPlayer<AttributesType>): void {
    if (this.searchControl.value !== null) {
      this.gameService.handlePlayerSelection(player);
      this.searchControl.setValue(null);
    }

    for (const option of this.playerOptions) {
      option.deselect();
    }
  }

  protected handleEnterKey(event: Event): void {
    event.preventDefault();
    const searchValue = this.searchControl.value;
    if (!searchValue) return;

    const matchingPlayer = this.gameService.findMatchingPlayer(searchValue);
    if (matchingPlayer) {
      this.selectPlayer(matchingPlayer);
    }
  }
}
