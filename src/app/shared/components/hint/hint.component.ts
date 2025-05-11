import {
  AfterViewInit,
  Component,
  computed,
  ElementRef,
  Input,
} from '@angular/core';
import { HintService, HintType } from './hint.service';

export enum HintArrowPosition {
  BOTTOM = 'bottom',
  TOP_LEFT = 'top-left',
}

@Component({
  selector: 'hint',
  templateUrl: './hint.component.html',
  styleUrls: ['./hint.component.scss'],
  standalone: false,
})
export class HintComponent implements AfterViewInit {
  @Input() targetElement!: HTMLElement;
  @Input() hintType!: HintType;
  @Input() arrowPosition: HintArrowPosition = HintArrowPosition.BOTTOM;

  constructor(
    public hintService: HintService,
    private elementRef: ElementRef
  ) {}

  ngAfterViewInit(): void {
    // Wait for the next tick to ensure the hint content is rendered
    setTimeout(() => this.positionHint(), 0);
  }

  private positionHint() {
    if (!this.targetElement) return;

    const targetRect = this.targetElement.getBoundingClientRect();
    const hintElement =
      this.elementRef.nativeElement.querySelector('.hint-tooltip');
    const arrowElement =
      this.elementRef.nativeElement.querySelector('.hint-arrow');

    if (!hintElement) return;

    if (window.innerWidth - targetRect.left < 300) {
      hintElement.style.left = '50%';
      hintElement.style.transform = 'translateX(-50%)';
      arrowElement.style.left = `${targetRect.left - 30}px`;
    } else if (targetRect.left < 0) {
      hintElement.style.position = 'fixed';
      hintElement.style.left = '10px';
    } else {
      hintElement.style.position = 'fixed';
      // drop it below:
      // left-align with the target
      hintElement.style.left = `${targetRect.left}px`;
    }
    const gap = 8;
    hintElement.style.top = `${targetRect.bottom + gap}px`;
}

  dismissHint() {
    this.hintService.dismissHint();
  }
}
