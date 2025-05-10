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

    const hintEl = this.elementRef.nativeElement.querySelector(
      '.hint-tooltip'
    ) as HTMLElement;
    if (!hintEl) return;

    const targetRect = this.targetElement.getBoundingClientRect();
    const arrowEl = hintEl.querySelector('.hint-arrow') as HTMLElement;

    hintEl.style.position = 'fixed';
    // drop it below:
    const gap = 8;
    hintEl.style.top = `${targetRect.bottom + gap}px`;
    // left-align with the target

    if (window.innerWidth <= 600) {
      hintEl.style.left = '50%';
      hintEl.style.transform = 'translateX(-50%)';
      arrowEl.style.left = '50%';
    } else {
      hintEl.style.left = `${targetRect.left}px`;
    }
  }

  dismissHint() {
    this.hintService.dismissHint();
  }
}
