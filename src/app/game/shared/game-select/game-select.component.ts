import { trigger } from '@angular/animations';
import { style, transition } from '@angular/animations';
import { animate } from '@angular/animations';
import { Component, EventEmitter, HostListener, Input, Output } from '@angular/core';
import { GAME_OPTIONS, GameOption } from './constants/game-select.constants';
import { GameType } from 'src/app/game/shared/constants/game.constants';

@Component({
  selector: 'game-select',
  standalone: false,
  templateUrl: './game-select.component.html',
  styleUrl: './game-select.component.scss',
  animations: [
    trigger('slideDownUp', [
      transition(':enter', [
        style({ transform: 'translateY(-20px)', opacity: 0 }),
        animate(
          '300ms ease-out',
          style({ transform: 'translateY(0)', opacity: 1 })
        ),
      ]),
      transition(':leave', [
        animate(
          '200ms ease-in',
          style({ transform: 'translateY(-20px)', opacity: 0 })
        ),
      ]),
    ]),
  ],
})
export class GameSelectComponent {
  @Input() currentGameType!: GameType;
  @Output() resetState = new EventEmitter<void>();

  get currentGame(): GameOption {
    return this.games.find(g => g.type === this.currentGameType)!;
  }

  games = GAME_OPTIONS;
  isOpen = false;

  toggleDropdown() {
    this.isOpen = !this.isOpen;
  }

  selectGame() {
    this.isOpen = false;
    this.resetState.emit();
  }

  // close when clicking outside
  @HostListener('document:click', ['$event.target'])
  onClickOutside(target: HTMLElement) {
    if (
      !target.closest('.dropdown-menu') &&
      !target.closest('.dropdown-toggle')
    ) {
      this.isOpen = false;
    }
  }
}
