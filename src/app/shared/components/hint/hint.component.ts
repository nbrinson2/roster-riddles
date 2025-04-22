import { Component, OnInit, Input, ElementRef, AfterViewInit, computed } from '@angular/core';
import { HintService, HintType } from './hint.service';

export enum HintArrowPosition {
  BOTTOM = 'bottom',
  TOP_LEFT = 'top-left'
}

@Component({
  selector: 'hint',
  templateUrl: './hint.component.html',
  styleUrls: ['./hint.component.scss'],
})
export class HintComponent implements OnInit, AfterViewInit {
  @Input() targetElement!: HTMLElement;
  @Input() hintType!: HintType;
  @Input() arrowPosition: HintArrowPosition = HintArrowPosition.BOTTOM;

  hintShown = computed(() => this.hintService.currentHint()?.shown);
  
  constructor(
    public hintService: HintService,
    private elementRef: ElementRef
  ) {}

  ngOnInit() {
    // Show the specified hint after a short delay
    setTimeout(() => {
      this.hintService.showHint(this.hintType);
    }, 500);
  }

  ngAfterViewInit() {
    // Wait for the next tick to ensure the hint content is rendered
    setTimeout(() => this.positionHint(), 0);
  }

  
  private positionHint() {
    if (!this.targetElement) return;

    const targetRect = this.targetElement.getBoundingClientRect();
    const hintElement = this.elementRef.nativeElement.querySelector('.hint-tooltip');
    
    if (hintElement) {
      // Position the hint above the first row
      const hintRect = hintElement.getBoundingClientRect();
      hintElement.style.position = 'fixed';
      hintElement.style.top = `${targetRect.top}px`;
      hintElement.style.left = `${targetRect.left + (targetRect.width / 2)}px`;
    }
  }

  dismissHint() {
    this.hintService.resetHints();
  }
}