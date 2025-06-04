import { ComponentFixture, TestBed } from '@angular/core/testing';

import { StreakCardComponent } from './streak-card.component';

describe('StreakCardComponent', () => {
  let component: StreakCardComponent;
  let fixture: ComponentFixture<StreakCardComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [StreakCardComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(StreakCardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
