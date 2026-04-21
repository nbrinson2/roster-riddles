import { Component } from '@angular/core';

/** One row in the operator docs list (paths relative to repo root). */
export interface AdminDocLink {
  title: string;
  /** e.g. `docs/admin-dashboard-ops-ad3.md` */
  path: string;
}

/**
 * Right-drawer shell for operators (Story AD-6). Weekly contest actions use
 * **`AdminWeeklyContestsApiService`** → **`/api/v1/admin/*`** (Bearer + admin claim); no operator secret in the client.
 */
@Component({
  selector: 'admin-dashboard-panel',
  templateUrl: './admin-dashboard-panel.component.html',
  styleUrls: ['./admin-dashboard-panel.component.scss'],
  standalone: false,
})
export class AdminDashboardPanelComponent {
  protected readonly disclaimer =
    'Weekly contest status changes call authenticated admin APIs; invalid transitions are rejected server-side (see weekly-contests-ops-d1.md).';

  protected readonly docLinks: AdminDocLink[] = [
    {
      title: 'Admin claim (grant / revoke)',
      path: 'docs/admin-dashboard-ops-ad3.md',
    },
    {
      title: 'Admin dashboard — security & backlog',
      path: 'docs/admin-dashboard-security.md',
    },
    {
      title: 'Weekly contests — runbook',
      path: 'docs/weekly-contests-runbook-g2.md',
    },
    {
      title: 'Leaderboards — runbook',
      path: 'docs/leaderboards-runbook.md',
    },
  ];
}
