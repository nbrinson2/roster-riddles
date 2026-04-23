import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AdminDashboardPanelComponent } from './admin-dashboard-panel.component';

describe('AdminDashboardPanelComponent', () => {
  let fixture: ComponentFixture<AdminDashboardPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [AdminDashboardPanelComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(AdminDashboardPanelComponent);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should render title and disclaimer', () => {
    const el: HTMLElement = fixture.nativeElement;
    expect(el.textContent).toContain('Admin');
    expect(el.textContent).toContain('navigational');
  });
});
