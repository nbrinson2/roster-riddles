import { Component } from '@angular/core';

export interface Column {
  name: string;
  colSpan: number;
  class: string;
}

export interface Player {
  name: string;
  team: string;
  lgDiv: string;
  b: string;
  t: string;
  born: string;
  age: string;
  pos: string;
}

const Headers = [
  {name: 'TEAM', colSpan: 1, class: 'team-column'},
  {name: 'LG./DIV.', colSpan: 2, class: 'lg-div-column'},
  {name: 'B', colSpan: 1, class: 'b-column'},
  {name: 'T', colSpan: 1, class: 't-column'},
  {name: 'BORN', colSpan: 2, class: 'born-column'},
  {name: 'AGE', colSpan: 1, class: 'age-column'},
  {name: 'POS.', colSpan: 1, class: 'pos-column'},
]

@Component({
  selector: 'home',
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent {
  protected players?: Column[][];

  constructor() {
    this.initializePlayers();
  }

  private addGuessedPlayer(player: Player): void {
    this.players?.push([
      {name: player.team, colSpan: 1, class: 'team-column'},
      {name: player.lgDiv, colSpan: 2, class: 'lg-div-column'},
      {name: player.b, colSpan: 1, class: 'b-column'},
      {name: player.t, colSpan: 1, class: 't-column'},
      {name: player.born, colSpan: 2, class: 'born-column'},
      {name: player.age, colSpan: 1, class: 'age-column'},
      {name: player.pos, colSpan: 1, class: 'pos-column'},    
    ]);
  }

  private initializePlayers(): void {
    this.players = [Headers];
  }
}
