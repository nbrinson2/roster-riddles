import { Component } from '@angular/core';

/** One row in the operator docs list (paths relative to repo root). */
export interface AdminDocLink {
  title: string;
  /** e.g. `docs/admin/admin-dashboard-ops-ad3.md` */
  path: string;
}

/**
 * Right-drawer shell for operators (Story AD-6). Admin APIs use Bearer + **`admin`** claim
 * ([`AdminWeeklyContestsApiService`](../../shared/services/admin-weekly-contests-api.service.ts),
 * [`AdminUserClaimsApiService`](../../shared/services/admin-user-claims-api.service.ts)); no operator secret in the client.
 */
@Component({
  selector: 'admin-dashboard-panel',
  templateUrl: './admin-dashboard-panel.component.html',
  styleUrls: ['./admin-dashboard-panel.component.scss'],
  standalone: false,
})
export class AdminDashboardPanelComponent {
  protected readonly disclaimer =
    'Weekly contest and admin-user actions call authenticated admin APIs; invalid transitions are rejected server-side (see weekly-contests-ops-d1.md).';

  protected readonly docLinks: AdminDocLink[] = [
    {
      title: 'Admin claim (grant / revoke)',
      path: 'docs/admin/admin-dashboard-ops-ad3.md',
    },
    {
      title: 'Admin dashboard — security & backlog',
      path: 'docs/admin/admin-dashboard-security.md',
    },
    {
      title: 'Weekly contests — runbook',
      path: 'docs/weekly-contests/weekly-contests-runbook-g2.md',
    },
    {
      title: 'Leaderboards — runbook',
      path: 'docs/leaderboards/leaderboards-runbook.md',
    },
  ];
}
