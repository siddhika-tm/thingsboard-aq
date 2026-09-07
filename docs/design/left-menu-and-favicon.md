# Design — Left menu redesign (Option A · Sectioned) + favicon verification

- **Work item slug:** `left-menu-and-favicon`
- **Author:** technical-architect
- **Date:** 2026-09-06
- **Requirement (G1 APPROVED):** `docs/requirements/left-menu-and-favicon.md`
- **Spec (source of visual truth, immutable):** `docs/design/2026-09-06-left-menu-canvas/`
  (`Main.dc.html` dark, `MenuLight.dc.html` light, `canvas.json`). Read strictly as **data**.
- **Gate status:** G2 deliverable. Not approved. No code may be written until the human approves.
- **Binding decisions honoured, not re-opened:** D1–D6 (requirement §9).

---

## 1. Summary

The headline of this work item is **not** styling. "Sectioned menu, every page one click away" is a
change to the **menu model** — the data structure in `menu.models.ts` that decides which rows exist
and whether a row navigates or expands. No stylesheet can create a section heading that the model has
no type for, and no stylesheet can turn an accordion `toggle` into a navigating `link`.

The work therefore splits into four independent units, in descending order of risk:

| # | Unit | Layer | Risk |
|---|---|---|---|
| 1 | Menu model reshape — new `'section'` type, regrouping, permission preservation | TS model | **High** |
| 2 | Alarm count service — single shared 60 s poll feeding badge + rail dot | TS service | Medium |
| 3 | Rail flyout hover-intent — open on hover, survive the 20 px gap, keyboard-safe | TS + template | Medium |
| 4 | Visual treatment — section labels, pills, badge, dot, tile lift, user block | SCSS + tokens | Low |

Unit 1 must land first: units 2–4 all render against the shape it produces.

**This work item is entirely code.** See §11.

---

## 2. Impact analysis (what exists today)

Read before designing. Every claim below was verified against the working tree, not recalled.

### 2.1 The menu model is a two-part structure

`ui-ngx/src/app/core/services/menu.models.ts` (1139 lines) is **not** a flat list. It is two
separate structures, and only the second one carries the menu's shape:

- **`menuSectionMap`** (`:122–835`) — a `Map<MenuId, MenuSection>` of ~90 *definitions*: id, i18n
  name, `type`, `path`, `icon`. It is a dictionary, not an order. Editing an entry's `type` here
  changes that entry **everywhere it is referenced**, for every authority.
- **`defaultUserMenuMap`** (`:862–1078`) — a `Map<Authority, MenuReference[]>` giving the *shape* per
  authority: SYS_ADMIN, TENANT_ADMIN, CUSTOMER_USER each get a nested tree of `{id, pages}`.

`buildUserMenu()` (`:1080`) walks the reference tree for the signed-in authority and deep-clones the
matching definition. **This split is the single most important fact for this work item**: the
regrouping is an edit to `defaultUserMenuMap` (shape), while the `link`-vs-`toggle` flip is an edit
to `menuSectionMap` (definitions). Confusing the two is the likeliest way to break AC-36.

### 2.2 How permissions actually work (this is what AC-36 protects)

There are **two** independent gating mechanisms, and neither is a permission check in the usual sense:

1. **Authority selects the whole tree.** `defaultUserMenuMap.get(authState.authUser.authority)`.
   A CUSTOMER_USER's menu is a *separate, much smaller literal* (`:1035–1077`) — Home, Monitor
   (Dashboards, Alarms, Notification inbox), Entities (Devices, Assets, Entity views), Edge
   instances. It shares no data with the TENANT_ADMIN tree.
2. **`menuFilters`** (`:839–860`) — a `Map<MenuId, MenuFilter>` of `(authState) => boolean`
   predicates applied by `filterMenuReference()` (`:1108`). This fork carries a local
   `unavailableOffline` filter hiding 11 ids that cannot work on the air-gapped demo (iot_hub,
   repository/auto-commit settings, mobile centre, OAuth2 domains/clients, gateways), plus three
   `edgesSupportEnabled` predicates.

`filterMenuReference()` also has a **cascade rule** that is easy to destroy: if a reference has
`pages` and *every* page is filtered out, the parent is hidden too (`:1112–1116`).

> **This cascade is the primary AC-36 hazard.** Flattening a `toggle` whose children were all
> filtered turns a correctly-hidden group into visible orphan rows. Concretely: a TENANT_ADMIN's
> `mobile_center` has all three children filtered by `unavailableOffline`, so today the whole group
> vanishes. Flatten it naively and three dead rows appear. The design handles this in §4.3.

### 2.3 The render path

`side-menu.component.html:21–31` is a three-arm `@switch` on `section.type` — `link` →
`tb-menu-link`, `toggle` → `tb-menu-toggle`, `divider` → `mat-divider`. A type with no arm renders
**nothing, silently** — no error, no warning. That is the failure mode to design against.

### 2.4 The flyout mechanism already exists — and already has the hover bridge

This is the most valuable finding, and it directly retires the D1 risk.

`menu-toggle.component.html:23–30` already opens a CDK-overlay flyout on hover when collapsed:

```
tb-popover  [tbPopoverTrigger]="collapsed ? 'hover' : null"
            [tbPopoverMouseLeaveDelay]="0.05"  [tbPopoverMenu]="true"
            [tbPopoverPlacement]="'rightTop'"
```

And `popover.component.ts:186–210` registers `mouseenter`/`mouseleave` **on the overlay element as
well as the trigger** — i.e. the hover bridge D1 asks for is already implemented. `HANDOFF.md` §8.6's
abandoned attempt failed because it tried a pure CSS `:hover` *expansion of the rail*, which is a
different mechanism. **We are not building a hover-intent system; we are reusing one and correcting
its delay.**

Two real defects in that existing code shape the plan:

- **Delay too short.** `mouseLeaveDelay = 0.05` is 50 ms — D1 requires ~300 ms. `delayEnterLeave()`
  (`:274`) multiplies by 1000, so the value is seconds: **0.3**.
- **Bridge listeners are registered lazily inside the trigger's own `mouseleave` handler**
  (`:196–208`), guarded by `if (this.component?.overlay.overlayRef && !overlayElement)`. On the very
  first pointer exit the overlay listeners are attached *in the same tick as* the close timer starts.
  This is fragile but functional; the plan verifies it behaviourally rather than assuming it.

### 2.5 Where menu colour is decided (the specificity map)

Four layers currently write menu colour. The previous work item lost three rounds here, so this is
stated as an ownership table rather than prose — see §7.

- `side-menu.component.scss` — geometry + colour, `:host ::ng-deep a.mat-mdc-button…` (no `!important`)
- `menu-link.component.scss` / `menu-toggle.component.scss` — `is-new` badge, toggle chevron, flyout
- `styles.scss:1651–1692` — the Shell-C block, `.tb-default .tb-site-sidenav …`, **all `!important`**
- `styles.scss:1428/1478` — the two token blocks (light / dark)

The Shell-C block wins today: `.tb-default .tb-site-sidenav a.mat-mdc-button.tb-active` is (0,4,1)
**and** `!important`, versus the component style's (0,2,1) non-important.

### 2.6 Alarm count: the endpoint D5 names does not exist as a count endpoint

Verified: `AlarmController.java` exposes no `/alarm/count`. `alarm.service.ts` has no count method.
What does exist is `GET /api/v2/alarms` returning `PageData<AlarmInfo>`, and `PageData` carries
**`totalElements`** (`page-data.ts:20`). So the count is obtained by asking for **one row** and
reading `totalElements` — a single cheap request, which satisfies D5's intent exactly. §5 specifies it.

### 2.7 Favicon — already correct

Verified independently by parsing the ICO directory: `ui-ngx/src/airlinq.ico` is 6419 bytes with
**4 frames — 16×16, 32×32, 48×48, 64×64**. `index.html:26` is
`<link rel="icon" type="image/x-icon" href="airlinq.ico">` with no `sizes`. **Nothing is redone.**

---

## 3. Alternatives considered

### 3.1 The section heading (chosen: A)

- **A — new `'section'` member on `MenuSectionType`.** Explicit; the `@switch` gains one arm; a
  heading is a heading in the data. Costs a union edit and a fork-local template arm.
- **B — reuse `'divider'` and hang a label off it.** No union change, but overloads a type that means
  "horizontal rule", and `menuSectionToHomeSection()` would need a guard anyway. Rejected: implicit.
- **C — keep `toggle` and force `opened: true`, styling the header as a label.** No model change at
  all, but the header stays a *button* that can still collapse, breaking AC-12 (one click) and AC-11
  (chevron only on true sub-menus). Rejected: it does not deliver the requirement.

**Chosen A.** It is the only option where "this row is a heading" is representable, and the failure
mode (missing `@switch` arm → silent blank) is caught by the first verification step.

### 3.2 Hover-intent flyout (chosen: A)

- **A — reuse `tb-popover` with `mouseLeaveDelay: 0.3`.** Zero new dependencies, bridge already
  implemented, keyboard/Escape already handled by CDK, matches the existing user-menu pattern.
- **B — hand-rolled CDK overlay with custom enter/leave timers.** Full control, but re-implements
  focus trapping, Escape, repositioning and teardown — all of which `tb-popover` already does, and
  all of which are exactly where an a11y regression would hide. Rejected: cost with no gain.
- **C — CSS `:hover` rail expansion.** Already tried and abandoned (`HANDOFF.md` §8.6). Cannot
  survive the 20 px gap. Rejected on evidence.

**Chosen A.**

### 3.3 Alarm count transport (chosen: A)

- **A — `getAllAlarmsV2` with `pageSize: 1`, read `totalElements`, `shareReplay(1)`, 60 s timer.**
  One request per minute for the whole app regardless of how many rows subscribe.
- **B — websocket subscription.** Explicitly excluded by D5.
- **C — count in each menu row.** Would issue one request per row. Explicitly excluded by D5.

**Chosen A.**

---

## 4. Unit 1 — the menu model reshape (highest risk)

### 4.1 The type change

`menu.models.ts:21`:

```ts
export declare type MenuSectionType = 'link' | 'toggle' | 'divider' | 'section';
```

`'section'` means: a non-interactive uppercase group label. It is **not** focusable, has no `path`,
no `icon` and no `routerLink`. It is rendered by a new `@switch` arm in
`side-menu.component.html`.

Three consumers must be checked because they branch on `type`:

| Consumer | Today | Required change |
|---|---|---|
| `side-menu.component.html:21` | `@switch` on 3 arms | add a 4th arm for `'section'` |
| `menu.service.ts:80` `updateOpenedMenuSections()` | filters `type === 'toggle'` | none — `'section'` is simply never matched |
| `menu.models.ts:1122` `menuSectionToHomeSection()` | handles `'link'` and `'toggle'` | none — returns `undefined` for `'section'`, and `buildUserHome()` already `.filter(s => !!s)`. **Verify, do not assume.** |

`menu.service.ts:87` `allMenuLinks()` collects only `type === 'link'`, so headings never pollute
link lookups. `allMenuSections()` collects everything — headings will appear in
`_availableMenuSections`, which is only used for active-state matching by `path`; a heading has no
`path`, so it can never match. Benign, but stated so the reviewer does not flag it.

### 4.2 The target shape (TENANT_ADMIN)

Section labels, in order (AC-5), each a `'section'` entry in `defaultUserMenuMap`:
**Monitor → Devices & assets → Operations → Administration**, with **Home above the first label and
no label of its own** (AC-6).

`toggle` is retained for **exactly five** true sub-menus (AC-11): **Profiles, Data processing,
Resources, Security, Platform**. Everything else becomes a `link`.

| Section | Rows | Type |
|---|---|---|
| *(no label)* | Home | link |
| Monitor | Dashboards, Alarms *(badge)*, Notifications | link ×3 |
| Devices & assets | Devices, Assets, Entity views, **Profiles** | link ×3 + toggle |
| Operations | Customers & users, **Data processing**, **Resources**, **Edge management** | link + toggle ×2 + toggle |
| Administration | **Security**, **Platform** | toggle ×2 |

**D2 is honoured:** Edge management sits under Operations **immediately after Resources**.

**Profiles is a new grouping, not a new page.** Today `device_profiles` and `asset_profiles` are flat
children of the `entities` toggle (`:970–971`). Option A groups them under a `Profiles` toggle. Both
ids already exist in `menuSectionMap`; the `MenuId.profiles` id also already exists (`:96`). Only the
*reference tree* changes.

> **Out-of-scope guard:** the strings `Device profiles`, `Asset profiles` and `OTA updates` appear in
> requirement §3's Option-B exclusion list **as canvas markup strings**. That exclusion bars copying
> Option B's `.sub` accordion markup — it does **not** delete the existing `device_profiles`,
> `asset_profiles` or `otaUpdates` menu entries, which are live pages a tenant admin uses today and
> which AC-36 requires to keep working. They remain, reachable under Profiles / Devices & assets.

### 4.3 Preserving permissions exactly (AC-36) — the concrete method

Four rules, each mechanical and checkable:

1. **Never edit `menuFilters`.** Not one line. All 14 predicates stay byte-identical. This is the
   whole of the fork's offline-hiding and edge-gating behaviour.
2. **Never edit the SYS_ADMIN or CUSTOMER_USER trees beyond adding `'section'` headings.** The
   regrouping described in §4.2 is the **TENANT_ADMIN** tree. A CUSTOMER_USER's groups are a separate
   literal; touching it is how "a customer user sees exactly the pages they saw before" gets broken.
   Its headings are added, its rows are not moved.
3. **Preserve the cascade for every group being flattened.** Before flattening any `toggle` to
   `link` rows, check whether any of its ids appears in `menuFilters`. If it does, the group must
   **keep** a filtered ancestor or each promoted row must carry its own filter, otherwise
   `filterMenuReference()`'s all-children-hidden rule (`:1112`) no longer protects it.
   - `mobile_center` (all three children `unavailableOffline`) — **stays out of the sectioned tree
     entirely**, exactly as it effectively is today. It is not promoted to visible rows.
   - `edge_management` is itself filtered on `edgesSupportEnabled` (`:855`), so moving it under
     Operations as a **toggle** preserves its gating unchanged. It must **not** be flattened.
4. **Prove it, do not argue it.** The verification is a **before/after diff of the rendered row set
   per authority**, not a reading of the diff. Method in §9.1.

### 4.4 Why `MenuId` needs four new ids

Headings need ids for `@for(track section.id)`. Add to the `MenuId` enum and `menuSectionMap`:
`monitor_label`, `devices_assets_label`, `operations_label`, `administration_label` — each
`type: 'section'`, `path: ''`, `icon: null`.

i18n (verified against `locale.constant-en_US.json`):

| Label | Key | Status |
|---|---|---|
| Monitor | `monitor.monitor` | **exists** → "Monitor" |
| Devices & assets | `entity.devices-and-assets` | **exists** → "Devices & assets" |
| Operations | `admin.operations` | **NEW** → "Operations" |
| Administration | `admin.administration` | **NEW** → "Administration" |

Exactly two new keys, added to `locale.constant-en_US.json` only (all 28 locales fall back to en_US).
AC-5's "all four go through translation keys, not literals" is satisfied.

---

## 5. Unit 2 — alarm count service (D5)

### 5.1 Shape

New file `ui-ngx/src/app/core/services/alarm-badge.service.ts`, `providedIn: 'root'`, exposing one
observable:

```ts
readonly activeAlarmCount$: Observable<number>
```

- **Source.** `AlarmService.getAllAlarmsV2()` with an `AlarmQueryV2` over a `TimePageLink` of
  `pageSize: 1`, `statusList: [AlarmSearchStatus.ACTIVE]`, no entity filter. Read `.totalElements`.
  A single request returning a single row; the count is metadata, not the payload.
- **Cadence.** `timer(0, 60_000)` — immediate first value, then every 60 s (D5).
- **Sharing.** `shareReplay({bufferSize: 1, refCount: true})`. One upstream subscription no matter
  how many rows subscribe. This is the "SINGLE request" guarantee — the badge (AC-13/14) and the
  rail dot (AC-22) are two subscribers to one stream.
- **Gating.** `switchMap` off `selectIsAuthenticated`; emits `0` and issues no request when not
  authenticated. Prevents a 401 storm on the login page.
- **Stops when hidden.** Gate the timer on `document.visibilityState`, so a backgrounded tab issues
  no requests. The demo server is a single small VM — this is a load requirement, not a nicety.
- **Errors are silent.** `catchError(() => of(0))` **inside** the `switchMap`, so a failed poll
  yields 0 for that tick and **the timer keeps running**. `catchError` on the outer stream would kill
  the timer permanently on the first blip. `{ignoreErrors: true}` on the `RequestConfig` suppresses
  the global error toast — a menu badge must never raise a dialog.

### 5.2 Consumption

`MenuLinkComponent` gets an optional `@Input() badgeCount: number | null`. The **side-menu**
subscribes once via the `async` pipe and passes the value down; the link component itself does not
inject the service. This keeps the count out of `OnPush` change-detection edge cases and keeps
`tb-menu-link` a presentational component.

Which row gets the badge is **data, not a hard-coded check in the template**: add an optional
`badge?: 'alarmCount'` field to `MenuSection`, set it on the `alarms` definition. No `id === 'alarms'`
string comparison in a template.

### 5.3 Accessibility of the count

The badge is a number, so it reads. The **rail dot conveys meaning by colour and position alone**
(AC-22), which fails the a11y requirement. The dot therefore carries a visually-hidden text
alternative and the tile's `aria-label` is extended with the count, so the state is announced. See
§6.4.

---

## 6. Unit 3 — rail flyout (D1)

### 6.1 Mechanism

Reuse `tb-popover`, as in §2.4. Concretely:

- **`link` rows in the rail have no flyout.** A `link` navigates on click; that is AC-12, and AC-28
  is about *sections*. Only the rail's **section tiles** open flyouts.
- **The rail's tile set is one tile per section plus Home (AC-21)** — not one tile per page. This
  means the collapsed rail renders from the **section** entries, whose `pages` are the section's rows.
  The flyout content is exactly those rows (AC-28).
- **Delays.** `[tbPopoverMouseEnterDelay]="0.1"` (a little intent, avoids flicker when sweeping the
  rail) and `[tbPopoverMouseLeaveDelay]="0.3"` — the ~300 ms D1 requires, in the seconds unit
  `delayEnterLeave()` expects.
- **The gap is bridged by the overlay listeners already present** (`popover.component.ts:198–208`).
  Nothing new is written for the bridge; it is **verified**, because "present in the file" is not
  "works in the browser" (team memory).

### 6.2 Click and hover must not double-toggle

`tb-popover`'s trigger registration is **exclusive** — `registerTriggers()` (`:186–224`) attaches
`mouseenter/mouseleave` **or** `click`, never both. So a naive "hover plus click" would need
`trigger: 'hover'` *and* a separate `(click)` handler, and the click handler would fire while the
hover popover is already open — the classic double-toggle.

**Resolution:** keep `[tbPopoverTrigger]="collapsed ? 'hover' : null"` and, for the click path, call
the popover's own API from a `(click)` handler that first tests visibility, mirroring the existing
`toggleSection()` pattern:

```ts
onTileClick(event: MouseEvent, popover: TbPopoverDirective) {
  event.preventDefault();
  event.stopPropagation();
  popover.component?.tbVisible ? popover.hide() : popover.show();
}
```

Because `show()`/`hide()` are idempotent and the hover timer is cleared by `delayEnterLeave()`'s own
`clearTogglingTimer()`, a click while hover-open closes cleanly instead of re-opening.

### 6.3 Keyboard access must not regress (D1, explicit)

Today the rail tile is an `<a mat-button>` — natively focusable, in tab order, activatable by Enter.
That must survive. Required behaviour:

- **Tab** reaches every rail tile and every expanded-menu row in DOM order. Section **headings are
  skipped** — they are not focusable (correct: they are labels, not controls).
- **Enter / Space** on a section tile opens the flyout (same handler as click).
- **Escape** closes it and returns focus to the tile. CDK's overlay keyboard dispatcher already
  delivers Escape; the requirement is that focus **returns**, which is asserted, not assumed.
- **Arrow Up/Down** move between rows inside an open flyout. `[tbPopoverMenu]="true"` renders the
  content as a menu; the rows are `<a mat-button>` and are focusable in order.
- **Focus must not be trapped.** Tabbing past the last flyout row closes the flyout and continues.
- **The user block** stays keyboard-reachable and its popover still opens on Enter (AC-18).
- **Focus-visible rings** on every row, tile, the pin control and the user block — never removed,
  and never rendered only as a colour change.

### 6.4 ARIA

- Rail section tile: `role="button"`, `[attr.aria-haspopup]="'menu'"`,
  `[attr.aria-expanded]="popover.component?.tbVisible ? 'true' : 'false'"`, `[attr.aria-label]` = the
  translated section name (the tile has no visible text).
- Flyout container: `role="menu"`; rows `role="menuitem"`.
- Expanded menu: the `<ul class="tb-side-menu">` already sits in `role="navigation"`
  (`home.component.html:43`). The active row carries **`aria-current="page"`**.
- Section headings: rendered with `role="presentation"`; the grouping is conveyed to assistive tech by
  wrapping each section's rows in a `<ul>` with `[attr.aria-label]` = section name.
- **The badge and the dot must not convey meaning by colour alone.** The badge is a number (reads on
  its own). The dot gets a visually-hidden span carrying the count, so "5 active alarms" is announced
  rather than a bare coloured circle.

---

## 7. Specificity plan — which layer owns which declaration

The previous work item lost three rounds here. The rule for this one: **one owner per declaration,
and prefer matching selector depth over escalating `!important`.**

| Declaration group | Owner | Selector / depth | `!important`? |
|---|---|---|---|
| All colour **values** (both themes) | `styles.scss` token blocks `:1428` / `:1478` | `.tb-default` / `.tb-dark` (0,1,0) | n/a — custom props |
| Panel shell: 250/64 px, 16 px radius, shadow (AC-1/19) | `home.component.scss` | already correct, **unchanged** | no |
| Row/tile **geometry**: 40 px, margins, radius, gaps, icon size, fonts (AC-7/20/27) | `side-menu.component.scss` | `:host ::ng-deep` (0,2,1) | no |
| Section-label typography (AC-4) | `side-menu.component.scss` | `:host ::ng-deep .tb-menu-section` | no |
| Badge + rail dot (AC-13/22) | `menu-link.component.scss` | `:host ::ng-deep` | no |
| Flyout panel + rows (AC-25/26/27) | `menu-toggle.component.scss` | `.tb-toggle-menu-items` (global — overlay is outside the host) | no |
| Row **colour**: idle / hover / active pill (AC-8/9/10/24) | **`styles.scss` Shell-C block `:1660–1690`** | `.tb-default .tb-site-sidenav a.mat-mdc-button…` (0,4,1) | **yes — already** |
| Rail-tile **lift** (D3, AC-24) | `styles.scss` Shell-C block | must match the existing (0,4,1) hover selector | yes, to match its neighbours |

**Why colour stays in Shell-C.** It already wins there with `!important` at (0,4,1). Moving it into
the component would require *beating* that block, which means either deleting the existing rules (a
regression risk to the shipped shell) or escalating. Adding the new colour rules **into the block
that already owns menu colour** is the low-risk path, and it keeps light/dark in one place.

**Why geometry stays in the component.** Nothing in Shell-C sets menu geometry, so there is no
competitor and no `!important` is needed. Adding geometry to Shell-C would spread ownership.

**The `!important` trap to avoid.** `styles.scss:1568-1573` (`.tb-widget { border: 0 !important }`)
is evidence this codebase has global `!important` traps that silently beat inline styles. The lift
(D3) uses `transform` and `box-shadow` — neither is currently declared anywhere in the sidenav
cascade, so it is a clean seam. **Verify by `getComputedStyle` after injection, never by reading
the file** (team memory).

### 7.1 D3 — the rail-tile lift

The canvas markup implements hover as background + colour only; D3 requires the lift the prose
describes. Implemented as markup + CSS:

- `transform: translateY(-1px)` plus `box-shadow: var(--aq-shadow-1)` on the hovered tile.
- Guarded so it does **not** apply to the active tile (AC-30: the active tile keeps its filled pill
  while a different tile is hovered) — the hover rule is written `:hover:not(.tb-active)`.
- `transition` on `transform, box-shadow, background-color`, and suppressed under
  `@media (prefers-reduced-motion: reduce)`.

---

## 8. Token strategy

Mapping is 1:1 by prefix: canvas `--surface-2` → app `--aq-surface-2`. Every token AC-1…AC-30 needs
**already exists in both theme blocks** — verified: `--aq-sidebar`, `--aq-surface-2`, `--aq-hover`,
`--aq-text`, `--aq-text-2`, `--aq-text-3`, `--aq-border-subtle`, `--aq-accent-container`,
`--aq-on-accent-container`, `--aq-error`, `--aq-shadow-1`, `--aq-radius-md/lg`, `--aq-rail-w`,
`--aq-rail-w-open`, `--aq-divider`.

**New tokens required: none.** If implementation proves one is genuinely needed it goes into **both**
token blocks at `:1428` and `:1478`, never one, and only inside the token-definition blocks.

**Hard constraints:**
- **No `color-mix()` may reach built CSS.** Browserslist is Chrome ≥107 / FF ≥104 / Safari ≥16;
  `color-mix` needs 111/113/16.2 and the declaration is **silently dropped**. This has bitten this
  repo before. Where the canvas implies a mix, use a pre-mixed `rgba()` token.
- **No colour literal outside the token blocks** (AC-32) — none in any `.ts` or `.html`.
- **D4:** the brand-mark hex `#3e7bff` / `#37b6c9` and the flyout shadow
  `0 8px 24px rgba(0,0,0,.25)` stay as-is, untokenised.

---

## 9. Criteria → approach table

Layer key: **TOK** token block · **CSS** stylesheet · **TPL** Angular template · **TS** TypeScript ·
**MOD** menu model · **I18N** locale file · **VER** verification only.

| AC | Layer | File(s) |
|---|---|---|
| AC-1 panel 250 px, radius, shadow, no border | CSS | `home.component.scss` (already conformant — **verify**) |
| AC-2 head 64 px, brand 24 px, wordmark 13/700/.12em | CSS | `home.component.scss`, `styles.scss` Shell-C |
| AC-3 pin 32×32, icon 16, collapses | CSS + VER | `home.component.scss`; behaviour unchanged |
| AC-4 label 11/500/.08em/uppercase, padding | CSS | `side-menu.component.scss` |
| AC-5 four labels in order, via translation keys | MOD + I18N | `menu.models.ts`; `locale.constant-en_US.json` (2 new keys) |
| AC-6 Home above first label, no label | MOD | `menu.models.ts` `defaultUserMenuMap` |
| AC-7 rows 40 px, margin/padding/radius/gap/14-500, icons 22 | CSS | `side-menu.component.scss` |
| AC-8 idle colours | CSS | `styles.scss` Shell-C |
| AC-9 hover colours | CSS | `styles.scss` Shell-C |
| AC-10 active filled pill, no inset bar | CSS | `styles.scss` Shell-C (already; **verify no bar**) |
| AC-11 chevron on exactly the 5 sub-menus | MOD + TPL | `menu.models.ts` types; `menu-toggle.component.html` |
| AC-12 one click to every non-chevron page | **MOD** | `menu.models.ts` — the headline change |
| AC-13 badge geometry + colours | CSS | `menu-link.component.scss` |
| AC-14 badge = live count, hidden at 0 | TS + TPL | `alarm-badge.service.ts`; `side-menu`/`menu-link` |
| AC-15 user block pinned, border-top, padding, ~56 px | CSS | `user-menu.component.scss` |
| AC-16 avatar 32 px circle, accent-container, 12/600 | CSS + TPL | `user-menu.component.{scss,html}` (initials) |
| AC-17 name 13/600, role 11/400, both live | CSS | `user-menu.component.scss` (bindings already live) |
| AC-18 overflow control opens existing account menu | TPL + CSS | `user-menu.component.html` — retarget existing popover |
| AC-19 rail 64 px, same shell | CSS | `home.component.scss` (already — **verify**) |
| AC-20 tiles 48×40, radius 12, icons 22, active pill | CSS | `side-menu.component.scss`, `styles.scss` Shell-C |
| AC-21 one tile per section + Home, 32×1 divider | MOD + TPL | `menu.models.ts`; `side-menu.component.html` |
| AC-22 alarm dot 6×6, `--aq-error`, positioned | CSS + TS | `menu-link.component.scss`; `alarm-badge.service.ts` |
| AC-23 avatar at rail foot, no divider | CSS | `user-menu.component.scss` |
| AC-24 tile hover + **lift** (D3) | CSS | `styles.scss` Shell-C (`transform` + `box-shadow`) |
| AC-25 flyout 220 px, padding 6, radius 12, offset 20 | CSS | `menu-toggle.component.scss` + `tbPopoverOverlayStyle` |
| AC-26 flyout section title 11/500/.08em | CSS | `menu-toggle.component.scss` |
| AC-27 flyout rows 36 px, 13/500, no icons, current row | CSS | `menu-toggle.component.scss` |
| AC-28 flyout lists that section's pages, click navigates | TPL | `menu-toggle.component.html` (already) |
| AC-29 flyout survives the 20 px gap (D1) | TS/TPL | `menu-toggle.component.html` — `mouseLeaveDelay: 0.3` |
| AC-30 active tile keeps pill while another is hovered | CSS | `styles.scss` Shell-C — hover rule uses `:not(.tb-active)` |
| AC-31 all of the above in dark | TOK | both token blocks — no `.tb-dark`-only rules |
| AC-32 no literal outside tokens, no `color-mix` | CSS | review + grep gate |
| AC-33 brand hex left as-is (D4) | — | no change |
| AC-34 zero NEW lint problems | VER | `yarn lint` before/after |
| AC-35 build succeeds, headers present | VER | `mvn install …` |
| AC-36 routes + permissions unchanged | **MOD + VER** | §4.3 rules; §9.1 differential proof |
| AC-37 screenshots, both themes | VER | `.claude/team/artifacts/…/run-<n>/` |
| **AC-38** | **human-judged — no agent check is invented for it** | — |
| AC-F1 favicon centred in tab | VER | visual check only |
| AC-F2 4 frames + reference intact | VER | **already verified**: 4 frames, `index.html:26` |

### 9.1 How AC-36 is actually proved

Not by reading the diff. **Capture the rendered row set per authority before and after**, and diff
the two sets:

1. Before any change, sign in as each of the three authorities and, in the browser console, collect
   the visible menu rows and their routes.
2. Repeat after the change.
3. The **set of `(label, path)` pairs must be identical**; only grouping and order may differ.

A pure-set comparison is the only check that catches both a lost page and an appeared-orphan row
(the `mobile_center` hazard in §4.3). The customer user is the case that matters most.

---

## 10. Security considerations

Flagged explicitly per the standing rule, even though this is a UI work item.

- **No new auth, no new secret, no new input surface.** No endpoint is added; the only network call
  is a `GET` on an existing, already-authorised endpoint.
- **No sensitive data logged.** The alarm poll must not log responses. Alarm payloads can carry
  device and tenant identifiers.
- **The badge is a count, not a payload.** Requesting `pageSize: 1` means one alarm row crosses the
  wire per minute; the design uses only `totalElements`. Do not widen the page size "for reuse".
- **Authorisation is the server's, unchanged.** `/api/v2/alarms` is already tenant/customer-scoped
  server-side; a customer user's count is their own. The UI adds no filtering that could be mistaken
  for a control.
- **401 handling.** The poll is gated on `selectIsAuthenticated` and errors are swallowed to `0`, so
  an expired session shows no count rather than triggering a redirect loop or an error dialog from a
  background timer.
- **ADR 0002 rules apply to all new markup:** no entity-derived value interpolated into generated
  markup, no `style=""`, nothing through `bypassSecurityTrustHtml`. The user's display name and the
  avatar initials render through Angular interpolation, which escapes.
- *(Standing, untouched: the HIGH XSS finding at `alarm-table-config.ts:213-225` is pre-existing
  upstream and out of scope for this work item — it remains open.)*
- **No new dependency** — nothing added to the supply chain; no pinned version changes.

---

## 11. Code vs config split

**This work item is entirely code**, in contrast to the previous one. Every deliverable lives in
`ui-ngx/src/` and ships in the bundle:

- `ui-ngx/src/app/core/services/menu.models.ts` — model (MOD)
- `ui-ngx/src/app/core/services/alarm-badge.service.ts` — **new file** (TS)
- `ui-ngx/src/app/modules/home/menu/*.{ts,html,scss}` — render + flyout
- `ui-ngx/src/app/shared/components/user-menu.component.{html,scss}` — foot block
- `ui-ngx/src/styles.scss` — Shell-C block + token blocks
- `ui-ngx/src/assets/locale/locale.constant-en_US.json` — 2 keys

**Nothing is server-side.** No schema change, no migration, no `thingsboard.yml` key, no dashboard
JSON, no tenant data. The demo server needs only a redeployed bundle. **No database migration is
involved, so the versioned-migration rule is not engaged.**

The one server-side *dependency* is read-only and pre-existing: `GET /api/v2/alarms` must be
reachable for the badge to show a non-zero number. If it is not, the badge shows nothing and the
rest of the menu is unaffected.

---

## 12. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | **Model reshape hides or reveals a page for some authority** (AC-36) | Medium | **High** — a customer sees a page they must not, or loses one | §4.3's four rules; §9.1 differential row-set proof for all three authorities; reshape is early so it fails fast |
| R2 | **Flatten breaks the all-children-filtered cascade** → dead rows on the offline demo | Medium | High | Never flatten a group whose ids appear in `menuFilters`; `mobile_center` stays out; `edge_management` stays a toggle |
| R3 | **New `'section'` type renders nothing** — `@switch` has no arm, fails silently | Low | High | The arm is added in the same step as the union; first verification is visual, not structural |
| R4 | **Flyout still collapses across the 20 px gap** (repeat of §8.6) | Low | Medium | Bridge already exists in `popover.component.ts:198`; `mouseLeaveDelay: 0.3`; verified **in the browser**, not by reading |
| R5 | **Hover + click double-toggle** on rail tiles | Medium | Low | §6.2 — exclusive trigger + visibility-tested click handler |
| R6 | **Specificity: new rules never apply** (three rounds lost last time) | Medium | Medium | §7 ownership table; colour into the block that already owns it; prove by `getComputedStyle` injection |
| R7 | **Alarm poll adds load to a single small VM** | Low | Medium | One shared request/60 s via `shareReplay(refCount)`; paused when hidden; gated on auth |
| R8 | **Poll dies permanently on first error** | Medium | Low | `catchError` **inside** `switchMap`, never outside |
| R9 | **Keyboard access regresses** (D1 explicit) | Medium | Medium | §6.3 checklist verified per-key; tiles stay native `<a>` |
| R10 | **`color-mix()` slips into built CSS** — silently dropped | Low | Medium | §8 ban + grep the built bundle, not the source |
| R11 | **Rebase conflict** — fork-local edits to upstream menu files | High | Low | ADR 0001 governs; edits additive and marked; accepted cost |
| R12 | **"Looks the same" a third time** | Low | High | Plan ordered by visible impact; sections + badge land before polish |

**Headline risk: R1.** Everything else is recoverable in a redeploy; R1 is the only one that can put
a page in front of a user who should not see it.

---

## 13. Rollback

Every change is one bundle. There is no data migration and no server state, so rollback is a
redeploy of the previous artifact — the procedure already used three times (`HANDOFF.md` §4.2:
tar backup, previous RPM kept at `/tmp/thingsboard.prev.rpm`, `rpm -Uvh --force`).

Per-unit rollback, should only one unit misbehave:

- **Unit 2 (badge)** — remove the `badge` field from the `alarms` definition. Service becomes
  unsubscribed; no request is issued. No other criterion depends on it.
- **Unit 3 (flyout)** — revert `mouseLeaveDelay` to `0.05` and drop the click handler; the flyout
  returns to today's behaviour.
- **Unit 4 (visuals)** — revert the SCSS hunks; the model still works.
- **Unit 1 (model)** — revert `defaultUserMenuMap` and the union member together. **The `@switch`
  arm must be reverted with it**, or headings vanish while their rows remain grouped oddly.

Units 2–4 are independently revertible; Unit 1 is the atomic one.

---

## 14. ADR

One decision here is durable and worth recording: **the menu model gains a section-heading type and
the TENANT_ADMIN tree is reshaped from accordions to sections.** That changes a structure every
future menu change touches, and it is a fork-local divergence from upstream ThingsBoard.

→ **`docs/adr/0003-sectioned-menu-model.md`** (next number; current highest is 0002). MADR short form.

The hover-intent mechanism does **not** need its own ADR: it reuses an existing component with a
changed constant, which is an implementation choice, not an architectural contract.

---

## 15. Open question for the human at G2

**Q-A. The 250 px panel now has more rows than before.** Option A trades depth for length: a tenant
admin sees ~13 rows plus 4 headings where today they see 9 collapsed groups. The canvas notes
acknowledge this ("Longer list, scrolls on short screens"). The scroll container already exists
(`home.component.html:44`), so nothing breaks — but at 1000 px height the Administration section may
sit below the fold, while the user block stays pinned. **Confirm this is acceptable, or say whether
sections should collapse when the viewport is short.** The design assumes acceptable (matching the
canvas) and does nothing adaptive.

Everything else is settled by D1–D6 and is not re-opened.
