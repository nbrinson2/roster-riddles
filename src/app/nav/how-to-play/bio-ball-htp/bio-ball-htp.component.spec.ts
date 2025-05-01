import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BioBallHtpComponent } from './bio-ball-htp.component';

describe('HowToPlayComponent', () => {
  let component: BioBallHtpComponent;
  let fixture: ComponentFixture<BioBallHtpComponent>;

  beforeEach(() => {
    TestBed.configureTestingModule({
      declarations: [BioBallHtpComponent]
    });
    fixture = TestBed.createComponent(BioBallHtpComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
