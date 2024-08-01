import { Component, Input } from '@angular/core';
import { User } from '../shared/models/models';

@Component({
  selector: 'profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss']
})
export class ProfileComponent {
  @Input() user!: User;
}
