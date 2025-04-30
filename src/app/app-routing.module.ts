import { NgModule } from '@angular/core';
import { ActivatedRoute, ActivatedRouteSnapshot, RouterModule, Routes } from '@angular/router';
import { BioBallMlbService } from './game/bio-ball/services/bio-ball-mlb/bio-ball-mlb.service';
import { BIO_BALL_SERVICE } from './game/bio-ball/util/bio-ball.token';
import { NavComponent } from './nav/nav.component';
import { BioBallMlbResolver } from './game/bio-ball/resolvers/bio-ball-mlb.resolver';
import { BioBallComponent } from './game/bio-ball/bio-ball.component';
import { GameComponent } from './game/game.component';
import { BioBallResolver } from './game/bio-ball/resolvers/bio-ball.resolver';

const routes: Routes = [
  { path: '', redirectTo: 'bio-ball/mlb', pathMatch: 'full' },
  { path: '**', redirectTo: 'bio-ball/mlb' },

  {
    path: 'bio-ball/:league',
    component: NavComponent,
    children: [
      {
        path: '',
        component: GameComponent,
        // pick the correct service based on the :league param
        providers: [
          {
            provide: BIO_BALL_SERVICE,
            useFactory: (
              route: ActivatedRoute,
              mlb: BioBallMlbService,
            ) => {
              const league = route.snapshot.paramMap.get('league');
              return mlb;
            },
            deps: [
              ActivatedRoute,
              BioBallMlbService,
            ]
          }
        ],
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
];

@NgModule({
  imports: [RouterModule.forRoot(routes)],
  exports: [RouterModule],
})
export class AppRoutingModule {}
