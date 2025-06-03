import { Component, Input } from '@angular/core';

@Component({
  selector: 'guess-result',
  standalone: false,
  templateUrl: './guess-result.component.html',
  styleUrl: './guess-result.component.scss'
})
export class GuessResultComponent {
  @Input() isCorrect: boolean = false;
  @Input() fullName: string = '';
  @Input() nickname: string = '';
}
