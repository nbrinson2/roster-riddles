import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { NavComponent } from './nav/nav.component';
import { PlayersResolver } from './resolvers/players-resolver';

const routes: Routes = [
  {path: 'home', component: NavComponent, resolve: { players: PlayersResolver}},
  {path: '', redirectTo: '/home', pathMatch: 'full'},
];


@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
