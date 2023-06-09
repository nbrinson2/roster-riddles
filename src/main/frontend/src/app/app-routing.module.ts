import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { HomeComponent } from './home/home.component';
import { PlayersResolver } from './services/players-resolver';
import { NavComponent } from './nav/nav.component';

const routes: Routes = [
  {path: 'home', component: NavComponent, resolve: { players: PlayersResolver}},
  {path: '', redirectTo: '/home', pathMatch: 'full'},
];


@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
