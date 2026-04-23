import { Component, OnInit, inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { ActivatedRoute, Router } from '@angular/router';
import { applyActionCode } from 'firebase/auth';

type VerifyState = 'loading' | 'applied' | 'missing' | 'error';

@Component({
  selector: 'app-email-verified-page',
  templateUrl: './email-verified-page.component.html',
  styleUrls: ['./email-verified-page.component.scss'],
  standalone: false,
})
export class EmailVerifiedPageComponent implements OnInit {
  private readonly auth = inject(Auth);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  protected state: VerifyState = 'loading';
  protected errorDetail: string | null = null;

  async ngOnInit(): Promise<void> {
    const oobCode = this.route.snapshot.queryParamMap.get('oobCode');
    const mode = this.route.snapshot.queryParamMap.get('mode');

    if (!oobCode || mode !== 'verifyEmail') {
      this.state = this.auth.currentUser?.emailVerified ? 'applied' : 'missing';
      return;
    }

    try {
      await applyActionCode(this.auth, oobCode);
      await this.auth.currentUser?.reload();
      this.state = 'applied';
      await this.router.navigate(['/email-verified'], { replaceUrl: true });
    } catch (e) {
      this.state = 'error';
      this.errorDetail =
        e instanceof Error ? e.message.slice(0, 200) : 'Could not verify email.';
    }
  }

  protected goHome(): void {
    void this.router.navigateByUrl('/bio-ball/mlb');
  }
}
