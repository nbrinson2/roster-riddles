import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { HttpClientModule } from '@angular/common/http';

import { AppRoutingModule } from './app-routing.module';
import { AppComponent } from './app.component';
import { HomeComponent } from './home/home.component';
import { PlayerComponent } from './player/player.component';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';
import { MatGridListModule } from '@angular/material/grid-list';
import { SearchComponent } from './search/search.component';
import { MatInputModule } from '@angular/material/input';
import { MatAutocompleteModule } from '@angular/material/autocomplete';
import { ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { AttributeHeaderComponent } from './attribute-header/attribute-header.component';
import { MatSidenavModule } from '@angular/material/sidenav';
import { ActiveRosterTableComponent } from './active-roster-table/active-roster-table.component';
import { MatTableModule } from '@angular/material/table';
import { GoogleLoginProvider, GoogleSigninButtonModule, SocialAuthServiceConfig, SocialLoginModule } from '@abacritt/angularx-social-login';
import { MatTooltipModule } from '@angular/material/tooltip';
import { HowToPlayComponent } from './how-to-play/how-to-play.component';
import { NavComponent } from './nav/nav.component';
import { ProfileComponent } from './profile/profile.component';
import { AuthenticationComponent } from './authentication/authentication.component';
import { MatListModule } from '@angular/material/list';
import { LoginComponent } from './authentication/login/login.component';
import { UserStatisticsComponent } from './profile/user-statistics/user-statistics.component';

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
    AuthenticationComponent,
    LoginComponent,
    UserStatisticsComponent,
  ],
  imports: [
    BrowserModule,
    AppRoutingModule,
    BrowserAnimationsModule,
    MatGridListModule,
    MatButtonModule,
    MatSidenavModule,
    MatTableModule,
    ReactiveFormsModule,
    MatInputModule,
    MatAutocompleteModule,
    HttpClientModule,
    SocialLoginModule,
    GoogleSigninButtonModule,
    MatTooltipModule,
    MatListModule,
  ],
  providers: [
    {
      provide: 'SocialAuthServiceConfig',
      useValue: {
        autoLogin: false,
        providers: [
          {
            id: GoogleLoginProvider.PROVIDER_ID,
            provider: new GoogleLoginProvider('928161371660-fevd85o3bmo9eqr0fkvt477dakcq7no5.apps.googleusercontent.com'),
          }
        ],
        onError: (err) => {
          console.error(err);
        }
      } as SocialAuthServiceConfig
    }
  ],
  bootstrap: [AppComponent]
})
export class AppModule { }
