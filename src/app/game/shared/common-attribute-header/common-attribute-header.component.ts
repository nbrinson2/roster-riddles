import { style, transition, trigger } from '@angular/animations';
import { state } from '@angular/animations';
import { animate } from '@angular/animations';
import { Component, EventEmitter, Input, Output } from '@angular/core';
import { GameState } from '../../career-path/services/career-path-engine/career-path-engine.service';

export interface Header {
  name: string;
  colSpan: number;
  class: string;
  revealed?: boolean;
  value?: string;
}

@Component({
  selector: 'common-attribute-header',
  standalone: false,
  templateUrl: './common-attribute-header.component.html',
  styleUrl: './common-attribute-header.component.scss',
  animations: [
    trigger('textSwap', [
      state('name', style({ opacity: 1 })),
      state('value', style({ opacity: 1 })),
      transition('name <=> value', [
        animate('150ms ease-in', style({ opacity: 0 })),
        animate('150ms ease-out', style({ opacity: 1 }))
      ])
    ])
  ]
})
export class CommonAttributeHeaderComponent {
  @Input() gameState!: GameState;
  @Input() attrHeaders!: Header[];
  @Input() numberOfColumns!: number;
  @Output() columnClick = new EventEmitter<void>();

  toggle(header: Header): void {
    if (header.value === undefined || header.revealed || this.gameState !== GameState.PLAYING) {
      return;
    }
    header.revealed = !header.revealed;
    this.columnClick.emit();
  }
}
