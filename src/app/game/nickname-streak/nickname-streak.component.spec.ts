import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NicknameStreakComponent } from './nickname-streak.component';

describe('NicknameStreakComponent', () => {
  let component: NicknameStreakComponent;
  let fixture: ComponentFixture<NicknameStreakComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [NicknameStreakComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NicknameStreakComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
