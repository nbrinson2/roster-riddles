import { Component, Input } from '@angular/core';
import type { User } from 'firebase/auth';

@Component({
  selector: 'profile',
  templateUrl: './profile.component.html',
  styleUrls: ['./profile.component.scss'],
  standalone: false,
})
export class ProfileComponent {
  @Input() user: User | null = null;
}
