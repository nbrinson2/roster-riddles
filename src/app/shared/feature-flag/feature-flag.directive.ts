// src/app/feature-flags/feature-flag.directive.ts
import { Directive, Input, TemplateRef, ViewContainerRef } from '@angular/core';
import { take } from 'rxjs/operators';
import { FeatureFlagService, FlagKey } from './feature-flag.service';

@Directive({ selector: '[featureFlag]', standalone: false })
export class FeatureFlagDirective {
  private elseTpl: TemplateRef<any> | null = null;
  private flagKey!: FlagKey;

  @Input('featureFlag') set featureFlag(key: FlagKey) {
    this.flagKey = key;
    this.updateView();
  }

  @Input('featureFlagElse') set featureFlagElse(
    templateRef: TemplateRef<any> | null
  ) {
    this.elseTpl = templateRef;
    this.updateView();
  }

  constructor(
    private tpl: TemplateRef<any>,
    private vc: ViewContainerRef,
    private ffService: FeatureFlagService
  ) {}

  private updateView() {
    // clear out whatever was there before
    this.vc.clear();

    // check the flag once
    this.ffService
      .isEnabled(this.flagKey)
      .pipe(take(1))
      .subscribe((enabled) => {
        if (enabled) {
          this.vc.createEmbeddedView(this.tpl);
        } else if (this.elseTpl) {
          this.vc.createEmbeddedView(this.elseTpl);
        }
      });
  }
}
