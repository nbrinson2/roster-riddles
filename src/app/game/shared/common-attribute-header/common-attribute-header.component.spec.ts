import { ComponentFixture, TestBed } from '@angular/core/testing';

import { CommonAttributeHeaderComponent } from './common-attribute-header.component';

describe('CommonAttributeHeaderComponent', () => {
  let component: CommonAttributeHeaderComponent;
  let fixture: ComponentFixture<CommonAttributeHeaderComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [CommonAttributeHeaderComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(CommonAttributeHeaderComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
