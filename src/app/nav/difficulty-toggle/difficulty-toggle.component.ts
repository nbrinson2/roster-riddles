import { Component, EventEmitter, Input, Output } from '@angular/core';

export type Difficulty = 'easy' | 'hard' | 'n/a';

@Component({
  selector: 'difficulty-toggle',
  standalone: false,
  templateUrl: './difficulty-toggle.component.html',
  styleUrl: './difficulty-toggle.component.scss',
})
export class DifficultyToggleComponent {
  @Input() value: Difficulty = 'easy';
  @Output() valueChange = new EventEmitter<Difficulty>();

  toggle() {
    this.value = this.value === 'easy' ? 'hard' : 'easy';
    this.valueChange.emit(this.value);
  }

}
