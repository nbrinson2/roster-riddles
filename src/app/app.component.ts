import { Component, inject } from '@angular/core';
import { AuthSessionExpiryService } from './auth/auth-session-expiry.service';
import { UserBootstrapService } from './auth/user-bootstrap.service';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: false,
})
export class AppComponent {
  title = 'roster-riddles';

  /** Loads once; subscribes to auth and syncs `users/{uid}` after sign-in. */
  private readonly _userBootstrap = inject(UserBootstrapService);

  /** Optional max session from `environment.authSessionMaxMs` (prod CI). */
  private readonly _authSessionExpiry = inject(AuthSessionExpiryService);
}
