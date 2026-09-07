# Left menu (Option A · Sectioned) + favicon — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: use `superpowers:subagent-driven-development`
> (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the accordion left menu with the approved sectioned design in both themes — every
page one click away under four section headings, a live alarm badge, and a rail whose hover flyouts
survive the pointer crossing the gap — and verify the already-fixed favicon.

**Architecture:** Four units in dependency order. The **menu model** gains a `'section'` type and a
reshaped TENANT_ADMIN tree (this is the headline change and it lands first, because everything else
renders against it). A **shared alarm-count service** polls one endpoint every 60 s and feeds both the
expanded badge and the rail dot. The **rail flyout** reuses the existing `tb-popover`, whose
hover-bridge already exists, with a corrected close delay. **Visual treatment** lands last, in the
stylesheet layer that already owns each declaration.

**Tech stack:** Angular 20 (standalone: false, `OnPush`), RxJS, Angular Material / MDC, SCSS with
`--aq-*` CSS custom properties, ngx-translate, CDK overlay via `tb-popover`.

---

## Global Constraints

Copied verbatim from the design doc and requirement. **Every task's requirements implicitly include
this section.**

- **Design doc:** `docs/design/left-menu-and-favicon.md`. **Requirement:**
  `docs/requirements/left-menu-and-favicon.md`. **ADR:** `docs/adr/0003-sectioned-menu-model.md`.
- **Colours come only from `--aq-*` tokens.** No hex or `rgba()` outside the token-definition blocks
  in `styles.scss` (`:1428` light, `:1478` dark). None in any `.ts` or `.html`.
- **No `color-mix()` may reach built CSS.** Browserslist is Chrome ≥107 / FF ≥104 / Safari ≥16;
  `color-mix` needs 111/113/16.2 and is **silently dropped**.
- **New tokens: none expected.** If one proves necessary it goes into **both** token blocks.
- **D2:** Edge management sits under Operations, immediately after Resources.
- **D3:** the rail-tile hover "lift" is real (transform + shadow), not background+colour only.
- **D4:** brand-mark hex `#3e7bff` / `#37b6c9` and the flyout shadow `0 8px 24px rgba(0,0,0,.25)`
  stay as-is, untokenised.
- **D5:** alarm count comes from the existing alarm endpoint, polled every **60 s**, a **SINGLE**
  shared request. **No websocket.** The demo server is a single small VM — do not add load.
- **Option B (accordion) is NOT implemented.** Its markup (`Main.dc.html` lines 89–117) and its CSS
  (`.sub`, `.sub::before`, `.sub.on`, `.sub.on::after`, `.divider`) are excluded. This does **not**
  delete the existing Device profiles / Asset profiles / OTA updates *menu entries*, which are live
  pages and must keep working.
- **`menuFilters` is never edited.** Not one line.
- **ADR 0002 rules apply to all new markup:** no entity-derived value in generated markup, no
  `style=""`, nothing through `bypassSecurityTrustHtml`.
- **Every new file carries the Apache licence header** (15–17 lines; truncating it in an HTML
  template produces a confusing `NG5002: Unexpected character "EOF"`).
- **Never run `mvn license:format` blindly** — it would corrupt the `.dc.html` canvas spec files.
- **Do not touch** `docs/design/2026-09-06-left-menu-canvas/` (immutable spec) or the existing
  uncommitted working-tree changes (favicon, memory, requirement docs, `.gitignore`).
- **Do not change pinned dependency or toolchain versions.**
- **Modify files in place.** No `.new` / `.v2` copies.

### Toolchain (both tools ARE present — a bare `which mvn` misleadingly reports missing)

```bash
export JAVA_HOME=/d/tmp/tools/jdk-25.0.4.1+1
export PATH="$JAVA_HOME/bin:/d/tmp/tools/apache-maven-3.9.9/bin:$PATH"
```

### Verify commands

```bash
# Build
mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true

# Lint — gate is ALREADY RED on a pristine tree (569 problems / 462 errors / 107 warnings).
# The bar is ZERO NEW problems (AC-34). Only the delta is meaningful.
cd ui-ngx && NODE_OPTIONS=--max-old-space-size=8192 yarn lint

# UI verification: local `yarn start`, Edge (channel:'msedge'), 1600×1000, BOTH themes.
```

### How UI criteria are verified (non-negotiable — this is where two earlier rounds failed)

- Assert `getComputedStyle(el).<prop>`, **on the element that carries the declaration**.
- Prove any specificity diagnosis by **injection**, never by reading the stylesheet. A rule can be
  present, correct, dual-scoped and `!important` and still never apply.
- Structural proof is not visual proof. Only a browser confirms a menu renders.
- Dark theme: `localStorage['tb-theme'] = 'dark'`, then reload.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `ui-ngx/src/app/core/services/menu.models.ts` | `'section'` type, 4 heading ids + definitions, reshaped TENANT_ADMIN tree, `badge` field | 1, 2 |
| `ui-ngx/src/app/modules/home/menu/side-menu.component.html` | 4th `@switch` arm; section grouping; badge wiring | 1, 5 |
| `ui-ngx/src/app/modules/home/menu/side-menu.component.{ts,scss}` | badge stream; heading + row geometry | 5, 6 |
| `ui-ngx/src/app/modules/home/menu/menu-link.component.{ts,html,scss}` | `badgeCount` input; badge + rail dot markup and style | 5, 6 |
| `ui-ngx/src/app/modules/home/menu/menu-toggle.component.{ts,html,scss}` | flyout delay, click handler, ARIA, flyout styling | 4, 7 |
| `ui-ngx/src/app/core/services/alarm-badge.service.ts` | **new** — single shared 60 s poll | 5 |
| `ui-ngx/src/app/shared/components/user-menu.component.{html,scss}` | foot user block: avatar initials, name/role, overflow control | 8 |
| `ui-ngx/src/styles.scss` | Shell-C block: row colour, tile lift | 6, 7 |
| `ui-ngx/src/assets/locale/locale.constant-en_US.json` | 2 new keys | 1 |

**Ordering rationale.** Task 1–2 are the model (highest risk, fails fast, and produces the single
biggest visible change: headings appear and pages stop hiding behind accordions). Task 3 is the
permission proof, run immediately after the reshape while it is cheap to fix. Tasks 4–5 add the
flyout fix and the badge — both visible. Tasks 6–8 are polish. Task 9 is the favicon (verification
only). Task 10 is the gate sweep.

---

## Task 1: The `'section'` type renders

**Files:**
- Modify: `ui-ngx/src/app/core/services/menu.models.ts:21` (union), `:110` area (enum), `:122+` (map)
- Modify: `ui-ngx/src/app/modules/home/menu/side-menu.component.html:21-31`
- Modify: `ui-ngx/src/assets/locale/locale.constant-en_US.json`

**Interfaces:**
- Produces: `MenuSectionType` including `'section'`; `MenuId.monitor_label`,
  `MenuId.devices_assets_label`, `MenuId.operations_label`, `MenuId.administration_label`; CSS hook
  class `tb-menu-section` on the rendered heading element.
- Consumes: nothing.

- [ ] **Step 1: Add `'section'` to the type union**

`menu.models.ts:21`:

```ts
export declare type MenuSectionType = 'link' | 'toggle' | 'divider' | 'section';
```

- [ ] **Step 2: Add the four heading ids to the `MenuId` enum**

In the `MenuId` enum (before `divider = 'divider'`):

```ts
  monitor_label = 'monitor_label',
  devices_assets_label = 'devices_assets_label',
  operations_label = 'operations_label',
  administration_label = 'administration_label',
```

- [ ] **Step 3: Add the four heading definitions to `menuSectionMap`**

Append these entries to the `menuSectionMap` array (order within the map is irrelevant — it is a
dictionary):

```ts
  [
    MenuId.monitor_label,
    {
      id: MenuId.monitor_label,
      name: 'monitor.monitor',
      type: 'section',
      path: '',
      icon: null
    }
  ],
  [
    MenuId.devices_assets_label,
    {
      id: MenuId.devices_assets_label,
      name: 'entity.devices-and-assets',
      type: 'section',
      path: '',
      icon: null
    }
  ],
  [
    MenuId.operations_label,
    {
      id: MenuId.operations_label,
      name: 'admin.operations',
      type: 'section',
      path: '',
      icon: null
    }
  ],
  [
    MenuId.administration_label,
    {
      id: MenuId.administration_label,
      name: 'admin.administration',
      type: 'section',
      path: '',
      icon: null
    }
  ],
```

`monitor.monitor` ("Monitor") and `entity.devices-and-assets` ("Devices & assets") already exist and
are reused verbatim.

- [ ] **Step 4: Add the two new translation keys**

In `ui-ngx/src/assets/locale/locale.constant-en_US.json`, inside the existing `"admin"` object, add
(keeping the object's alphabetical ordering where it already holds):

```json
        "administration": "Administration",
        "operations": "Operations",
```

Only `locale.constant-en_US.json` is edited — the other 27 locales fall back to en_US.

- [ ] **Step 5: Add the `@switch` arm**

`side-menu.component.html`, inside the existing `@switch (section.type)` block, after the `'link'`
case:

```html
        @case ('section') {
          <div class="tb-menu-section" role="presentation">
            {{ section.customTranslate ? (section.name | customTranslate) : (section.name | translate) }}
          </div>
        }
```

A type with no arm renders **nothing, silently**. This step must land with Step 1.

- [ ] **Step 6: Temporarily insert one heading to prove it renders**

In `defaultUserMenuMap`, in the **TENANT_ADMIN** array only, insert `{id: MenuId.monitor_label},`
immediately before the `{id: MenuId.monitor, …}` entry. This is a throwaway probe replaced wholesale
in Task 2.

- [ ] **Step 7: Verify it renders in the browser**

```bash
cd ui-ngx && yarn start
```

Sign in as the tenant admin, open the expanded menu.
Expected: the word **Monitor** appears as a plain text row above the Monitor group. It is not
clickable and Tab skips it.

If nothing appears, the `@switch` arm is not matching — check the case string is exactly `'section'`.

- [ ] **Step 8: Commit**

```bash
git add ui-ngx/src/app/core/services/menu.models.ts \
        ui-ngx/src/app/modules/home/menu/side-menu.component.html \
        ui-ngx/src/assets/locale/locale.constant-en_US.json
git commit -m "feat(menu): add a section-heading type to the menu model"
```

---

## Task 2: Reshape the TENANT_ADMIN tree (the headline change)

**Files:**
- Modify: `ui-ngx/src/app/core/services/menu.models.ts:932-1034` (the TENANT_ADMIN array)

**Interfaces:**
- Consumes: `MenuId.*_label` from Task 1.
- Produces: the row shape every later task renders against.

- [ ] **Step 1: Capture the BEFORE row set (do this before editing anything)**

With the app running, signed in as **tenant admin**, in the browser console:

```js
copy(JSON.stringify([...document.querySelectorAll('.tb-side-menu a.mat-mdc-button')]
  .map(a => [a.textContent.trim(), a.getAttribute('href')])));
```

Save to `/d/tmp/menu-before-tenant.json`. Repeat signed in as **customer user** →
`/d/tmp/menu-before-customer.json`, and **sysadmin** → `/d/tmp/menu-before-sysadmin.json`.
Expand every accordion first, so buried rows are captured.

**This step cannot be skipped.** Without it AC-36 is unprovable.

- [ ] **Step 2: Replace the TENANT_ADMIN reference array**

Replace the whole `Authority.TENANT_ADMIN` array in `defaultUserMenuMap` with:

```ts
  [
    Authority.TENANT_ADMIN,
    [
      {id: MenuId.home},
      {id: MenuId.iot_hub},
      {id: MenuId.monitor_label},
      {id: MenuId.dashboards},
      {id: MenuId.alarms},
      {
        id: MenuId.notifications_center,
        pages: [
          {id: MenuId.notification_inbox},
          {id: MenuId.notification_sent},
          {id: MenuId.notification_recipients},
          {id: MenuId.notification_templates},
          {id: MenuId.notification_rules}
        ]
      },
      {id: MenuId.devices_assets_label},
      {id: MenuId.devices},
      {id: MenuId.gateways},
      {id: MenuId.assets},
      {id: MenuId.entity_views},
      {id: MenuId.otaUpdates},
      {
        id: MenuId.profiles,
        pages: [
          {id: MenuId.device_profiles},
          {id: MenuId.asset_profiles}
        ]
      },
      {id: MenuId.operations_label},
      {id: MenuId.customers_and_users},
      {
        id: MenuId.data_processing,
        pages: [
          {id: MenuId.calculated_fields},
          {id: MenuId.rule_chains}
        ]
      },
      {
        id: MenuId.resources,
        pages: [
          {
            id: MenuId.widget_library,
            pages: [
              {id: MenuId.widget_types},
              {id: MenuId.widgets_bundles}
            ]
          },
          {id: MenuId.images},
          {id: MenuId.scada_symbols},
          {id: MenuId.javascript_library},
          {id: MenuId.resources_library}
        ]
      },
      {
        id: MenuId.edge_management,
        pages: [
          {id: MenuId.edges},
          {id: MenuId.rulechain_templates}
        ]
      },
      {id: MenuId.administration_label},
      {
        id: MenuId.security_settings,
        pages: [
          {
            id: MenuId.oauth2,
            pages: [
              {id: MenuId.clients}
            ]
          },
          {id: MenuId.audit_log}
        ]
      },
      {
        id: MenuId.platform_section,
        pages: [
          {id: MenuId.version_control},
          {
            id: MenuId.settings,
            pages: [
              {id: MenuId.home_settings},
              {id: MenuId.notification_settings},
              {id: MenuId.repository_settings},
              {id: MenuId.auto_commit_settings},
              {id: MenuId.trendz_settings},
              {id: MenuId.ai_models}
            ]
          },
          {id: MenuId.api_usage}
        ]
      },
      {
        id: MenuId.mobile_center,
        pages: [
          {id: MenuId.mobile_bundles},
          {id: MenuId.mobile_apps}
        ]
      }
    ]
  ],
```

Points that are deliberate and must not be "tidied":

- `alarms_center` (a toggle over Alarms + Alarm rules) is replaced by a direct `{id: MenuId.alarms}`
  link — this is the one-click requirement. **`alarm_rules` is intentionally retained** as a page:
  see Step 3.
- `mobile_center` **keeps its `toggle` shape and stays last**. All its children are
  `unavailableOffline`, so `filterMenuReference()` hides the whole group. Flattening it would create
  dead rows.
- `edge_management` stays a **toggle** under Operations after Resources (D2) — it is gated on
  `edgesSupportEnabled` and flattening would lose that gating.
- `iot_hub` stays (it is filtered off on this deployment, so it renders nothing) and the
  `{id: MenuId.divider}` after it is dropped, since headings now provide the separation.

- [ ] **Step 3: Re-home `alarm_rules` so no page is lost**

The old `alarms_center` toggle carried two pages: `alarms` and `alarm_rules`. Promoting only `alarms`
would drop `alarm_rules` and fail AC-36. Change `MenuId.alarms` from a plain link into a two-page
toggle **only if** the BEFORE capture shows `alarm_rules` visible on this deployment; otherwise add it
as a sibling link under Monitor.

Preferred shape (keeps Alarms one click away and Alarm rules reachable):

```ts
      {id: MenuId.alarms},
      {id: MenuId.alarm_rules},
```

Both become plain rows under the Monitor heading. This is consistent with "every page one click
away" and is why the canvas's Monitor section has no chevron.

> If the BEFORE capture shows `alarm_rules` was **not** visible for this authority, omit it — match
> the capture, not the upstream literal.

- [ ] **Step 4: Add headings to the CUSTOMER_USER tree (headings only — do not move rows)**

Replace the `Authority.CUSTOMER_USER` array with the same rows in the same order, headings inserted:

```ts
  [
    Authority.CUSTOMER_USER,
    [
      {id: MenuId.home},
      {id: MenuId.monitor_label},
      {id: MenuId.dashboards},
      {id: MenuId.alarms},
      {id: MenuId.notification_inbox},
      {id: MenuId.devices_assets_label},
      {id: MenuId.devices},
      {id: MenuId.assets},
      {id: MenuId.entity_views},
      {id: MenuId.edge_instances}
    ]
  ]
```

The row **membership is identical** to today's customer tree — Dashboards, Alarms, Notification
inbox, Devices, Assets, Entity views, Edge instances — with the two accordions flattened. No page is
added and none removed. This is the case AC-36 cares about most.

- [ ] **Step 5: Leave the SYS_ADMIN tree alone**

Do not edit it in this task. It is a different set of groups, it is not in the canvas, and changing
it adds risk with no acceptance criterion behind it.

- [ ] **Step 6: Build**

```bash
export JAVA_HOME=/d/tmp/tools/jdk-25.0.4.1+1
export PATH="$JAVA_HOME/bin:/d/tmp/tools/apache-maven-3.9.9/bin:$PATH"
mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true
```

Expected: BUILD SUCCESS. A TS error here means an id was mistyped — the enum is the source of truth.

- [ ] **Step 7: Verify visually**

Reload the tenant-admin menu. Expected: four headings (Monitor, Devices & assets, Operations,
Administration); Home above the first heading with no heading of its own; Dashboards / Alarms /
Notifications reachable **without expanding anything**; chevrons on Profiles, Data processing,
Resources, Security, Platform (and Edge management), and on nothing else.

- [ ] **Step 8: Commit**

```bash
git add ui-ngx/src/app/core/services/menu.models.ts
git commit -m "feat(menu): reshape the tenant menu into sections with one-click pages"
```

---

## Task 3: Prove permissions and routes are unchanged (AC-36)

**Files:** none modified — this task is a gate.

**Interfaces:**
- Consumes: the BEFORE captures from Task 2 Step 1.

- [ ] **Step 1: Capture the AFTER row set for all three authorities**

Same console snippet as Task 2 Step 1, expanding every accordion. Save to
`/d/tmp/menu-after-{tenant,customer,sysadmin}.json`.

- [ ] **Step 2: Diff as SETS, not as sequences**

```bash
cd /d/tmp
for r in tenant customer sysadmin; do
  echo "=== $r ==="
  python -c "
import json,sys
b=set(map(tuple,json.load(open('menu-before-$r.json'))))
a=set(map(tuple,json.load(open('menu-after-$r.json'))))
print('LOST   :', sorted(b-a))
print('GAINED :', sorted(a-b))
"
done
```

Expected: `LOST: []` and `GAINED: []` for **all three** authorities.

- [ ] **Step 3: Interpret failures — do not "fix" by adding rows blindly**

- Something in `LOST` → a page was dropped by the reshape. Restore it in the correct section.
- Something in `GAINED` → almost certainly the cascade hazard: a group whose children were all
  filtered has been flattened into visible dead rows. Re-nest it under its filtered parent.
- `sysadmin` must be **empty on both sides of the diff** — its tree was not edited (Task 2 Step 5).
  Any change there means a `menuSectionMap` *definition* was edited instead of a *reference tree*.

- [ ] **Step 4: Spot-check the customer user by hand**

Sign in as the customer user and click every row. Each must land on the same page it did before.
Confirm no administration, profile, resource, rule-chain or settings row is visible.

- [ ] **Step 5: Commit the evidence**

```bash
mkdir -p .claude/team/artifacts/left-menu-and-favicon/run-1
cp /d/tmp/menu-{before,after}-*.json .claude/team/artifacts/left-menu-and-favicon/run-1/
git add .claude/team/artifacts/left-menu-and-favicon/run-1
git commit -m "test(menu): record before/after menu row sets for all three authorities"
```

---

## Task 4: Fix the rail flyout so it survives the gap (D1, AC-29)

**Files:**
- Modify: `ui-ngx/src/app/modules/home/menu/menu-toggle.component.html:18-31`
- Modify: `ui-ngx/src/app/modules/home/menu/menu-toggle.component.ts`

**Interfaces:**
- Produces: `onTileClick(event, popover)` on `MenuToggleComponent`.

- [ ] **Step 1: Raise the close delay to ~300 ms**

`menu-toggle.component.html:26` — the value is in **seconds** (`delayEnterLeave()` multiplies by
1000), so 300 ms is `0.3`:

```html
   [tbPopoverMouseEnterDelay]="0.1"
   [tbPopoverMouseLeaveDelay]="0.3"
```

The hover bridge across the 20 px gap already exists — `popover.component.ts:198-208` attaches
`mouseenter`/`mouseleave` to the overlay element as well as the trigger. Nothing is written for it;
it is verified in Step 4.

- [ ] **Step 2: Add ARIA to the trigger**

On the same `<a>` element:

```html
   role="button"
   [attr.aria-haspopup]="collapsed ? 'menu' : null"
   [attr.aria-expanded]="collapsed ? (menuPopover?.component?.tbVisible ? 'true' : 'false') : null"
   [attr.aria-label]="collapsed ? (section.customTranslate ? (section.name | customTranslate) : (section.name | translate)) : null"
```

and `role="menu"` on the flyout container in `#menuToggleMenuTpl`:

```html
  <div class="tb-menu-content tb-toggle-menu-items" role="menu">
```

- [ ] **Step 3: Make click coexist with hover without double-toggling**

`tb-popover` registers `mouseenter/mouseleave` **or** `click`, never both
(`popover.component.ts:186-224`), so with `trigger: 'hover'` the click path must be driven manually.

In `menu-toggle.component.ts`, replace the collapsed branch of `toggleSection`:

```ts
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

  onTileClick(event: MouseEvent, popover: TbPopoverDirective) {
    if (!this.collapsed) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    if (popover.component?.tbVisible) {
      popover.hide();
    } else {
      popover.show();
    }
  }
```

Import `TbPopoverDirective` from `@shared/components/popover.component`. Wire it in the template by
passing the existing template reference:

```html
   (click)="collapsed ? onTileClick($event, menuPopover) : toggleSection($event)"
```

`show()`/`hide()` are idempotent and `delayEnterLeave()` clears its own timer, so a click while the
hover popover is open closes it cleanly rather than re-opening.

- [ ] **Step 4: Verify the gap crossing in a real browser**

Collapse the menu to the rail. Hover a section tile until the flyout appears, then move the pointer
**slowly horizontally across the 20 px gap** into the flyout.

Expected: the flyout stays open the whole way, and stays open while the pointer is anywhere over it.
Move the pointer away entirely: it closes after ~300 ms, not instantly.

This is the exact failure recorded in `HANDOFF.md` §8.6. **Verify by doing it, not by reading the
code.**

- [ ] **Step 5: Verify keyboard access did not regress**

With the rail collapsed:
- **Tab** reaches every rail tile in order; headings are skipped.
- **Enter** on a section tile opens the flyout.
- **Arrow Down / Up** move between flyout rows.
- **Escape** closes the flyout **and focus returns to the tile**.
- **Tab** past the last flyout row closes it and continues — focus is not trapped.
- Every focused element shows a visible focus ring.

- [ ] **Step 6: Commit**

```bash
git add ui-ngx/src/app/modules/home/menu/menu-toggle.component.ts \
        ui-ngx/src/app/modules/home/menu/menu-toggle.component.html
git commit -m "fix(menu): keep the rail flyout open across the pointer gap"
```

---

## Task 5: Alarm count — one shared 60 s poll (D5, AC-13/14/22)

**Files:**
- Create: `ui-ngx/src/app/core/services/alarm-badge.service.ts`
- Modify: `ui-ngx/src/app/core/services/menu.models.ts` (`badge` field on `MenuSection` + `alarms`)
- Modify: `ui-ngx/src/app/modules/home/menu/side-menu.component.{ts,html}`
- Modify: `ui-ngx/src/app/modules/home/menu/menu-link.component.{ts,html}`

**Interfaces:**
- Produces: `AlarmBadgeService.activeAlarmCount$: Observable<number>`; `MenuSection.badge?: 'alarmCount'`;
  `MenuLinkComponent.badgeCount: number | null`.

- [ ] **Step 1: Create the service**

`ui-ngx/src/app/core/services/alarm-badge.service.ts` — **must begin with the 15-line Apache header**
copied from any neighbouring `.ts` file:

```ts
import { Injectable } from '@angular/core';
import { select, Store } from '@ngrx/store';
import { Observable, of, timer, fromEvent, merge } from 'rxjs';
import { catchError, distinctUntilChanged, filter, map, shareReplay, startWith, switchMap } from 'rxjs/operators';
import { AppState } from '@core/core.state';
import { selectIsAuthenticated } from '@core/auth/auth.selectors';
import { AlarmService } from '@core/http/alarm.service';
import { AlarmQueryV2, AlarmSearchStatus } from '@shared/models/alarm.models';
import { TimePageLink } from '@shared/models/page/page-link';
import { Direction } from '@shared/models/page/sort-order';

const POLL_INTERVAL_MS = 60000;

/**
 * Single source of the active-alarm count for the left menu.
 *
 * One shared HTTP request every 60s for the whole application, regardless of how
 * many menu rows subscribe: the expanded badge and the collapsed rail dot are two
 * subscribers to one stream. Polling stops while the tab is hidden and while no
 * user is authenticated. The demo server is a single small VM - do not add load.
 */
@Injectable({
  providedIn: 'root'
})
export class AlarmBadgeService {

  readonly activeAlarmCount$: Observable<number>;

  constructor(private store: Store<AppState>,
              private alarmService: AlarmService) {
    const visible$ = merge(
      fromEvent(document, 'visibilitychange'),
      of(null)
    ).pipe(
      map(() => document.visibilityState !== 'hidden'),
      distinctUntilChanged()
    );

    this.activeAlarmCount$ = this.store.pipe(select(selectIsAuthenticated)).pipe(
      switchMap((authenticated) => authenticated ? visible$ : of(false)),
      switchMap((active) => active ? timer(0, POLL_INTERVAL_MS) : of(null)),
      switchMap((tick) => tick === null ? of(0) : this.fetchCount()),
      distinctUntilChanged(),
      shareReplay({bufferSize: 1, refCount: true})
    );
  }

  private fetchCount(): Observable<number> {
    const pageLink = new TimePageLink(1, 0, null, {property: 'createdTime', direction: Direction.DESC});
    const query = new AlarmQueryV2(null, pageLink, {
      typeList: null,
      statusList: [AlarmSearchStatus.ACTIVE],
      severityList: null
    });
    return this.alarmService.getAllAlarmsV2(query, {ignoreErrors: true, ignoreLoading: true}).pipe(
      map((pageData) => pageData.totalElements),
      catchError(() => of(0))
    );
  }
}
```

Three details that are load-bearing:

- **`pageSize: 1`.** There is no count endpoint (`AlarmController` has none); the count is
  `PageData.totalElements`, so one row is fetched and only the metadata is used. Do not widen it.
- **`catchError` is INSIDE `fetchCount()`**, not on the outer stream. On the outer stream, the first
  network blip would kill the timer permanently.
- **`ignoreErrors: true`** suppresses the global error toast — a menu badge must never raise a dialog.

Check `AlarmQueryV2`'s constructor signature and the `TimePageLink` constructor against
`shared/models/alarm.models.ts` and `shared/models/page/page-link.ts` before assuming the argument
order above; adjust to match, keeping the semantics (page size 1, ACTIVE only).

- [ ] **Step 2: Mark which row carries the badge — in data, not in a template `if`**

`menu.models.ts`, on the `MenuSection` interface:

```ts
  badge?: 'alarmCount';
```

and on the `MenuId.alarms` entry in `menuSectionMap`, add `badge: 'alarmCount'`. No
`id === 'alarms'` string comparison anywhere in a template.

- [ ] **Step 3: Subscribe once, in the side menu**

`side-menu.component.ts`:

```ts
  alarmCount$ = this.alarmBadgeService.activeAlarmCount$;

  constructor(private menuService: MenuService,
              private alarmBadgeService: AlarmBadgeService) {
  }
```

`side-menu.component.html` — pass the value down to both the link and the toggle arms:

```html
          <tb-menu-link [section]="section" [collapsed]="collapsed"
                        [badgeCount]="section.badge === 'alarmCount' ? (alarmCount$ | async) : null">
          </tb-menu-link>
```

One `async` pipe per row, but `shareReplay({refCount: true})` means one HTTP request regardless.

- [ ] **Step 4: Render the badge and the dot**

`menu-link.component.ts`:

```ts
  @Input() badgeCount: number | null = null;
```

`menu-link.component.html`, inside the `<a>`, after the label `<span>`:

```html
  @if (badgeCount > 0) {
    @if (collapsed) {
      <span class="tb-menu-dot" aria-hidden="true"></span>
      <span class="cdk-visually-hidden">{{ badgeCount }}</span>
    } @else {
      <span class="tb-menu-badge">{{ badgeCount }}</span>
    }
  }
```

`@if (badgeCount > 0)` gives AC-14's "hidden when the count is 0" for free. The visually-hidden span
is the a11y requirement: the dot must not convey meaning by colour alone.

- [ ] **Step 5: Verify the count is real and the request count is right**

Open DevTools → Network, filter `alarms`. Expected:

- Exactly **one** request on load, then one more per 60 s. Not one per menu row.
- Switch to another tab for two minutes, return: **no** requests were issued while hidden.
- The badge number equals `totalElements` in the response — assert against the API's own number,
  never a hardcoded literal (AC-14).
- Sign out: polling stops, no 401s.

- [ ] **Step 6: Commit**

```bash
git add ui-ngx/src/app/core/services/alarm-badge.service.ts \
        ui-ngx/src/app/core/services/menu.models.ts \
        ui-ngx/src/app/modules/home/menu/side-menu.component.ts \
        ui-ngx/src/app/modules/home/menu/side-menu.component.html \
        ui-ngx/src/app/modules/home/menu/menu-link.component.ts \
        ui-ngx/src/app/modules/home/menu/menu-link.component.html
git commit -m "feat(menu): add a shared alarm-count badge polled once a minute"
```

---

## Task 6: Expanded-panel geometry and colour (AC-4, 7, 8, 9, 10, 13)

**Files:**
- Modify: `ui-ngx/src/app/modules/home/menu/side-menu.component.scss`
- Modify: `ui-ngx/src/app/modules/home/menu/menu-link.component.scss`
- Modify: `ui-ngx/src/styles.scss` (Shell-C block, `:1660-1690`)

**Interfaces:**
- Consumes: `.tb-menu-section`, `.tb-menu-badge`, `.tb-menu-dot` from Tasks 1 and 5.

Ownership (from the design doc §7): **geometry** in the component stylesheet (no competitor, no
`!important`); **colour** in the Shell-C block (which already owns it at (0,4,1) with `!important`).
Do not split a declaration across both.

- [ ] **Step 1: Section-label typography (AC-4)**

`side-menu.component.scss`, inside `:host ::ng-deep`:

```scss
  .tb-menu-section {
    font-size: 11px;
    font-weight: 500;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--aq-text-3);
    padding: 14px 20px 6px;
    user-select: none;
  }
```

- [ ] **Step 2: Row geometry (AC-7)**

In the existing `a.mat-mdc-button.mat-mdc-button-base` block, confirm/adjust to the canvas:

```scss
    height: 40px;
    margin: 2px 8px;
    padding: 0 12px;
    border-radius: 12px;
    gap: 12px;
    font-size: 14px;
```

Current values are `margin: 2px 0` and `border-radius: var(--aq-radius-md)` (= 12px, correct). The
margin must become `2px 8px` to match the canvas; the width rule `width: 100%` must then become
`width: auto` or the rows will overflow by 16px.

Set the icon box to 22×22 (`.mat-icon { min-width: 22px; min-height: 22px; font-size: 22px; }`) and
drop `margin-right: 12px` in favour of the flex `gap`.

- [ ] **Step 3: Badge and dot (AC-13, AC-22)**

`menu-link.component.scss`, inside `:host ::ng-deep`:

```scss
  .tb-menu-badge {
    margin-left: auto;
    font-size: 10px;
    font-weight: 700;
    letter-spacing: .06em;
    padding: 1px 6px;
    border-radius: 999px;
    background: var(--aq-accent-container);
    color: var(--aq-on-accent-container);
  }

  .tb-menu-dot {
    position: absolute;
    top: 6px;
    right: 8px;
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--aq-error);
  }
```

The badge uses **accent-container, not error** — this is deliberate and comes from the canvas
(AC-13). The dot uses `--aq-error`. The dot needs its `<a>` ancestor to be `position: relative`.

- [ ] **Step 4: Verify colours by computed style, in both themes**

In the console, on a real row:

```js
const a = document.querySelector('.tb-side-menu a.mat-mdc-button');
getComputedStyle(a).height;            // "40px"
getComputedStyle(a).borderRadius;      // "12px"
const s = document.querySelector('.tb-menu-section');
getComputedStyle(s).fontSize;          // "11px"
getComputedStyle(s).textTransform;     // "uppercase"
```

Then `localStorage['tb-theme']='dark'`, reload, and repeat. Assert **on the element carrying the
declaration**.

If a value does not match, prove the cause by **injecting** a competing rule and re-measuring — never
by reading the stylesheet. A rule can be present, correct and `!important` and still never apply.

- [ ] **Step 5: Commit**

```bash
git add ui-ngx/src/app/modules/home/menu/side-menu.component.scss \
        ui-ngx/src/app/modules/home/menu/menu-link.component.scss \
        ui-ngx/src/styles.scss
git commit -m "style(menu): apply canvas geometry to section labels, rows and the badge"
```

---

## Task 7: Rail tiles, the lift, and flyout styling (D3, AC-20/21/24/25/26/27/30)

**Files:**
- Modify: `ui-ngx/src/styles.scss` (Shell-C block)
- Modify: `ui-ngx/src/app/modules/home/menu/side-menu.component.scss`
- Modify: `ui-ngx/src/app/modules/home/menu/menu-toggle.component.scss`

- [ ] **Step 1: Rail tile geometry (AC-20)**

`side-menu.component.scss`, in the `&.tb-collapsed` block: tiles are **48×40** with `margin: 2px 8px`
and `border-radius: 12px`, icons 22×22, already centred by the existing
`justify-content: center` rule (which must be kept — it is what puts every icon on the x=40 rail
axis, per `HANDOFF.md` §8.6).

- [ ] **Step 2: The lift (D3, AC-24) — and the AC-30 guard**

In the **Shell-C block** of `styles.scss`, matching the depth of the existing hover rule at
`:1668-1673` so it neither loses nor needs escalation:

```scss
  .tb-side-menu.tb-collapsed a.mat-mdc-button:hover:not(.tb-active) {
    background-color: var(--aq-hover) !important;
    color: var(--aq-text) !important;
    transform: translateY(-1px);
    box-shadow: var(--aq-shadow-1);
  }
  .tb-side-menu a.mat-mdc-button {
    transition: background-color 150ms ease, transform 150ms ease, box-shadow 150ms ease;
  }
  @media (prefers-reduced-motion: reduce) {
    .tb-side-menu a.mat-mdc-button { transition: none; }
    .tb-side-menu.tb-collapsed a.mat-mdc-button:hover:not(.tb-active) { transform: none; }
  }
```

`:not(.tb-active)` is what satisfies **AC-30** — the active tile keeps its filled pill and does not
lift while a different tile is hovered.

`transform` and `box-shadow` are not declared anywhere else in the sidenav cascade, so this is a
clean seam. Verify anyway (Step 5).

- [ ] **Step 3: The rail divider after Home (AC-21)**

A 32×1px rule in `--aq-border-subtle` after the Home tile only. Render it from the existing
`'divider'` arm (`mat-divider`) and constrain it in the collapsed state:

```scss
    &.tb-collapsed .mat-divider.mat-divider-horizontal {
      width: 32px;
      margin: 6px auto;
      border-top-color: var(--aq-border-subtle);
    }
```

This requires a `{id: MenuId.divider}` entry after Home in the reference trees — add it back for the
**collapsed** case only if the expanded design does not show it. If a single divider entry would
appear in both states, prefer showing it in both: it is one hairline and the canvas shows the rail
divider explicitly.

- [ ] **Step 4: Flyout panel and rows (AC-25/26/27)**

`menu-toggle.component.scss`, on the global `.tb-toggle-menu-items` block (the overlay renders
outside the host, so this must not be inside `:host ::ng-deep`):

```scss
.tb-toggle-menu-items {
  min-width: 220px;
  width: 220px;
  padding: 6px;
  border-radius: 12px;
  background: var(--aq-surface-2);
  box-shadow: 0 8px 24px rgba(0, 0, 0, .25);

  .tb-menu-toggle-header {
    height: auto;
    padding: 8px 12px 4px;
    border-bottom: none;
    font-size: 11px;
    font-weight: 500;
    letter-spacing: .08em;
    text-transform: uppercase;
    color: var(--aq-text-3);
  }

  a.mat-mdc-button {
    height: 36px;
    margin: 0;
    padding: 0 12px;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--aq-text-2);

    .mat-icon, tb-icon { display: none; }

    &:hover, &.tb-active {
      background-color: var(--aq-hover);
      color: var(--aq-text);
    }
  }
}
```

The flyout shadow stays the literal `0 8px 24px rgba(0,0,0,.25)` per **D4** — untokenised, not
theme-swapped. Note the existing block has `min-width: 250px` and hardcoded `rgba(0,0,0,.07)` hover
colours that must be replaced by tokens.

- [ ] **Step 5: The 20px offset (AC-25)**

The flyout's left edge must sit at 84px — 64px rail + 20px gap. The trigger already passes
`[tbPopoverOverlayStyle]="{marginTop: '-8px'}"`; extend it with a left margin rather than a new
positioning strategy:

```html
   [tbPopoverOverlayStyle]="{marginTop: '-8px', marginLeft: '12px'}"
```

Measure the rendered gap and adjust the constant until `flyout.getBoundingClientRect().left` minus
the rail's right edge is **20px**. Do not guess — the popover already applies its own offset.

- [ ] **Step 6: Verify the lift and the flyout in both themes**

```js
const t = document.querySelector('.tb-side-menu.tb-collapsed a.mat-mdc-button:not(.tb-active)');
// hover it, then:
getComputedStyle(t).transform;   // a matrix, not "none"
getComputedStyle(t).boxShadow;   // not "none"
const f = document.querySelector('.tb-toggle-menu-items');
getComputedStyle(f).width;       // "220px"
f.getBoundingClientRect().left;  // rail right edge + 20
```

Confirm the active tile does **not** lift while another is hovered (AC-30). Repeat in dark.

- [ ] **Step 7: Commit**

```bash
git add ui-ngx/src/styles.scss \
        ui-ngx/src/app/modules/home/menu/side-menu.component.scss \
        ui-ngx/src/app/modules/home/menu/menu-toggle.component.scss \
        ui-ngx/src/app/modules/home/menu/menu-toggle.component.html
git commit -m "style(menu): style the rail tiles, hover lift and section flyouts"
```

---

## Task 8: The foot user block (AC-15/16/17/18/23)

**Files:**
- Modify: `ui-ngx/src/app/shared/components/user-menu.component.html`
- Modify: `ui-ngx/src/app/shared/components/user-menu.component.scss`
- Modify: `ui-ngx/src/app/shared/components/user-menu.component.ts` (initials only)

The block already exists with avatar, display name, role and a working popover, and is already at the
rail foot (`home.component.html:48`). **Restyle it; do not rebuild it.**

- [ ] **Step 1: Avatar initials (AC-16)**

Replace the `mdi:account-circle-outline` icon with a 32px circle carrying the user's initials.
Add to `user-menu.component.ts`:

```ts
  userInitials$ = this.userDisplayName$.pipe(
    map((name) => (name || '')
      .split(' ')
      .filter(part => !!part)
      .slice(0, 2)
      .map(part => part.charAt(0).toUpperCase())
      .join(''))
  );
```

Template:

```html
  <div class="tb-user-avatar">{{ userInitials$ | async }}</div>
```

The value renders through interpolation, which escapes — ADR 0002 satisfied. No `style=""`.

- [ ] **Step 2: Block and avatar styling (AC-15/16/17)**

```scss
  .tb-user-menu:not(.tb-collapsed) {
    border-top: 1px solid var(--aq-border-subtle);
    padding: 12px 12px 12px 16px;
    gap: 10px;
  }
  .tb-user-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--aq-accent-container);
    color: var(--aq-on-accent-container);
    font-size: 12px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
  }
  .tb-user-display-name { font-size: 13px; font-weight: 600; color: var(--aq-text); line-height: 16px; }
  .tb-user-authority    { font-size: 11px; font-weight: 400; color: var(--aq-text-3); line-height: 14px; }
```

Name and role are already bound to the signed-in user — AC-17's "not literals" already holds.

- [ ] **Step 3: The overflow control (AC-18)**

Add a 16×16 vertical three-dot control in `--aq-text-3` at the right of the block, opening the
**existing** `userMenuTpl` popover. Reuse `menuPopoverFull` — do not create a second popover, and do
not duplicate the account/theme/logout actions. Every action in it must still work.

- [ ] **Step 4: Collapsed rail foot (AC-23)**

In the collapsed state the avatar sits at the rail foot with **no** divider and **no** border-top:

```scss
  .tb-user-menu.tb-collapsed {
    border-top: none;
    padding: 0 0 12px;
    justify-content: center;
  }
```

- [ ] **Step 5: Verify**

Both themes: block pinned to the bottom, ~56px tall, hairline above it, initials legible on the
accent-container circle, name and role correct for the signed-in user. Click the overflow control →
account / theme toggle / logout all work. Collapse → avatar centred at the rail foot, no hairline.
Keyboard: Tab reaches the block, Enter opens the menu, Escape closes it.

- [ ] **Step 6: Commit**

```bash
git add ui-ngx/src/app/shared/components/user-menu.component.ts \
        ui-ngx/src/app/shared/components/user-menu.component.html \
        ui-ngx/src/app/shared/components/user-menu.component.scss
git commit -m "style(menu): restyle the foot user block to the canvas"
```

---

## Task 9: Favicon — verification only (AC-F1, AC-F2)

**Files:** none modified, unless Step 3 proves otherwise.

**The favicon is already fixed in the working tree. Do not rebuild it, do not regenerate it.**

- [ ] **Step 1: Confirm the file is unchanged and correct**

```bash
cd /d/Github/airlinq-air/ui-ngx/src
python -c "
import struct
d = open('airlinq.ico','rb').read()
n = struct.unpack('<H', d[4:6])[0]
print('frames', n, 'bytes', len(d))
for i in range(n):
    o = 6 + 16*i
    print(' ', d[o] or 256, 'x', d[o+1] or 256)
"
```

Expected, verbatim: `frames 4 bytes 6419`, then `16 x 16`, `32 x 32`, `48 x 48`, `64 x 64`.

- [ ] **Step 2: Confirm the reference is intact**

```bash
sed -n '26p' /d/Github/airlinq-air/ui-ngx/src/index.html
```

Expected: `<link rel="icon" type="image/x-icon" href="airlinq.ico">` — with **no** `sizes` attribute.

- [ ] **Step 3: Look at the browser tab (AC-F1)**

Load the app in Edge. The Airlinq mark must appear **visually centred**, not cropped or offset, at
default zoom. Capture a zoomed screenshot of the tab as evidence.

**Add a `sizes` attribute ONLY if** the browser demonstrably picks the wrong frame — i.e. the tab
mark is visibly a different frame from the one that should be chosen. If it looks right, change
nothing and record that no change was needed.

- [ ] **Step 4: No commit unless Step 3 forced a change**

---

## Task 10: Gate sweep and evidence (AC-31…AC-37)

**Files:** none modified — this task is the gate.

- [ ] **Step 1: Full dark-theme pass (AC-31)**

`localStorage['tb-theme']='dark'`, reload, and re-assert **every** measured criterion from Tasks 6–8.
Both artboards are byte-identical except one class, so any dark-only difference is a bug — there must
be **no `.tb-dark`-only selector** in anything added.

- [ ] **Step 2: Token discipline (AC-32)**

```bash
cd /d/Github/airlinq-air/ui-ngx/src
# No color-mix anywhere in source
grep -rn "color-mix" styles.scss app/ | grep -v node_modules
# No new hex/rgba in the menu components
grep -rnE "#[0-9a-fA-F]{3,8}\b|rgba?\(" \
  app/modules/home/menu/ app/shared/components/user-menu.component.scss
```

Expected: `color-mix` → no hits. The menu grep should show only the **pre-existing** `is-new` badge
rules and the D4-exempt flyout shadow. Any other literal is a violation.

Then confirm nothing slipped into the **built** bundle:

```bash
grep -c "color-mix" ui-ngx/target/generated-resources/public/*.css 2>/dev/null || echo "0 (or not built yet)"
```

- [ ] **Step 3: Lint delta (AC-34)**

```bash
cd /d/Github/airlinq-air/ui-ngx
NODE_OPTIONS=--max-old-space-size=8192 yarn lint 2>&1 | tail -5
```

The baseline on a pristine tree is **569 problems / 462 errors / 107 warnings**. The bar is **zero
NEW problems**. Save the before/after tails as evidence. If the baseline was not captured before
coding, capture it now from a clean checkout of the merge base.

- [ ] **Step 4: Build (AC-35)**

```bash
export JAVA_HOME=/d/tmp/tools/jdk-25.0.4.1+1
export PATH="$JAVA_HOME/bin:/d/tmp/tools/apache-maven-3.9.9/bin:$PATH"
cd /d/Github/airlinq-air
mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true
```

Expected: BUILD SUCCESS. Confirm the new `alarm-badge.service.ts` carries the Apache header.

- [ ] **Step 5: Regression sweep (AC-36)**

- The row-set diff from Task 3 still passes (re-run if the model was touched after it).
- The collapse/pin toggle works and `menuCollapsed` persists across reload.
- The entity-details drawer opens.
- The previously-shipped grid/dashboard work still renders — open the Container Operations dashboard
  and confirm the widgets and table anatomy are unchanged.

- [ ] **Step 6: Screenshots (AC-37)**

At 1600×1000, `deviceScaleFactor: 1`, Edge (`channel:'msedge'`), into
`.claude/team/artifacts/left-menu-and-favicon/run-1/`:

| Shot | Light | Dark |
|---|---|---|
| Expanded menu | `expanded-light.png` | `expanded-dark.png` |
| Rail idle | `rail-idle-light.png` | `rail-idle-dark.png` |
| Rail hover + flyout | `rail-flyout-light.png` | `rail-flyout-dark.png` |
| Browser tab (favicon) | `favicon-tab.png` | — |

- [ ] **Step 7: AC-38 is human-judged**

**Invent no check for it.** Hand the screenshots and the running app to the human for the final
comparison against the canvas. Report AC-38 as "awaiting human judgement", never as passed.

- [ ] **Step 8: Commit the evidence**

```bash
git add .claude/team/artifacts/left-menu-and-favicon/run-1
git commit -m "test(menu): record screenshot and gate evidence for the sectioned menu"
```

---

## Self-review

**Spec coverage.** Every AC in the design doc's §9 table maps to a task: AC-1/2/3/19 → Task 10 Step 5
(verify-only, shell already conformant); AC-4/7/8/9/10/13 → Task 6; AC-5/6/11/12 → Tasks 1–2;
AC-14/22 → Task 5; AC-15/16/17/18/23 → Task 8; AC-20/21/24/25/26/27/30 → Task 7; AC-28/29 → Task 4;
AC-31…37 → Task 10; AC-38 → Task 10 Step 7, marked human-judged; AC-F1/F2 → Task 9.

**Placeholders.** None. Every code step carries the code; every verify step carries the command and
its expected output. Two steps deliberately say "measure and adjust" (Task 7 Step 5's overlay offset,
Task 2 Step 3's `alarm_rules` placement) — in both cases the correct value depends on a measurement
or a capture that only exists at implementation time, and the step states exactly what to measure and
what the target is.

**Type consistency.** `activeAlarmCount$` (Task 5 Step 1) is consumed as `alarmCount$` in
`side-menu.component.ts` (Step 3) and arrives as `badgeCount: number | null` in
`menu-link.component.ts` (Step 4) — consistent. `MenuSection.badge?: 'alarmCount'` (Step 2) is the
only selector for which row gets it. `onTileClick(event, popover)` (Task 4 Step 3) matches its
template call site. `.tb-menu-section` / `.tb-menu-badge` / `.tb-menu-dot` are introduced in Tasks 1
and 5 and styled under exactly those names in Tasks 6–7.

**Known plan risk.** Task 2 Step 3 (`alarm_rules`) and Task 7 Step 3 (the rail divider) are the two
places where the plan defers to a measurement rather than fixing a literal. Both are called out in
the step, and both are covered by the Task 3 row-set gate, which fails loudly if a page is lost.
