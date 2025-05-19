import {
  AfterViewInit,
  Component,
  ElementRef,
  Inject,
  QueryList,
  ViewChild,
  ViewChildren,
} from '@angular/core';
import { FormControl } from '@angular/forms';
import { Observable } from 'rxjs';
import { map, startWith } from 'rxjs/operators';

import { MatOption } from '@angular/material/core';
import {
  AttributesType,
  UiPlayer,
} from 'src/app/game/bio-ball/models/bio-ball.models';
import { GAME_SERVICE, GameService } from 'src/app/shared/utils/game-service.token';
import { GamePlayer } from 'src/app/shared/models/common-models';
import { CareerPathPlayer } from 'src/app/game/career-path/models/career-path.models';
import { Difficulty } from 'src/app/nav/difficulty-toggle/difficulty-toggle.component';

@Component({
  selector: 'search',
  templateUrl: './search.component.html',
  styleUrls: ['./search.component.scss'],
  standalone: false,
})
export class SearchComponent implements AfterViewInit {
  @ViewChild('searchInput') searchInput!: ElementRef<HTMLInputElement>;
  @ViewChildren('playerOption') playerOptions!: QueryList<MatOption>;

  get disabled(): boolean {
    return this.gameService.isSearchDisabled;
  }

  get placeHolderText(): string {
    return this.gameService.searchInputPlaceHolderText();
  }

  get currentGameMode(): Difficulty {
    return this.gameService.currentGameMode();
  }

  protected searchControl = new FormControl();
  protected filteredPlayers: Observable<GamePlayer[]>;

  constructor(
    @Inject(GAME_SERVICE)
    private gameService: GameService<GamePlayer>,
  ) {
    this.filteredPlayers = this.searchControl.valueChanges.pipe(
      startWith(''),
      map((value) => this.gameService.filterPlayers(value).slice(0, 10))
    );
  }

  ngAfterViewInit() {
    this.searchInput.nativeElement.focus();
  }

  protected isUiPlayer(object: GamePlayer): object is UiPlayer<AttributesType> {
    return 'colorMap' in object;
  }

  protected isCareerPathPlayer(object: GamePlayer): object is CareerPathPlayer {
    return 'groups' in object;
  }

  protected selectPlayer(player: GamePlayer): void {
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
