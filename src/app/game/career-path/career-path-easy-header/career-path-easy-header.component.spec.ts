import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CareerPathEasyHeaderComponent } from './career-path-easy-header.component';

describe('CareerPathEasyHeaderComponent', () => {
  let component: CareerPathEasyHeaderComponent;
  let fixture: ComponentFixture<CareerPathEasyHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CareerPathEasyHeaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CareerPathEasyHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
