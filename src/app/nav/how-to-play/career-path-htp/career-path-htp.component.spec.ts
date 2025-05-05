import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CareerPathHtpComponent } from './career-path-htp.component';

describe('CareerPathHtpComponent', () => {
  let component: CareerPathHtpComponent;
  let fixture: ComponentFixture<CareerPathHtpComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CareerPathHtpComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CareerPathHtpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
