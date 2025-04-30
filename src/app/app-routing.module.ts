import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MlbPlayersResolver } from './game/player/resolvers/mlb-players-resolver';
import { MlbGameService } from './game/services/mlb-game.service';
import { GAME_SERVICE } from './game/util/game.token';
import { NavComponent } from './nav/nav.component';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'mlb',
    pathMatch: 'full'
  },
  {
    path: 'mlb',
    component: NavComponent,
    providers: [{ provide: GAME_SERVICE, useClass: MlbGameService }],
    resolve: { players: MlbPlayersResolver }
  },
  {
    path: 'nfl',
    component: NavComponent,
    resolve: { players: MlbPlayersResolver }
  }
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule]
})
export class AppRoutingModule { }
