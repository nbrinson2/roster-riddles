import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PlayersResolver } from './home/player/resolvers/players-resolver';
import { NavComponent } from './nav/nav.component';

const routes: Routes = [
  {path: '', component: NavComponent, resolve: { players: PlayersResolver}},
];


@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
