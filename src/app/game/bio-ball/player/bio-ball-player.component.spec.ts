import { ComponentFixture, TestBed } from '@angular/core/testing';

import { BioBallPlayerComponent } from './bio-ball-player.component';

describe('PlayerComponent', () => {
  let component: BioBallPlayerComponent;
  let fixture: ComponentFixture<BioBallPlayerComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ BioBallPlayerComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(BioBallPlayerComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
