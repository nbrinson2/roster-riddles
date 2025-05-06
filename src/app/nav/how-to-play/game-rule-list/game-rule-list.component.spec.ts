import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameRuleListComponent } from './game-rule-list.component';

describe('GameRuleListComponent', () => {
  let component: GameRuleListComponent;
  let fixture: ComponentFixture<GameRuleListComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [GameRuleListComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameRuleListComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
