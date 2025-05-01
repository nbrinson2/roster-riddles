import { CommonModule } from '@angular/common';
import { provideHttpClient } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';

import { getAnalytics, provideAnalytics, ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';
import { initializeApp, provideFirebaseApp } from '@angular/fire/app';
import { getAuth, provideAuth } from '@angular/fire/auth';
import { initializeFirestore, provideFirestore } from '@angular/fire/firestore';
import { ReactiveFormsModule } from '@angular/forms';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatGridListModule } from '@angular/material/grid-list';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTableModule } from '@angular/material/table';
import { MatTooltipModule } from '@angular/material/tooltip';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { getApp } from 'firebase/app';
import { environment } from 'src/environment';
import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { AttributeHeaderComponent } from './game/bio-ball/attribute-header/attribute-header.component';
import { BioBallComponent } from './game/bio-ball/bio-ball.component';
import { ActiveRosterTableComponent } from './nav/active-roster-table/active-roster-table.component';
import { BioBallHtpComponent } from './nav/how-to-play/bio-ball-htp/bio-ball-htp.component';
import { NavComponent } from './nav/nav.component';
import { ProfileComponent } from './nav/profile/profile.component';
import { HintComponent } from './shared/components/hint/hint.component';
import { SlideUpComponent } from './shared/components/slide-up/slide-up.component';
import { BioBallPlayerComponent } from './game/bio-ball/player/bio-ball-player.component';
import { SearchComponent } from './shared/components/search/search.component';
import { GameComponent } from './game/game.component';
import { HowToPlayComponent } from './nav/how-to-play/how-to-play.component';
@NgModule({
  declarations: [
    AppComponent,
    BioBallComponent,
    BioBallPlayerComponent,
    SearchComponent,
    AttributeHeaderComponent,
    ActiveRosterTableComponent,
    BioBallHtpComponent,
    NavComponent,
    ProfileComponent,
    SlideUpComponent,
    HintComponent,
    GameComponent,
    HowToPlayComponent
  ],
  imports: [
    BrowserModule,
    CommonModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatGridListModule,
    MatButtonModule,
    MatSidenavModule,
    MatTableModule,
    ReactiveFormsModule,
    MatInputModule,
    MatAutocompleteModule,
    MatTooltipModule,
    MatCardModule,
    MatIconModule,
  ],
  providers: [
    provideFirebaseApp(() => initializeApp(environment.firebase)),
    provideFirestore(() => initializeFirestore(getApp(), {}, 'roster-riddles')),
    provideAnalytics(() => getAnalytics()),
    provideAuth(() => getAuth()),
    provideHttpClient(),
    ScreenTrackingService,
    UserTrackingService,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
