import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ActiveRosterTableComponent } from './active-roster-table.component';

describe('ActiveRosterTableComponent', () => {
  let component: ActiveRosterTableComponent;
  let fixture: ComponentFixture<ActiveRosterTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ ActiveRosterTableComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ActiveRosterTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
