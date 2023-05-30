import { Component, Input } from '@angular/core';
import { SocialUser } from '@abacritt/angularx-social-login';

@Component({
  selector: 'profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent {
  @Input() user!: SocialUser;
}
