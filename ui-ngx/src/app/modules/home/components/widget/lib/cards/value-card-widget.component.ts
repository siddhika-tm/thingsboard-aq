///
/// Copyright © 2016-2026 The Thingsboard Authors
///
/// Licensed under the Apache License, Version 2.0 (the "License");
/// you may not use this file except in compliance with the License.
/// You may obtain a copy of the License at
///
///     http://www.apache.org/licenses/LICENSE-2.0
///
/// Unless required by applicable law or agreed to in writing, software
/// distributed under the License is distributed on an "AS IS" BASIS,
/// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
/// See the License for the specific language governing permissions and
/// limitations under the License.
///

import {
  AfterViewInit,
  ChangeDetectorRef,
  Component,
  ElementRef,
  Input,
  OnDestroy,
  OnInit,
  Renderer2,
  TemplateRef,
  ViewChild
} from '@angular/core';
import { WidgetContext } from '@home/models/widget-component.models';
import { isDefinedAndNotNull } from '@core/utils';
import {
  backgroundStyle,
  ColorProcessor,
  ComponentStyle,
  createValueFormatterFromSettings,
  DateFormatProcessor,
  getLabel,
  getSingleTsValue,
  iconStyle,
  overlayStyle,
  resolveCssSize,
  textStyle,
  ValueFormatProcessor
} from '@shared/models/widget-settings.models';
import { valueCardDefaultSettings, ValueCardLayout, ValueCardWidgetSettings } from './value-card-widget.models';
import { WidgetComponent } from '@home/components/widget/widget.component';
import { Observable } from 'rxjs';
import { ImagePipe } from '@shared/pipe/image.pipe';
import { DomSanitizer } from '@angular/platform-browser';

const squareLayoutSize = 160;
const horizontalLayoutHeight = 80;
// AIRLINQ (D5, AC-50): floor for the autoScale factor.
//
// `autoScale` shrinks tile text with `transform: scale()`, not with font-size, so the
// declared size is multiplied by this factor before it is painted and a CSS
// `min-font-size` cannot rescue it. Unfloored, `scale` falls with the panel without
// limit, so a small tile paints text at an illegible fraction of its declared size.
//
// 0.70 is the nearest round value above the 0.6875 minimum that a 16px stored label
// needs to paint at 11px (11/16 = 0.6875), pairing this floor with the stored
// label 16px / context 18px that D5 writes to the dashboard.
//
// Cost, stated explicitly. The floor is applied in BOTH branches of onResize(), and
// the two branches have DIFFERENT geometry, so there are TWO clip-onset thresholds
// (F4, round 1 - only the square one was documented before):
//
//   SQUARE branch. Below
//       min(panelW, panelH) = squareLayoutSize * autoScaleMin = 160 * 0.70 = 112px
//   the 160px content box no longer fits its panel and overflows instead of
//   shrinking further.
//
//   HORIZONTAL branch. Content HEIGHT is `horizontalLayoutHeight * scale`, floored at
//   80 * 0.70 = 56px, while the panel can be shorter than that. Because `aspect` is
//   capped at 0.25, targetHeight = min(panelH, 0.25 * panelW), so the onset has two
//   forms:
//       panelH < 56px    (the panel-height term binds), or
//       panelW < 224px   (the 0.25 aspect cap binds: 56 / 0.25 = 224)
//   Measured vertical overflow, panel WxH -> overflow:
//       300x50 -> 6px    240x40 -> 16px    200x30 -> 26px
//   There is NO horizontal WIDTH defect: `width = targetWidth / scale` stays an exact
//   inverse of the transform under the floor, so the content box's painted width
//   still equals panelWidth at any scale.
//
// Both thresholds are the deliberate trade - text too small to read is not a usable
// rendering either - and the reasoning the human accepted for the square branch
// applies to the horizontal one. Kept in BOTH branches rather than square-only,
// because a horizontal value card left unfloored would keep exactly the AC-50
// illegibility defect this floor exists to fix. See
// docs/design/d5-autoscale-floor-rationale.md.
const autoScaleMin = 0.70;

@Component({
    selector: 'tb-value-card-widget',
    templateUrl: './value-card-widget.component.html',
    styleUrls: ['./value-card-widget.component.scss'],
    standalone: false
})
export class ValueCardWidgetComponent implements OnInit, AfterViewInit, OnDestroy {

  @ViewChild('valueCardPanel', {static: false})
  valueCardPanel: ElementRef<HTMLElement>;

  @ViewChild('valueCardContent', {static: false})
  valueCardContent: ElementRef<HTMLElement>;

  settings: ValueCardWidgetSettings;

  valueCardLayout = ValueCardLayout;

  @Input()
  ctx: WidgetContext;

  @Input()
  widgetTitlePanel: TemplateRef<any>;

  layout: ValueCardLayout;
  showIcon = true;
  icon = '';
  iconStyle: ComponentStyle = {};
  iconColor: ColorProcessor;

  showLabel = true;
  label$: Observable<string>;
  labelStyle: ComponentStyle = {};
  labelColor: ColorProcessor;

  valueText = 'N/A';
  valueStyle: ComponentStyle = {};
  valueColor: ColorProcessor;

  showDate = true;
  dateFormat: DateFormatProcessor;
  dateStyle: ComponentStyle = {};
  dateColor: ColorProcessor;

  backgroundStyle$: Observable<ComponentStyle>;
  overlayStyle: ComponentStyle = {};
  padding: string;

  private panelResize$: ResizeObserver;

  private horizontal = false;
  private valueFormat: ValueFormatProcessor;

  constructor(private imagePipe: ImagePipe,
              private sanitizer: DomSanitizer,
              private renderer: Renderer2,
              private widgetComponent: WidgetComponent,
              private cd: ChangeDetectorRef) {
  }

  ngOnInit(): void {
    const params = this.widgetComponent.typeParameters as any;
    this.horizontal  = isDefinedAndNotNull(params.horizontal) ? params.horizontal : false;
    this.ctx.$scope.valueCardWidget = this;
    this.settings = {...valueCardDefaultSettings(this.horizontal), ...this.ctx.settings};

    this.valueFormat = createValueFormatterFromSettings(this.ctx);

    this.layout = this.settings.layout;

    this.showIcon = this.settings.showIcon;
    this.icon = this.settings.icon;
    this.iconStyle = iconStyle(this.settings.iconSize, this.settings.iconSizeUnit );
    this.iconColor = ColorProcessor.fromSettings(this.settings.iconColor);

    this.showLabel = this.settings.showLabel;
    const label = getLabel(this.ctx.datasources);
    this.label$ = this.ctx.registerLabelPattern(label, this.label$);
    this.labelStyle = textStyle(this.settings.labelFont);
    this.labelColor =  ColorProcessor.fromSettings(this.settings.labelColor);
    this.valueStyle = textStyle(this.settings.valueFont);
    this.valueColor = ColorProcessor.fromSettings(this.settings.valueColor);

    this.showDate = this.settings.showDate;
    this.dateFormat = DateFormatProcessor.fromSettings(this.ctx.$injector, this.settings.dateFormat);
    this.dateStyle = textStyle(this.settings.dateFont);
    this.dateColor = ColorProcessor.fromSettings(this.settings.dateColor);

    this.backgroundStyle$ = backgroundStyle(this.settings.background, this.imagePipe, this.sanitizer);
    this.overlayStyle = overlayStyle(this.settings.background.overlay);
    this.padding = this.settings.background.overlay.enabled ? undefined : this.settings.padding;
  }

  public ngAfterViewInit() {
    if (this.settings.autoScale) {
      if (!this.horizontal) {
        this.renderer.setStyle(this.valueCardContent.nativeElement, 'width', squareLayoutSize + 'px');
      }
      const height = this.horizontal ? horizontalLayoutHeight : squareLayoutSize;
      this.renderer.setStyle(this.valueCardContent.nativeElement, 'height', height + 'px');
      this.renderer.setStyle(this.valueCardContent.nativeElement, 'overflow', 'visible');
      this.renderer.setStyle(this.valueCardContent.nativeElement, 'position', 'absolute');
      this.panelResize$ = new ResizeObserver(() => {
        this.onResize();
      });
      this.panelResize$.observe(this.valueCardPanel.nativeElement);
      this.onResize();
    }
  }

  ngOnDestroy() {
    if (this.panelResize$) {
      this.panelResize$.disconnect();
    }
  }

  public onInit() {
    const borderRadius = this.ctx.$widgetElement.css('borderRadius');
    this.overlayStyle = {...this.overlayStyle, ...{borderRadius}};
    this.cd.detectChanges();
  }

  public onDataUpdated() {
    const tsValue = getSingleTsValue(this.ctx.data);
    let ts;
    let value;
    if (tsValue && isDefinedAndNotNull(tsValue[1]) && tsValue[0] !== 0) {
      ts = tsValue[0];
      value = tsValue[1];
      this.valueText = this.valueFormat.format(value);
    } else {
      this.valueText = 'N/A';
    }
    this.dateFormat.update(ts);
    this.iconColor.update(value);
    this.labelColor.update(value);
    this.valueColor.update(value);
    this.dateColor.update(value);
    this.cd.detectChanges();
  }

  private onResize() {
    const computedStyle = getComputedStyle(this.valueCardPanel.nativeElement);
    const [pLeft, pRight, pTop, pBottom] = ['paddingLeft', 'paddingRight', 'paddingTop', 'paddingBottom']
      .map(side => resolveCssSize(computedStyle[side])[0]);

    const widgetBoundingClientRect = this.valueCardPanel.nativeElement.getBoundingClientRect();
    const panelWidth = widgetBoundingClientRect.width - (pLeft + pRight);
    const panelHeight = widgetBoundingClientRect.height - (pTop + pBottom);
    let scale: number;
    if (!this.horizontal) {
      const size = Math.min(panelWidth, panelHeight);
      scale = Math.max(size / squareLayoutSize, autoScaleMin);
    } else {
      const targetWidth = panelWidth;
      const aspect = Math.min(panelHeight / targetWidth, 0.25);
      const targetHeight = targetWidth * aspect;
      scale = Math.max(targetHeight / horizontalLayoutHeight, autoScaleMin);
      const width = targetWidth / scale;
      this.renderer.setStyle(this.valueCardContent.nativeElement, 'width', width + 'px');
    }
    this.renderer.setStyle(this.valueCardContent.nativeElement, 'transform', `scale(${scale})`);
  }
}
