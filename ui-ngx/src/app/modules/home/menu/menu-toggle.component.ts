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

import { ChangeDetectionStrategy, Component, ElementRef, Input, ViewChild } from '@angular/core';
import { MenuSection } from '@core/services/menu.models';
import { Store } from '@ngrx/store';
import { AppState } from '@core/core.state';
import { ActionPreferencesUpdateOpenedMenuSection } from '@core/auth/auth.actions';
import { coerceBoolean } from '@shared/decorators/coercion';
import { TbPopoverDirective } from '@shared/components/popover.component';

@Component({
    selector: 'tb-menu-toggle',
    templateUrl: './menu-toggle.component.html',
    styleUrls: ['./menu-toggle.component.scss'],
    changeDetection: ChangeDetectionStrategy.OnPush,
    standalone: false
})
export class MenuToggleComponent {

  @Input() section: MenuSection;

  @Input()
  @coerceBoolean()
  collapsed = false;

  /**
   * AIRLINQ (AC-47): the live active-alarm count, forwarded to whichever CHILD row
   * carries `badge: 'alarmCount'`. Taken as an @Input rather than injecting
   * AlarmBadgeService here so there stays exactly ONE subscription owner
   * (`tb-side-menu`), matching how `collapsed` already flows down. Needed because
   * D4 moved `alarms` from a top-level link - where side-menu.component.html binds
   * `badgeCount` directly - to a child of the `alarms_center` toggle, and
   * menu-toggle.component.html previously passed NO badgeCount at all, which would
   * have silently dropped the badge.
   */
  @Input() alarmCount: number | null = null;

  /**
   * AIRLINQ (AC-47): true when this child row should show the alarm count. Data-driven
   * off `section.badge` - no template anywhere compares a MenuId.
   */
  childBadgeCount(page: MenuSection): number | null {
    return page.badge === 'alarmCount' ? this.alarmCount : null;
  }

  /**
   * AIRLINQ (Q3 / AC-47): '99+' cap for the FLYOUT row, which is a hand-rolled
   * <a mat-button> and therefore cannot reuse MenuLinkComponent.badgeLabel. Same rule,
   * same reason: AlarmBadgeService emits the raw unbounded PageData.totalElements and
   * four digits overflow the row. Presentation only - the uncapped number sits beside
   * it in a cdk-visually-hidden span.
   */
  badgeLabel(count: number | null): string {
    const n = count ?? 0;
    return n > 99 ? '99+' : String(n);
  }

  /**
   * AIRLINQ (AC-47, collapsed rail): the presence DOT on the group tile. The human
   * ruling is that the collapsed rail shows PRESENCE only, never digits - so this is
   * a boolean, not a count. True when any badged descendant is non-zero.
   */
  hasBadgedDescendant(): boolean {
    return (this.alarmCount ?? 0) > 0 &&
      !!this.section?.pages?.some(page => page.badge === 'alarmCount');
  }

  /**
   * AIRLINQ: the rail tile, so Escape in the flyout can return focus to it (AC-29c)
   * and so Enter/Space can tell the tile apart from the flyout rows (AC-29c).
   *
   * `read: ElementRef` is REQUIRED. The template ref sits on an `<a mat-button>`, and
   * `MatButton` is an exportable directive on that element, so a bare `@ViewChild`
   * resolves to the MatButton INSTANCE - whose `.nativeElement` is `undefined`. Every
   * comparison against it then silently failed, which is why Enter/Space did nothing.
   */
  @ViewChild('toggleTile', { static: false, read: ElementRef })
  toggleTile: ElementRef<HTMLElement>;

  constructor(private store: Store<AppState>) {
  }

  sectionHeight(): string {
    // AIRLINQ (AC-49): this is bound to [style.height], so it runs on EVERY
    // change-detection cycle. An unguarded `this.section.pages.length` therefore
    // throws continuously - not once - and because it sits in the shared
    // menuSections() pipeline it BLANKS THE ENTIRE SIDE MENU on the affected
    // route, not just this tile. A `toggle` reshaped into a pages-less `link`
    // (or any future section arriving without `pages`) is enough to trigger it.
    // Guarded with `?.` + `?? 0` so a missing/empty `pages` collapses the tile
    // to 0px instead of throwing. Mirrors the existing guard style in
    // router-tabs.component.ts:118.
    //
    // AIRLINQ (F3, round 1): the guard and the structural assertion are COMPLEMENTS,
    // not alternatives. This guard removes the throw that used to be the only symptom
    // of a pages-less or malformed toggle, so on its own it would turn a loud failure
    // into a silently wrong menu with a plausible-looking height. The compensating
    // check is `findNestedToggles()`, called from `buildUserMenu()`
    // (menu.models.ts) under `isDevMode()` on every login for every authority.
    if (this.section.opened && !this.collapsed) {
      return (this.section.pages?.length ?? 0) * 40 + 'px';
    } else {
      return '0px';
    }
  }

  toggleSection(event: MouseEvent) {
    event.stopPropagation();
    if (this.collapsed) {
      event.preventDefault();
    } else {
      this.section.opened = !this.section.opened;
      this.store.dispatch(new ActionPreferencesUpdateOpenedMenuSection({
        path: this.section.path,
        opened: this.section.opened
      }));
    }
  }

  /**
   * AIRLINQ: with trigger 'hover' the popover registers mouseenter/mouseleave and
   * never click, so the collapsed rail's click-to-open path is driven manually.
   * show()/hide() are idempotent and delayEnterLeave clears its own timer, so a
   * click while the hover popover is open closes it rather than re-opening it.
   */
  onTileClick(event: MouseEvent, popover: TbPopoverDirective) {
    if (!this.collapsed) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (popover?.component?.tbVisible) {
      popover.hide();
    } else {
      popover?.show();
    }
  }

  /**
   * AIRLINQ (AC-29c): the single keydown handler for the collapsed rail tile and its
   * flyout. Escape (from either) closes the flyout and returns focus to the tile.
   * Enter/Space open or close it from the tile only - the tile is an anchor with no
   * href, so it fires no synthetic click on Enter and none at all on Space. Expanded,
   * the section toggle keeps the native path and this handler does nothing.
   * Not a focus trap - Tab still leaves the flyout.
   */
  onTileKeydown(event: KeyboardEvent, popover: TbPopoverDirective) {
    if (!this.collapsed) {
      return;
    }
    const isOpen = !!popover?.component?.tbVisible;
    if (event.key === 'Escape' || event.key === 'Esc') {
      if (!isOpen) {
        return;
      }
      event.stopPropagation();
      popover.hide();
      this.toggleTile?.nativeElement?.focus();
      return;
    }
    if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
      return;
    }
    // Enter/Space only act on the tile itself; inside the flyout they must reach the
    // links. Compare against the event TARGET's owning tile rather than only
    // `currentTarget`, so a keypress landing on a child of the anchor (the icon or the
    // label span) still counts as the tile.
    const tile = this.toggleTile?.nativeElement;
    const target = event.target as HTMLElement;
    if (!tile || !(target === tile || tile.contains(target))) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (isOpen) {
      popover.hide();
    } else {
      popover?.show();
    }
  }

  toggleSectionActive(): boolean {
    if (this.collapsed) {
      return this.section.active;
    } else {
      return false;
    }
  }
}
