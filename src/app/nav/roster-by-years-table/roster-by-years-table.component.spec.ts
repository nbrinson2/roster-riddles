import { ComponentFixture, TestBed } from '@angular/core/testing';

import { RosterByYearsTableComponent } from './roster-by-years-table.component';

describe('RosterByYearsTableComponent', () => {
  let component: RosterByYearsTableComponent;
  let fixture: ComponentFixture<RosterByYearsTableComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [RosterByYearsTableComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(RosterByYearsTableComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
