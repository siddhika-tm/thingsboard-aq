# D4 — merged menu tree specification (data)

**Status:** design, awaiting G2 approval
**Parent design:** `docs/design/left-menu-defect-fixes.md` (this document supersedes its D4 section)
**Requirement:** `docs/requirements/left-menu-defect-fixes.md`
**Related ADR:** ADR 0005 (supersedes 0003) — written by the Developer; this tree is consistent with it
**Author:** Technical Architect · 2026-09-08

---

## 0. Why this document exists

The parent design asserted that the D4 target shape "already exists verbatim at
`menu.models.ts:1183` (`homeMenuMap`, the pre-reshape tree)". **That was wrong.** The
Developer verified it and stopped rather than invent menu structure — the correct call.
`homeMenuMap` differs from the ruled target in three structural ways (§1.3), so combined
Option B is a genuine **merge**, not a copy.

This document specifies the merged tree **as data**, per authority, so the Developer
implements without inventing anything.

### 0.1 Corrections to the parent design (apply these there too)

| # | Parent-design claim | Correction |
|---|---|---|
| C1 | D1's specificity table: `display: flex` at (0,5,1) beats `display: none` at (0,5,2) | **Inverted.** Compiled selectors show `display: none` at **(0,5,2)** already beats `display: flex` at **(0,5,1)**. Jarvis verified this independently by compiling the SCSS. The real mechanism is likely the `gt-sm` breakpoint dropping `.tb-desktop` — the collapse rule needs **both** `.tb-desktop` AND `.tb-collapsed`. **D1 is now reproduce-first and is NOT specified here.** |
| C2 | Sass `loadPaths: ['src','src/app']` | Wrong. The correct value is **`['src/scss']`** (`angular.json:117`). |

---

## 1. Ground truth as measured

All facts below were extracted mechanically from `ui-ngx/src/app/core/services/menu.models.ts`
by parsing the two maps with a bracket-matching script, not read by eye.

### 1.1 The menu is two trees plus one dictionary

| Structure | Line | Role |
|---|---|---|
| `menuSectionMap` | `:128` | `MenuId` → `MenuSection` **definition** dictionary (~90 entries). Holds `type`/`path`/`icon`/`name`/`badge`. Editing an entry changes it for **every** authority. |
| `defaultUserMenuMap` | `:911` | `Authority` → nested `MenuReference[]` = **the rail shape**. Sole input to `buildUserMenu`. |
| `homeMenuMap` | `:1111` | `Authority` → nested `MenuReference[]` = **the Home-page shape**. Sole input to `buildUserHome`. |

`MenuReference` carries **only** `{id, pages?}` — no type, no path. Type comes from
`menuSectionMap`. **Regrouping edits a tree; changing `link`↔`toggle` edits the
dictionary and hits all three authorities at once.**

### 1.2 Relevant definitions in `menuSectionMap` (measured)

| id | type | path | icon | name |
|---|---|---|---|---|
| `monitor_label` | `section` | *(empty)* | — | `monitor.monitor` |
| `devices_assets_label` | `section` | *(empty)* | — | `entity.devices-and-assets` |
| `operations_label` | `section` | *(empty)* | — | `admin.operations` |
| `administration_label` | `section` | *(empty)* | — | `admin.administration` |
| `alarms_center` | **`link`** | `/alarms` | `mdi:alert-outline` | `alarm.alarms` |
| `alarms` | `link` | `/alarms/alarms` | `mdi:alert-outline` | `alarm.alarm-list` — **carries `badge: 'alarmCount'` (`:569`)** |
| `alarm_rules` | `link` | `/alarms/alarm-rules` | `tune` | `alarm-rule.alarm-rules` |
| `profiles` | **`toggle`** | `/profiles` | `badge` | `profiles.profiles` |
| `device_profiles` | `link` | `/profiles/deviceProfiles` | `mdi:alpha-d-box-outline` | `device-profile.device-profiles` |
| `asset_profiles` | `link` | `/profiles/assetProfiles` | `mdi:alpha-a-box-outline` | `asset-profile.asset-profiles` |
| `monitor` | `toggle` | `/monitor` | `mdi:view-dashboard-outline` | `monitor.monitor` |
| `entities` | `toggle` | `/entities` | `mdi:shape-outline` | `entity.devices-and-assets` |
| `notifications_center` | **`link`** | `/notification` | `mdi:message-badge-outline` | `notification.notifications` |

The complete set of `toggle` ids is `{data_processing, edge_management, entities,
features, monitor, platform_section, profiles, resources, security_settings,
tenants_section}`; the complete set of `section` ids is the four `*_label` entries.

### 1.3 The three real differences (why this is a merge, not a copy)

Measured `defaultUserMenuMap` (rail, current) vs `homeMenuMap`, `TENANT_ADMIN`:

1. **Headings.** The rail has `monitor_label` / `devices_assets_label` /
   `operations_label` / `administration_label`. `homeMenuMap` has **none** — it has
   `monitor` and `entities` **toggles** instead.
2. **Alarms.** `homeMenuMap` wraps alarms in `alarms_center` → `[alarms, alarm_rules]`.
   The rail has `alarms` and `alarm_rules` **flat**.
3. **Profiles.** `homeMenuMap` puts `device_profiles`/`asset_profiles` **flat inside
   `entities`**. The rail has them under a **`profiles` toggle**.

### 1.4 Two hard constraints discovered while measuring

**(a) `menu-toggle` cannot render a nested toggle.**
`menu-toggle.component.html:66` renders every child unconditionally as
`<tb-menu-link [section]="page">`. There is **no `@switch` on child type**. A `toggle`
placed inside a toggle therefore renders as a flat link and **silently loses its
children** — no error, no warning (the "missing `@switch` arm renders nothing" failure
class already recorded in role memory). The flyout template (`:78`) has the same
limitation: a hand-rolled `<a mat-button>` list, one level only.

**Consequence: the merged tree must be at most `heading → toggle → link`.** It must not
introduce a *new* `toggle`-inside-`toggle`. The existing `widget_library`-inside-
`resources` and `settings`-inside-`platform_section` nestings are **pre-existing**, and
both parents are `type: 'link'` carrying `pages` — they already render as flat links
today. This spec does not change them.

**(b) The Home cards are built from the `toggle` structure of `homeMenuMap`.**
`menuSectionToHomeSection` (`:1378`) flattens exactly **one** level:
`link` → card with `places: [self]`; `toggle` **with** pages → card titled by the toggle
with `places: pages`; **anything else returns `undefined` and the card vanishes.**

Emulated current Home output, `TENANT_ADMIN`:

```
card "monitor"             places=[dashboards, alarms_center, notifications_center]
card "entities"            places=[devices, assets, device_profiles, asset_profiles, entity_views, otaUpdates]
card "customers_and_users" places=[customers_and_users]
card "data_processing"     places=[calculated_fields, rule_chains]
card "resources"           places=[widget_library, images, scada_symbols, javascript_library, resources_library]
card "security_settings"   places=[audit_log]
card "platform_section"    places=[version_control, settings, api_usage]
```

`alarms_center` appears as a **place** (one card row), not a nested list — because it is
`type: 'link'`, its `pages` are discarded. Same for `notifications_center`.

**Consequence: `homeMenuMap` MUST NOT CHANGE AT ALL.** It already produces the required
cards. §3.1 makes this an invariant with a proof.

---

## 2. The target trees

### 2.1 Shape rule

```
top level:  home, iot_hub, divider, *_label headings, and rows
heading:    type 'section', non-interactive, NO pages  (a flat sibling, not a parent)
under it:   type 'link' rows  and  type 'toggle' groups
toggle:     children are 'link' only   (constraint §1.4a)
```

The four `*_label` headings are **flat siblings, not containers** — a `MenuReference` for
a `section` carries **no `pages`**. "Nested under the headings" is expressed by
**document order** between one heading and the next, which is exactly how the rail
renders today: `side-menu.component.html` iterates a flat array and `@switch`es on type.

### 2.2 `defaultUserMenuMap` — `SYS_ADMIN`

**UNCHANGED from current.** `SYS_ADMIN` has **no `*_label` headings at all** and already
carries Option-B toggles (`tenants_section`, `resources`, `security_settings`). The
human's ruling concerns the `*_label` sections, which this authority does not have.
No edit.

```ts
[
  Authority.SYS_ADMIN,
  [
    {id: MenuId.home},
    {
      id: MenuId.tenants_section,
      pages: [
        {id: MenuId.tenants},
        {id: MenuId.tenant_profiles},
      ]
    },
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
      id: MenuId.security_settings,
      pages: [
        {id: MenuId.security_settings_general},
        {id: MenuId.two_fa},
        {
          id: MenuId.oauth2,
          pages: [
            {id: MenuId.domains},
            {id: MenuId.clients}
          ]
        },
        {id: MenuId.audit_log}
      ]
    },
    {
      id: MenuId.platform,
      pages: [
        {id: MenuId.general},
        {id: MenuId.mail_server},
        {id: MenuId.notification_settings},
        {id: MenuId.queues}
      ]
    },
    {
      id: MenuId.mobile_center,
      pages: [
        {id: MenuId.mobile_bundles},
        {id: MenuId.mobile_apps},
        {id: MenuId.mobile_qr_code_widget}
      ]
    }
  ]
],
```

### 2.3 `defaultUserMenuMap` — `TENANT_ADMIN` (the real merge)

Changes vs current, and nothing else:
- `alarms` + `alarm_rules` → wrapped in an **`alarms_center` toggle** (2 pages)
- `profiles` toggle → **kept as-is** (already correct)
- all four headings → **kept**, in place
- everything else → byte-identical

```ts
[
  Authority.TENANT_ADMIN,
  [
    {id: MenuId.home},
    {id: MenuId.iot_hub},
    {id: MenuId.divider},

    // ---- MONITOR ----------------------------------------------------------
    {id: MenuId.monitor_label},
    {id: MenuId.dashboards},
    {
      // D4: restored group. `alarms` keeps `badge: 'alarmCount'` and is now a
      // CHILD, so menu-toggle must forward badgeCount (AC-47, §3.3).
      id: MenuId.alarms_center,
      pages: [
        {id: MenuId.alarms},
        {id: MenuId.alarm_rules}
      ]
    },
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

    // ---- DEVICES & ASSETS -------------------------------------------------
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

    // ---- OPERATIONS -------------------------------------------------------
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

    // ---- ADMINISTRATION ---------------------------------------------------
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

### 2.4 `defaultUserMenuMap` — `CUSTOMER_USER`

Changes vs current: `alarms` → wrapped in `alarms_center` (1 page). Headings kept.
There is **no `operations_label`/`administration_label`** for this authority and none is
added. `edge_instances` stays where it is — under `devices_assets_label` by document
order, matching current behaviour.

```ts
[
  Authority.CUSTOMER_USER,
  [
    {id: MenuId.home},

    // ---- MONITOR ----------------------------------------------------------
    {id: MenuId.monitor_label},
    {id: MenuId.dashboards},
    {
      // Single child. See §4.4 for the one-child-group question (Q2).
      id: MenuId.alarms_center,
      pages: [
        {id: MenuId.alarms}
      ]
    },
    {id: MenuId.notification_inbox},

    // ---- DEVICES & ASSETS -------------------------------------------------
    {id: MenuId.devices_assets_label},
    {id: MenuId.devices},
    {id: MenuId.assets},
    {id: MenuId.entity_views},
    {id: MenuId.edge_instances}
  ]
]
```

### 2.5 `homeMenuMap` — all three authorities

**NO CHANGE. Do not edit this map.** See §1.4b and §3.1.

### 2.6 `menuSectionMap` — the one required dictionary edit

`alarms_center` is currently **`type: 'link'`**. To render as a collapsible group it must
become **`type: 'toggle'`**.

```ts
[
  MenuId.alarms_center,
  {
    id: MenuId.alarms_center,
    name: 'alarm.alarms',
    type: 'toggle',        // D4: was 'link'
    path: '/alarms',
    icon: 'mdi:alert-outline'
  }
],
```

**This is the highest-risk edit in D4** — it is exactly the "editing the dictionary hits
every authority" trap. Blast radius:

| Consumer | Effect of `link` → `toggle` | Verdict |
|---|---|---|
| `defaultUserMenuMap` TENANT_ADMIN / CUSTOMER_USER | renders as a group — **intended** | OK |
| `homeMenuMap` TENANT_ADMIN / CUSTOMER_USER | `alarms_center` sits **inside** the `monitor` toggle, so it is a **place**, not a card. `menuSectionToHomeSection` only reads the **top-level** section's type; a place's type is never inspected. | **No Home change — but this is the invariant that must be PROVEN, §3.1** |
| `router-tabs.component.ts` | `findRootSection` matches on **path**, unchanged (`/alarms`) | OK |
| `menu.service.ts` `allMenuLinks` | `alarms_center` drops out of the link list (it filters `type === 'link'`) | Confirm no consumer needs it — §5 |
| `updateOpenedMenuSections` | now eligible for open/close state | **requires AC-48 recursion, §3.4** |

`profiles` needs **no** dictionary edit — already `toggle`.

### 2.7 Where `alarms_center` and `profiles` land — explicit answer

| id | `homeMenuMap` (unchanged) | `defaultUserMenuMap` target | Why |
|---|---|---|---|
| `alarms_center` | stays a **place** inside the `monitor` toggle; its `type` is now `toggle` but is never read in that position | **restored as a top-level `toggle` under `monitor_label`**, children `[alarms, alarm_rules]` (TENANT_ADMIN) / `[alarms]` (CUSTOMER_USER) | The ruling restores collapsible groups. Alarms is a genuine multi-page area (list + rules) and is the canonical group in upstream's shape. Requires the §2.6 dictionary edit. |
| `profiles` | **does not appear**; `homeMenuMap` keeps `device_profiles`/`asset_profiles` **flat inside `entities`** | **kept as the existing top-level `toggle`** under `devices_assets_label`, children `[device_profiles, asset_profiles]` | The rail already has it and it already satisfies the ruling. `homeMenuMap`'s flat arrangement is deliberate — it makes the two profile links two **places** on the "Devices and assets" Home card, which is the shipped Home layout. Divergence between the two maps here is **correct and intended**, not drift. |

---

## 3. Invariants, each with the proof that establishes it

### 3.1 INV-1 — Home-page snapshot unchanged

**What is snapshotted:** the output of `buildUserHome(authState)` per authority — an
`Array<HomeSection>` where each is `{name, places: MenuSection[]}`. Snapshot the
projection `[{name, places: [{id, name, type, path, icon}]}]` **in array order** (order
is user-visible).

**Why a projection, not the raw object:** `referenceToMenuSection` `deepClone`s, and
`menu.service.ts` then mutates `active`/`opened` on the clones, so raw equality is noisy.
Exclude `active` and `opened`.

**Proof:** capture the projection at `HEAD` **before** any edit and again after.
`diff` must be **empty** for all three authorities.

**Mechanism:** `buildUserHome` is a pure exported function of `AuthState`. Drive it
directly with three synthetic `AuthState`s differing only in `authUser.authority`,
**each with `edgesSupportEnabled` set both ways** — that flag is the only other input
`menuFilters` reads (it gates `edges` / `edge_management` / `rulechain_templates`). So
**6 snapshots, not 3.**

**Expected result: empty diff, trivially,** because §2.5 makes zero edits to
`homeMenuMap`. The **non-trivial** risk is the §2.6 `alarms_center` type flip leaking
into Home. This snapshot is precisely the proof that it does not — **do not skip it on
the grounds that `homeMenuMap` was untouched.**

### 3.2 INV-2 — Pageset diff `LOST [] / GAINED []` per authority, after redirect resolution

**Why redirects matter:** a `toggle` tile's own `path` is a container route that
redirects. Comparing raw paths would report a spurious GAIN of `/alarms` when
`alarms_center` becomes a reachable tile. **Resolve first, then compare sets.**

**Redirect table (measured from `*-routing.module.ts`, menu-reachable entries only):**

| container path | resolves to | source |
|---|---|---|
| `/alarms` | `/alarms/alarms` | `alarm-routing.module.ts:92` |
| `/profiles` | `/profiles/deviceProfiles` | `profiles-routing.module.ts:40` |
| `/entities` | `/entities/devices` | `entities-routing.module.ts:40` |
| `/resources` | `/resources/widgets-library` | `admin-routing.module.ts:89` |
| `/security-settings` | `/security-settings/general` | `admin-routing.module.ts:372` |
| `/features` | `/features/otaUpdates` | `features-routing.module.ts:40` |
| `/notification` | `/notification/inbox` | `notification-routing.module.ts:47` |
| `/mobile-center` | `/mobile-center/bundles` | `mobile-routing.module.ts:42` |
| `/edgeManagement` | `/edgeManagement/instances` | `edge-routing.module.ts:60` |
| `/settings` | `/settings/general` | `admin-routing.module.ts` |

`/monitor`, `/dataProcessing`, `/platform`, `/tenants` have no menu-reachable redirect
target beyond their own children and contribute nothing.

**Definition of the pageset:** for a tree, the set of **resolved** paths of every
`type: 'link'` node at any depth, **after** applying `filterMenuReference` — so the 11
`unavailableOffline` ids and the `edges*` trio are excluded, including the "parent hidden
when all children hidden" rule.

**Proof:** compute the pageset of `buildUserMenu` at HEAD and after, per authority, per
`edgesSupportEnabled` value. Assert `LOST = []` and `GAINED = []`.

**Pre-verified.** I computed this for the §2 target against current HEAD:

```
SYS_ADMIN      LOST=[] GAINED=[]
TENANT_ADMIN   LOST=[] GAINED=[]
CUSTOMER_USER  LOST=[] GAINED=[]
```

The merged tree is pageset-neutral by construction — it only re-parents existing links.
Cross-check: the **current** `defaultUserMenuMap` and `homeMenuMap` are *already*
pageset-equivalent after redirect resolution (22 / 33 / 8 paths respectively, zero
difference either way), which confirms the resolution table is complete enough for this
comparison.

### 3.3 INV-3 — The alarm badge still reaches `alarms` when nested (AC-47)

**Current state.** `badge: 'alarmCount'` lives on `MenuId.alarms` (`:569`).
`side-menu.component.html:23-24` forwards it — but **only for top-level links**:

```html
[badgeCount]="section.badge === 'alarmCount' ? (alarmCount$ | async) : null"
```

`menu-toggle.component.html:66` renders children with **no `badgeCount` at all**:

```html
<tb-menu-link [section]="page"></tb-menu-link>
```

Moving `alarms` under `alarms_center` therefore **silently drops the badge**. That is
AC-47.

**Required bindings — three sites:**

1. **`menu-toggle.component.ts`** — accept the count. `menu-toggle` must **not** grow its
   own poll. Take it as an `@Input` so there stays exactly one subscription owner
   (`tb-side-menu`), matching how `collapsed` already flows down:
   ```ts
   /** AIRLINQ (AC-47): forwarded to badged child rows; owned by tb-side-menu. */
   @Input() alarmCount: number | null = null;
   ```
2. **`side-menu.component.html`** — pass it into the `toggle` arm:
   ```html
   <tb-menu-toggle [section]="section" [collapsed]="collapsed"
                   [alarmCount]="alarmCount$ | async"></tb-menu-toggle>
   ```
3. **`menu-toggle.component.html:66`** — forward per child, reusing the **same
   data-driven predicate** as `side-menu` (no id comparison anywhere):
   ```html
   <tb-menu-link [section]="page"
                 [badgeCount]="page.badge === 'alarmCount' ? alarmCount : null"></tb-menu-link>
   ```

**Also the flyout (`menu-toggle.component.html:78`).** The collapsed-rail flyout is a
hand-rolled `<a mat-button>` list with **no badge markup**. With `alarms` nested, a
collapsed rail shows the count **nowhere**: the `alarms_center` tile has no badge and the
flyout row has none either. **Decision needed — §6 Q1.**

**Proof:** rendered, not structural. With a non-zero active alarm count, expand
`alarms_center` and assert `.tb-menu-badge` exists inside the toggle list with the
expected text; then collapse the rail, open the flyout, and assert per the Q1 decision.
A grep or `getComputedStyle` check **cannot see a missing input binding**.

### 3.4 INV-4 — `updateOpenedMenuSections()` recurses (AC-48)

**Current code (`menu.service.ts:77-84`) — top level only:**

```ts
this.currentMenuSections.filter(section => section.type === 'toggle' &&
  (openedMenuSections.includes(section.path) || section.active)).forEach(
  section => section.opened = true
);
```

It filters `this.currentMenuSections`, the **top-level array**. Nested toggles are never
visited. Today that is harmless because every `toggle` is top-level, and it stays
harmless for §2 as specified (all groups are top-level). **But** AC-48 asks for
recursion, and there is a ready-made recursive walker immediately beside it:
`allMenuSections()` (`:100`) already flattens the whole tree.

**Required change — reuse the existing walker; do not hand-roll a third recursion:**

```ts
private updateOpenedMenuSections() {
  const openedMenuSections = getCurrentOpenedMenuSections(this.store);
  if (this.currentMenuSections?.length) {
    // AIRLINQ (AC-48): walk the whole tree, not just the top level, so a nested
    // toggle restores its persisted open state too.
    this.allMenuSections(this.currentMenuSections)
      .filter(section => section.type === 'toggle' &&
        (openedMenuSections.includes(section.path) || section.active))
      .forEach(section => section.opened = true);
  }
}
```

`allMenuSections` is already called on the line above in `buildMenu()` and its result
stored in `this._availableMenuSections`; passing that instead of re-walking is equally
acceptable.

**Note this is a defensive change under §2**, since the spec introduces no nested
toggle. It is required so AC-48 holds and so a future nested group works.

**Proof:** unit-level — build a menu, dispatch
`ActionPreferencesUpdateOpenedMenuSection` for a nested toggle's path, rebuild, assert
`opened === true` on the nested node. Plus the default-collapsed assertion in §3.6.

### 3.5 INV-5 — `sectionHeight()` and the nesting height arithmetic (AC-49)

**Already applied by the Developer** (`menu-toggle.component.ts:57-68`), guarded with
`?.` + `?? 0`:

```ts
if (this.section.opened && !this.collapsed) {
  return (this.section.pages?.length ?? 0) * 40 + 'px';
}
```

**The arithmetic implication of nesting — the part this spec must add.**
`pages.length * 40` encodes two assumptions:

- **A1:** every child occupies exactly 40px.
- **A2:** the child list is **flat** — each entry contributes exactly one row.

Under §2 **both hold**, because every group's children are `type: 'link'` and
`menu-toggle` renders each as exactly one `tb-menu-link` row. So `alarms_center`
(2 children) → `80px`, `profiles` (2) → `80px`, `resources` (5) → `200px`.
**No height change is needed for the tree as specified.**

**A2 breaks the moment a group contains a group** — and it breaks in a deceptive way. If
a child were itself a `toggle`, `menu-toggle` would render it as a single flat link
(constraint §1.4a), so the height would be **accidentally correct** while the **content
is wrong** (grandchildren vanish). The height arithmetic is therefore *not* the thing
that fails first; the missing child `@switch` is. Recorded here so this is not "fixed" by
making the height recursive while the rendering stays flat.

**Guard rail for the Developer:** because the tree is authored data, add a **cheap
structural assertion** instead of reworking the height maths — assert in the D4
verification step that, for all three authorities, **no `type: 'toggle'` section has a
`toggle`-typed descendant in its `pages`**. That converts §1.4a from a comment into a
checked invariant, and it is the assertion that catches this whole bug class.

If a nested group is ever genuinely required, the change set is: a child `@switch` in
`menu-toggle.component.html`, a recursive `sectionHeight()`, **and** a two-level flyout.
That is a separate work item, explicitly out of D4 scope.

### 3.6 INV-6 — Multi-page groups default COLLAPSED on first login

Per the ruling. **Verify the default rather than assume it:** `menuSectionMap` entries
set no `opened`, so `opened` is `undefined` → falsy → collapsed. The only things that
open a group are (a) a persisted `openedMenuSections` hit and (b) `section.active` —
i.e. the group containing the current route opens, which is desired and is upstream
behaviour.

**Proof:** with `openedMenuSections` empty and the route on `/home`, assert every
`toggle` renders `height: 0px` and `visibility: hidden`. Then navigate to
`/alarms/alarm-rules` and assert `alarms_center` is open (the `active` path) while
`profiles` stays closed.

---

## 4. Rendering and behaviour notes the Developer needs

### 4.1 Rail flyout opens on CLICK

Already implemented and unchanged by D4: `menu-toggle.component.html` sets
`[tbPopoverTrigger]="collapsed ? 'hover' : null"` and drives click manually via
`onTileClick`. Hover-expand of the rail itself stays abandoned. D4 adds no change here
beyond the badge question in §3.3 / Q1.

### 4.2 `updateOpenedMenuSections` — see §3.4.

### 4.3 Badge forwarding — see §3.3.

### 4.4 `alarms_center` with a single child (CUSTOMER_USER)

For `CUSTOMER_USER`, `alarms_center` wraps exactly one page (`alarms`). A one-item
accordion is a worse affordance than a plain link: two clicks to reach one destination,
and the badge moves a level down for no benefit.

- **(a)** Keep the group for cross-authority structural consistency (as written in §2.4).
- **(b)** For `CUSTOMER_USER` only, keep `alarms` as a **flat top-level link** — the group
  buys nothing with one child, and the badge stays on the top-level row where
  `side-menu` already forwards it with **no new binding**.

**I recommend (b).** It is pageset-identical, keeps the `CUSTOMER_USER` badge path
completely untouched, and "collapsible groups" is meaningless for a single page. It does
mean the two authorities differ in shape — which §2 already establishes is normal here.
**Decision needed — §6 Q2.** §2.4 is written as (a) so the ruling is followed literally
unless the human chooses otherwise.

### 4.5 `menuFilters` interaction — do not flatten a fully-filtered group

Role memory: `filterMenuReference` hides a parent when **all** children are filtered, so
flattening such a group turns a correctly-hidden group into visible **dead rows**. D4
only *adds* a group, so this cuts the safe way. `alarms_center` and `profiles` have **no**
entry in `menuFilters`, and neither do their children — no interaction.
`edge_management` / `edges` / `rulechain_templates` remain filtered by
`edgesSupportEnabled` exactly as today; do not touch them.

---

## 5. The `.pages` consumer sweep

Complete list of real `.pages` reads on `MenuSection`. (`mobile-layout.component.ts` and
`mobile-app.models.ts` hits are an unrelated `pagesForm` / `MobilePage` and are excluded.)

| # | Site | State |
|---|---|---|
| 1 | `menu.models.ts:1348-1349` `referenceToMenuSection` | guarded (`?.length`) |
| 2 | `menu.models.ts:1365-1366` `filterMenuReference` | guarded |
| 3 | `menu.models.ts:1385-1388` `menuSectionToHomeSection` | guarded (`?.length`) — **Home invariant §3.1** |
| 4 | `menu.service.ts:93-94` `allMenuLinks` | guarded (`&& .length`) |
| 5 | `menu.service.ts:104-105` `allMenuSections` | guarded — **reused by §3.4** |
| 6 | `menu.service.ts:130-131` `isSectionActive` | guarded (`?.length`) |
| 7 | `router-tabs.component.ts:118` `buildTabs` | **ALREADY GUARDED** (`?.` + `?? []`). Memory has been corrected; this is **not** the live risk. |
| 8 | `router-tabs.component.ts:155-156` `findRootSection` | guarded |
| 9 | `menu-toggle.component.html:64` expanded list `@for` | Angular `@for` over `undefined` is safe |
| 10 | `menu-toggle.component.html:78` flyout `@for` | safe |
| 11 | `menu-toggle.component.ts:66` `sectionHeight()` | **guarded by the Developer** — §3.5 |

**All 11 are guarded.** The sweep's purpose is now regression detection, not bug-finding.

**How the proof must be obtained.** A **rendered all-routes sweep** that navigates every
menu-reachable route and asserts
`document.querySelectorAll('.tb-side-menu > li').length > 0` on each.
**Never static inspection.** The failure class this catches — an unguarded `.pages`
dereference inside a `[style.height]` binding — throws on **every change-detection
cycle** and **blanks the entire side menu**, while the code **builds, lints and greps
clean**. Same family as the `mat-table` "Could not find column" defect already in team
memory: structural proof is not visual proof.

Route list for the sweep = the resolved pageset from §3.2 (22 / 33 / 8 paths), per
authority.

---

## 6. Migration / compatibility: stale `openedMenuSections`

**What is persisted.** `openedMenuSections` is a **flat `string[]` of `path` values** —
`auth.reducer.ts:92-100` maintains a `Set<string>` keyed on `action.payload.path`, and
`auth.effects.ts:40` PUTs it to user settings. There is **no** structure, no ids, no
nesting, no schema version.

**What happens to a stale entry.** `updateOpenedMenuSections` only ever **reads** the
array via `.includes(section.path)` and only ever **sets `opened = true`**. A path that
no longer corresponds to a `toggle` simply never matches — it is inert. There is no
lookup by index, no assumption that the path still exists, and nothing iterates the
persisted array itself.

**Concretely for D4:**
- A user who had `/profiles` open keeps `/profiles`; `profiles` is still a `toggle` with
  the same path → **restores open, unchanged.**
- `/alarms` was never persistable before (`alarms_center` was a `link`, and
  `toggleSection` only fires from `menu-toggle`), so **no user has it**. The new group
  therefore starts **collapsed**, satisfying INV-6.
- Any path from the Option A shape that is now a heading or a plain link → **inert, no
  effect.**

**Nothing is needed.** No migration, no cleanup, no schema bump. The array is
self-healing because it is a set of opaque path strings evaluated against the current
tree. Worth stating in ADR 0005's consequences: **the persisted format is
shape-independent, which is why re-shaping the menu is not a breaking user-data change.**

One cosmetic note, not worth code: stale paths accumulate and are never pruned. That is
pre-existing upstream behaviour, bounded by the number of distinct toggle paths (~10),
and out of D4 scope.

---

## 7. Constraint compliance

| Constraint | Status |
|---|---|
| Blue light palette unchanged | No token or colour edit in D4 |
| Dark unchanged | No `.tb-dark` edit; the frozen dark block is untouched |
| No new `!important` | D4 is TS/HTML data + bindings only; no new SCSS declarations |
| `homeMenuMap` Home guarantee intact | §2.5 zero edits + §3.1 snapshot proof |
| Consistent with ADR 0005 | The tree is `heading → toggle → link`, exactly the sectioned+grouped model 0005 records as superseding 0003's flatten-only model |
| No `ui-ngx/` file touched by the architect | This document is the only artifact written |

---

## 8. Open decisions for the human

**Q1 — collapsed-rail flyout badge (§3.3).** With `alarms` nested under `alarms_center`,
a **collapsed** rail shows the alarm count nowhere: the tile has no badge and the flyout
row has no badge markup. Options: (a) add a badge to the flyout row; (b) add a dot to the
`alarms_center` tile when any badged descendant is non-zero; (c) accept the gap when
collapsed. **I recommend (b)** — the collapsed rail's job is to surface *that* there are
alarms; the exact number belongs in the flyout. (b) also matches the existing
collapsed-link pattern, which already degrades the badge to `.tb-menu-dot`.

**Q2 — `CUSTOMER_USER` single-child `alarms_center` (§4.4).** Recommend keeping `alarms`
flat for that authority only. §2.4 currently follows the ruling literally (grouped).

**No AC is unreachable.** AC-47, AC-48, AC-49 and both invariant diffs are achievable as
specified. The one thing flagged rather than designed around: **AC-47 is only half
satisfiable in the collapsed rail without a template addition to the flyout** — that is
Q1, a genuine product choice, not a hidden blocker.
