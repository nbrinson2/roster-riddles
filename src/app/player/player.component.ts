import { Component, Input } from '@angular/core';

import { Column } from 'src/app/home/home.component';

@Component({
  selector: 'player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent {
  @Input() columns!: Column[];
}
