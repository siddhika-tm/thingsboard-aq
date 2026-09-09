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

import { ChangeDetectionStrategy, Component, Input } from '@angular/core';
import { MenuSection } from '@core/services/menu.models';
import { coerceBoolean } from '@shared/decorators/coercion';

@Component({
    selector: 'tb-menu-link',
    templateUrl: './menu-link.component.html',
    styleUrls: ['./menu-link.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class MenuLinkComponent {

  @Input() section: MenuSection;

  @Input()
  @coerceBoolean()
  collapsed = false;

  /** AIRLINQ: live count rendered as a badge (expanded) or a dot (collapsed). */
  @Input() badgeCount: number | null = null;

  constructor() {
  }

  /**
   * AIRLINQ (Q3 / AC-47): the rendered badge text, capped at '99+'. AlarmBadgeService
   * emits the raw PageData.totalElements, which is unbounded - a busy tenant with 1200
   * active alarms would paint four digits into a 40px row and overflow the rail. The
   * cap is PRESENTATION ONLY: the template keeps the uncapped number in the
   * `cdk-visually-hidden` span, so assistive tech still reports the exact count.
   * Lives here rather than in menu-toggle because this is the component that renders
   * the digits - both the top-level row and the nested row go through it.
   */
  get badgeLabel(): string {
    const n = this.badgeCount ?? 0;
    return n > 99 ? '99+' : String(n);
  }

}
