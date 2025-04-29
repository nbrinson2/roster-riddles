import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { MlbPlayersResolver } from './game/player/resolvers/mlb-players-resolver';
import { NavComponent } from './nav/nav.component';
import { MlbGameService } from './game/services/mlb-game.service';
import { GameEngineService } from './game/services/game.service';

const routes: Routes = [
  {
    path: '',
    redirectTo: 'mlb',
    pathMatch: 'full'
  },
  {
    path: 'mlb',
    component: NavComponent,
    providers: [{ provide: GameEngineService, useClass: MlbGameService }],
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
