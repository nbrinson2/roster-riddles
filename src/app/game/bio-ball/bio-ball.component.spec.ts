import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BioBallComponent } from './bio-ball.component';

describe('HomeComponent', () => {
  let component: BioBallComponent;
  let fixture: ComponentFixture<BioBallComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [BioBallComponent]
    });
    fixture = TestBed.createComponent(BioBallComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});