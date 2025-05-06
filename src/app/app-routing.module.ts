import { NgModule } from '@angular/core';
import { ActivatedRoute, RouterModule, Routes } from '@angular/router';
import { BioBallComponent } from './game/bio-ball/bio-ball.component';
import { BioBallResolver } from './game/bio-ball/resolvers/bio-ball.resolver';
import { BioBallMlbService } from './game/bio-ball/services/bio-ball-mlb/bio-ball-mlb.service';
import { GAME_SERVICE } from './shared/utils/game-service.token';
import { CareerPathComponent } from './game/career-path/career-path.component';
import { CareerPathMlbResolver } from './game/career-path/resolvers/career-path-mlb.resolver';
import { GameComponent } from './game/game.component';
import { NavComponent } from './nav/nav.component';
import { CareerPathEngineService } from './game/career-path/services/career-path-engine/career-path-engine.service';
const routes: Routes = [
  { path: '', redirectTo: 'bio-ball/mlb', pathMatch: 'full' },

  {
    path: 'bio-ball/:league',
    component: NavComponent,
    providers: [
      {
        provide: GAME_SERVICE,
        useFactory: (route: ActivatedRoute, mlb: BioBallMlbService) => {
          const league = route.snapshot.paramMap.get('league');
          return mlb;
        },
        deps: [ActivatedRoute, BioBallMlbService],
      },
    ],
    children: [
      {
        path: '',
        component: GameComponent,
        // pick the correct service based on the :league param
        children: [
          {
            path: '',
            component: BioBallComponent,
            // delegate to the resolver that knows how to handle each league
            resolve: {
              players: BioBallResolver,
            },
          },
        ],
      },
    ],
  },

  // ── Career-Path ───────────────────────
  {
    path: 'career-path/:league',
    component: NavComponent,
    providers: [
      { provide: GAME_SERVICE, useExisting: CareerPathEngineService },
    ],
    children: [
      {
        path: '',
        component: GameComponent,
        children: [
          {
            path: '',
            component: CareerPathComponent,
            resolve: {
              players: CareerPathMlbResolver,
            },
          },
        ],
      },
    ],
  },

  { path: '**', redirectTo: 'bio-ball/mlb' },
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
