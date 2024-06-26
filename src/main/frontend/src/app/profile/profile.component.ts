import { Component, Input } from '@angular/core';
import { User } from '../services/models';

@Component({
  selector: 'profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent {
  @Input() user!: User;
}
