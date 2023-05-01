import { Component, Input } from '@angular/core';

import { Header } from 'src/app/home/home.component';
import { Player } from 'src/app/home/home.component';

@Component({
  selector: 'player',
  templateUrl: './player.component.html',
  styleUrls: ['./player.component.scss']
})
export class PlayerComponent {
  @Input() headers!: Header[];
  @Input() player?: Player;

  protected getColSpan(attr: string): number {
    console.log('attr', attr);
    const header = this.headers.filter((header) => header.name === attr);
    console.log('header', header);
    return 1;
  }

  protected getClass(attr: string): string {
    const header = this.headers.filter((header) => header.name === attr);

    return attr;
  }

}
