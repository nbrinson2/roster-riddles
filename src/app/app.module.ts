import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { provideHttpClient } from '@angular/common/http';
import { CommonModule } from '@angular/common';

import { AppComponent } from './app.component';
import { PlayerComponent } from './home/player/player.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatGridListModule } from '@angular/material/grid-list';
import { SearchComponent } from './home/search/search.component';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { NavComponent } from './nav/nav.component';
import { ProfileComponent } from './nav/profile/profile.component';
import { HowToPlayComponent } from './nav/how-to-play/how-to-play.component';
import { ActiveRosterTableComponent } from './nav/active-roster-table/active-roster-table.component';
import { AttributeHeaderComponent } from './home/attribute-header/attribute-header.component';
import { AppRoutingModule } from './app-routing.module';
import { HomeComponent } from './home/home.component';
import { SlideUpComponent } from './shared/components/slide-up/slide-up.component';
import { HintComponent } from './shared/components/hint/hint.component';
import { provideFirebaseApp, initializeApp } from '@angular/fire/app';
import { provideFirestore, getFirestore, initializeFirestore } from '@angular/fire/firestore';
import { provideAnalytics, getAnalytics } from '@angular/fire/analytics';
import { provideAuth, getAuth } from '@angular/fire/auth';
import { ScreenTrackingService, UserTrackingService } from '@angular/fire/analytics';
import { environment } from 'src/environment';
import { getApp } from 'firebase/app';

@NgModule({
  declarations: [
    AppComponent,
    HomeComponent,
    PlayerComponent,
    SearchComponent,
    AttributeHeaderComponent,
    ActiveRosterTableComponent,
    HowToPlayComponent,
    NavComponent,
    ProfileComponent,
    SlideUpComponent,
    HintComponent
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
