import { ComponentFixture, TestBed } from '@angular/core/testing';

import { AttributeHeaderComponent } from './attribute-header.component';

describe('AttributeHeaderComponent', () => {
  let component: AttributeHeaderComponent;
  let fixture: ComponentFixture<AttributeHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ AttributeHeaderComponent ]
    })
    .compileComponents();

    fixture = TestBed.createComponent(AttributeHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
