import { ComponentFixture, TestBed } from '@angular/core/testing';

import { DifficultyToggleComponent } from './difficulty-toggle.component';

describe('DifficultyToggleComponent', () => {
  let component: DifficultyToggleComponent;
  let fixture: ComponentFixture<DifficultyToggleComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [DifficultyToggleComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(DifficultyToggleComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
