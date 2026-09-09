# Design — Left-menu defect fixes (blue theme)

- **Work item:** `left-menu-defect-fixes`
- **Status:** G2 — awaiting human approval (via Jarvis)
- **Date:** 2026-09-08
- **Author:** technical-architect
- **Input contract:** `docs/requirements/left-menu-defect-fixes.md` (G1 APPROVED, 32 acceptance criteria)
- **Baseline commit:** `d2263de9da` ("style(ui): recolour light theme to the Airlinq Blue product palette")
- **Related ADRs:** 0001 (template/TS edits in the fork), 0003 (sectioned menu model — **reversed by this item**), 0004 (theme-scoped chrome rules)

---

## 0. Executive summary

Four defects. Three are single-surface layout defects; the fourth reverses ADR 0003's
Option A and is the only one that can take the whole menu down.

Source verification changed the diagnosis on two of the four. The requirement's D2/D3
hypotheses named the cascade as the mechanism. It is not, in either case — both are
**Material's own button DOM**, which is a stronger and more precisely fixable finding:

| Defect | Requirement's hypothesis | Verified mechanism | Layer |
|---|---|---|---|
| D1 | same-file specificity loss (0,4,2) vs (0,5,2) | **CONFIRMED exactly as stated** | CSS only |
| D2 | badge stretched by the button's flex line | **Refined** — stretched inside `span.mdc-button__label`, a wrapper the requirement does not mention | CSS only |
| D3 | competing cascade blocks; `margin-left:auto` not landing | **Corrected** — Material *content-projects* the glyph ahead of the label. No cascade fault exists. | template (1 attribute) + CSS |
| D4 | restore `toggle` groups; sweep `.pages` | **CONFIRMED, with three new hazards** (see §5) | TS + template |

Two facts in the requirement are stale and are called out for the human in §9:
the `router-tabs.component.ts` hazard **is already fixed**, and the **"99+" cap that
ruling Q3 says to keep does not exist in the code**.

---

## 1. Impact analysis

### 1.1 Files touched

| File | Layer | Defect | Why |
|---|---|---|---|
| `ui-ngx/src/app/modules/home/home.component.scss` | stylesheet | D1 | owns `.tb-brand` (`_ngcontent-ng-c935555661`) |
| `ui-ngx/src/app/modules/home/menu/menu-link.component.scss` | stylesheet | D2 | owns the anchor + badge (`menu-link.component.html:18,33`) |
| `ui-ngx/src/app/shared/components/user-menu.component.html` | template | D3 | one attribute on `:38` |
| `ui-ngx/src/app/core/services/menu.models.ts` | TypeScript | D4 | the reference tree + type map |
| `ui-ngx/src/app/modules/home/menu/menu-toggle.component.ts` | TypeScript | D4 | unguarded `.pages.length` (§5.2) |
| `ui-ngx/src/app/modules/home/menu/menu-toggle.component.html` | template | D4 | badge propagation (§5.3) |
| `ui-ngx/src/app/core/services/menu.service.ts` | TypeScript | D4 | opened-state restore depth (§5.4) |
| `ui-ngx/src/app/modules/home/menu/menu-link.component.ts` | TypeScript | D2 | badge cap (§9.2, pending ruling) |
| `docs/adr/0003-sectioned-menu-model.md`, `docs/adr/0005-*.md` | docs | AC-25 | §7 |
| `docs/requirements/left-menu-and-favicon.md`, `docs/design/left-menu-and-favicon.md` | docs | AC-25 | §7 |

**Not touched:** `styles.scss` (no token value changes — AC-28; no edit inside the frozen
`.tb-dark` block — AC-26), `side-menu.component.scss`, `user-menu.component.scss`,
`menuFilters` (ADR 0003 constraint 3 survives the reversal), `router-tabs.component.ts`
(already guarded — §9.1).

### 1.2 Data model impact
None. No DB schema change, no upgrade script, no DDL. `MenuSectionType` is a
client-side TypeScript union; `openedMenuSections` is an existing user-preference key
already persisted through `ActionPreferencesUpdateOpenedMenuSection`. The overlay's
versioned-migration mechanism (`dao/src/main/resources/sql/` + `application/src/main/data/upgrade/`)
is **not engaged** by this work item.

### 1.3 API contract impact
None. No REST surface, no `common/proto` message, no `*QueueFactory`. The only server
interaction in scope is the pre-existing `AlarmBadgeService` poll of
`getAllAlarmsV2` — unchanged.

### 1.4 Feature-flag needs
None new. D4's per-user open/closed state is the flag-like control and it already exists.
D4 is a data-shape change to a literal, so its rollback is a revert of one file (§8.3).

### 1.5 Backward compatibility
- **Route reachability** is the compatibility contract, not the menu shape. Every leaf
  `path` stays reachable; only its *depth in the tree* changes (AC-22).
- **Persisted user state:** `openedMenuSections` stores section `path` strings. Restoring
  `monitor` as a toggle re-introduces `/monitor`, a path that may already sit in some
  users' stored arrays from before the Option A flattening. That is benign — a stale
  entry is ignored and a matching entry simply opens the group. No migration needed.
- **Deep links** into a page nested under a restored toggle keep working:
  `updateActiveMenuSections()` recurses `.pages` and `updateOpenedMenuSections()`
  auto-opens an `active` section (§5.4).

### 1.6 Security impact
**No security-relevant change.** Stated explicitly per the hard rule, with each surface
checked rather than dismissed by category:
- **No authorization change.** `menuFilters` and `filterMenuReference()` are untouched.
  ADR 0003 constraint 3 ("`menuFilters` is not edited, not one line") remains binding
  through the reversal. Menu visibility is decluttering, not access control — the routes
  still resolve if navigated directly, and server-side entity authorization is unchanged.
- **No new input rendering.** D3 adds an `iconPositionEnd` *attribute*; it interpolates
  nothing. The user display name and authority remain Angular interpolations (escaped —
  ADR 0002). The badge count is a `number` from `PageData.totalElements`, interpolated.
- **No secrets, no logging change.** Verification harnesses must read credentials from
  the gitignored `CLAUDE.md`/`env` at runtime and must never embed them (team memory:
  a live tenant password was embedded in a CDP harness during the previous item).
- **Accessibility treated as a requirement, not a nicety:** AC-10 pins the
  visually-hidden count so alarm state is never colour-only, and D3's glyph stays
  `aria-hidden` with the parent button as the single tab stop.

---

## 2. D1 — collapsed rail shows a clipped "AIRLINQ" wordmark

### 2.1 Verified mechanism

> **CORRECTION (2026-09-08, Technical Architect).** The specificity table below is
> **INVERTED and this whole subsection's conclusion is withdrawn.** Compiling the SCSS
> shows `display: none` (the collapse rule) at **(0,5,2)** already BEATS `display: flex`
> (the blue-theme rule) at **(0,5,1)** — Jarvis verified this independently. So D1 is
> **not** a specificity contest, and Option 3 below (raise the collapse rule's depth)
> would fix nothing. The likely real mechanism is the **`gt-sm` breakpoint dropping
> `.tb-desktop`**: the collapse rule requires BOTH `.tb-desktop` AND `.tb-collapsed`, so
> it stops matching when `.tb-desktop` is absent. **D1 is now reproduce-first** — measure
> in the browser which rules match at the failing viewport before designing any fix.
> See `docs/design/left-menu-defect-fixes-d4-tree.md` §0.1 C1.

Confirmed exactly as the requirement states. Both rules are in `home.component.scss`,
which is also the owning component, so this is purely a specificity ordering problem.

Nesting traced from the file (`:host` at `:21`, `mat-sidenav-container` at `:26`):

| Rule | Compiled selector | Weight |
|---|---|---|
| collapse `:59-62` | `[_nghost-x] mat-sidenav-container.tb-desktop.tb-collapsed mat-sidenav.tb-site-sidenav .tb-brand` | **(0,4,2)** |
| blue theme `:135-147` | `[_nghost-x] mat-sidenav.tb-site-sidenav .tb-nav-header .tb-nav-header-toolbar .tb-brand` | **(0,5,2)** |

`display: flex` at (0,5,2) beats `display: none` at (0,4,2). The wordmark stays laid out
and is clipped by the 64px rail. Source order cannot save the collapse rule — it is
*earlier* in the file as well as lower in weight.

### 2.2 Options considered

**Option 1 — `!important` on the collapse rule.** Rejected outright: AC-29 forbids it, and
team memory records `!important` as the escalation that has already failed three times
here.

**Option 2 — reduce the winner's depth** by hoisting `.tb-brand` out of the
`.tb-nav-header .tb-nav-header-toolbar` nest. Rejected: it drops the blue-theme rule to
(0,3,2), which then loses to *other* rules, and it restructures a block the recolour
item shipped and verified. Large blast radius for a one-line defect.

**Option 3 (RECOMMENDED) — raise the collapse rule to out-rank the winner**, by adding
the same `.tb-nav-header .tb-nav-header-toolbar` intermediate classes the winner uses.
Nesting the collapse `.tb-brand` inside `.tb-nav-header .tb-nav-header-toolbar` yields
`…tb-desktop.tb-collapsed mat-sidenav.tb-site-sidenav .tb-nav-header .tb-nav-header-toolbar .tb-brand`
= **(0,6,2)** vs the winner's (0,5,2).

Chosen because it is the minimal edit (a two-level nest around an existing declaration),
it stays in the owning component (AC-30), it adds no `!important` (AC-29), and it resolves
the conflict by **exceeding selector depth** — exactly the remedy team memory prescribes.

### 2.3 Fix shape
Inside the existing `&.tb-collapsed { mat-sidenav.tb-site-sidenav { … } }` block at `:59`,
move the `.tb-brand { display: none }` declaration into a
`.tb-nav-header { .tb-nav-header-toolbar { .tb-brand { display: none } } }` nest. The
`.tb-nav-header-toolbar` sibling rules already in that block at `:65` stay where they are.

### 2.4 Dark safety
Structural: the rule carries no colour and no token. `display` is theme-independent, and
the selector has no `.tb-dark`/`:not(.tb-dark)` term, so it behaves identically in both
themes. AC-5 follows from the same rule applying, not from a second rule.

### 2.5 AC coverage
AC-1, AC-2, AC-3, AC-4, AC-5.
AC-2/AC-3 are *consequences* to be measured, not separately fixed: once the wordmark
leaves the layout box, the existing collapsed-head rules at `:65-80`
(`flex-direction: column; justify-content: center`) centre the 24px mark on the rail axis.
If measurement shows the centre is not 40 ± 1px, that is a **new finding**, and the
Developer must report it rather than add a nudge (plan Task 3 exit condition).

---

## 3. D2 — alarm badge renders as a tall stretched pill

### 3.1 Verified mechanism — refined from the requirement
The requirement's hypothesis (stretched to row height) is right about the *symptom* and
imprecise about the *container*. The badge is **not** a flex child of the anchor. Verified
against Material 20's own button template
(`node_modules/@angular/material/fesm2022/button.mjs`):

```
<ng-content select=".material-icons:not([iconPositionEnd]), mat-icon:not([iconPositionEnd]), [matButtonIcon]:not([iconPositionEnd])"></ng-content>
<span class="mdc-button__label"><ng-content></ng-content></span>
<ng-content select=".material-icons[iconPositionEnd], …"></ng-content>
```

`mat-button` projects **all unslotted content into a single `span.mdc-button__label`**.
`.tb-menu-badge` has no `matButtonIcon` and is not `.material-icons`, so it lands inside
that wrapper — alongside the label `<span>`.

`side-menu.component.scss:151` then styles that wrapper:

```scss
span.mdc-button__label {
  width: 100%;
  display: inline-flex;   // <- badge is a flex child of THIS
  …                       // no align-items declared -> defaults to `stretch`
}
```

and the anchor at `:104-115` sets `height: 40px; line-height: 40px`. So the wrapper is a
40px-tall flex container with the default `align-items: stretch`, and the badge — which
declares `line-height: 14px; padding: 1px 6px` but **no `height` and no `align-self`** —
is stretched to the full 40px cross size. `border-radius: 999px` renders that as the tall
blob observed. `margin-left: auto` works correctly and is not implicated.

This also explains why the badge is taller than wide: `line-height: 14px` sets the *text*
box, not the element height, so the stretched box has no width consequence.

### 3.2 Why the fix belongs in `menu-link.component.scss`
Two candidate owners, and the choice is forced by the `_nghost` rule (team memory):
`span.mdc-button__label` is generated by Material inside the anchor rendered by
**`menu-link.component.html:18`**, so its content carries menu-link's `_ngcontent`. The
badge is owned by `tb-menu-link`. `side-menu.component.scss` *can* reach the wrapper
(the `<ul>` is its own element and `::ng-deep` pierces downward from *its* host), which is
exactly why `:151` works — but `.tb-menu-badge` itself is menu-link's, and AC-30 pins the
rule to the owning component. Fixing it in `menu-link.component.scss` also keeps D2's
change from touching a file shared with the toggle rows.

### 3.3 Options considered

**Option 1 — declare `align-items: center` on `span.mdc-button__label`** in
`side-menu.component.scss:151`. Rejected: that wrapper is shared by **every** nav row
(and, per §5.3, by the toggle rows too). Changing the cross-axis alignment of a container
that also holds the ellipsising label risks a label-baseline shift on 60+ rows to fix one
chip — and it puts the rule in the non-owning component.

**Option 2 (RECOMMENDED) — constrain the badge itself:** `align-self: center` plus an
explicit `height` and `min-width`. Self-contained, one selector, zero blast radius beyond
the badge, in the owning file, no `!important`. `align-self` on the child overrides the
parent's `align-items: stretch` with no specificity contest at all — it is a different
property on a different element, so this cannot lose a cascade fight.

**Option 3 — move the badge out of the label wrapper** by giving it `matButtonIcon` or
`iconPositionEnd`. Rejected for the badge: those slots apply icon margins and sizing
intended for glyphs, and `[matButtonIcon]` would drag in icon-specific Material rules.
(This *is* the right answer for D3's glyph — §4 — because that element genuinely is an icon.)

### 3.4 Fix shape
Extend the existing `.tb-menu-badge` rule at `menu-link.component.scss:61`:

- `align-self: center` — defeats the inherited `stretch`. This is the fix proper.
- `height: 16px` — a definite cross size so the chip cannot be sized by its line box
  (satisfies AC-6's ≤ 18px with 2px of headroom).
- `min-width: 16px` — guarantees width ≥ height for a single digit (AC-6's second half).
- `box-sizing: border-box` — so the declared 16px is the painted 16px with the existing
  `padding: 1px 6px`, rather than 18px.
- `display: inline-flex; align-items: center; justify-content: center` — centres the
  digits inside a now-definite box; `line-height: 14px` alone would not.

`padding: 1px 6px` is retained, which is what makes a 2-digit badge wider than a 1-digit
one (AC-9) — the width stays content-driven above the 16px floor.

**Do not touch** `.tb-menu-dot` (`:74`), which is `position: absolute` and therefore never
a flex child. AC-10 is already satisfied by `menu-link.component.html:29-31`
(dot + `cdk-visually-hidden` count); the plan verifies it rather than changes it.

### 3.5 Dark safety
Structural: every added declaration is geometric. The badge's colours
(`--aq-accent-container` / `--aq-on-accent-container`) are untouched, so the dark
declaration set for this rule changes by geometry only and the painted colour is
byte-identical in both themes.

### 3.6 AC coverage
AC-6, AC-7, AC-8, AC-9, AC-10, AC-11.
AC-7 (no overlap with the label) follows from `flex: none` + `margin-left: auto` already
present, and must be **measured**, not assumed — the label ellipsises, so overlap is a
real possibility at narrow widths, which is why AC-7 is verified at the mobile width too.

---

## 4. D3 — user block misaligned, overflow glyph detached to the LEFT

### 4.1 Verified mechanism — the requirement's diagnosis is superseded
The requirement concludes "this is CSS, not markup", reasoning that the template order is
correct. The template order **is** correct, and the defect is still structural — because
`mat-button` does not render its children in template order.

`user-menu.component.html:38` is:

```html
<tb-icon class="material-icons tb-user-overflow" aria-hidden="true">more_vert</tb-icon>
```

That `class="material-icons"` matches Material's **first** content-projection slot,
`select=".material-icons:not([iconPositionEnd])"`, which is emitted **before**
`<span class="mdc-button__label">`. So Angular hoists the glyph to the front of the
button's flex line, ahead of the avatar and the info stack, no matter where it sits in the
source template.

This is a complete, sufficient explanation of "overflow glyph detached to the LEFT of the
avatar", and it means **no cascade fault exists**. The requirement's two suspects are both
innocent:

- The generic block at `:62` and the rail block at `:151` do not conflict on order. The
  rail block correctly overrides `padding`, `gap` and adds `align-items: center`.
- The "missing `margin-left: auto`" is real but is a *second-order* consequence: with the
  glyph projected into slot 1, a trailing-edge mechanism on it would be meaningless. Once
  the glyph is moved to the trailing slot, it still needs pushing to the trailing edge —
  and `.tb-user-info { flex: 1 1 auto }` at `:186` absorbs the free space and does exactly
  that. So `margin-left: auto` is genuinely **not required**; the mechanism is already
  present.

Verified as an established in-repo idiom, not an invention: `iconPositionEnd` is used at
9 sites in this codebase (e.g. `iot-hub-home.component.html:184`,
`dashboard-widget-select.component.html:95`).

### 4.2 Options considered

**Option 1 (RECOMMENDED) — add `iconPositionEnd` to the glyph.** One attribute. It moves
the glyph into Material's trailing slot, restoring avatar → info → glyph as the rendered
flex order. Uses the framework's own supported mechanism; needs no CSS at all for ordering.

**Option 2 — `order: 3` in CSS.** Would also reorder, and is CSS-only. Rejected: it
leaves the glyph in slot 1 in the DOM, so the **accessibility tree and the DOM order stay
wrong** while the visual order is right. AC-12 asks for "DOM/visual order", and a
CSS-`order` fix satisfies the visual half by lying about the structural half. Also,
Material's `.mdc-button__label + .mat-icon` margin rule keys off DOM adjacency, so `order`
would leave the spacing rules matching the wrong element.

**Option 3 — drop `class="material-icons"`.** Rejected: `tb-icon` needs that class for
font-glyph rendering, and removing it would break the glyph itself.

### 4.3 Why a template edit is justified under ADR 0001
ADR 0001 permits template edits "where a design requirement is unreachable in the token or
stylesheet layer", with four constraints. All four hold:

1. **Confined blast radius** — one attribute on one element in one component named in the
   approved requirement.
2. **Additive and clearly marked** — adds an attribute, restructures nothing. A rebase
   conflict on this line is resolvable by inspection. An `AIRLINQ` comment records why.
3. **Degrades to today's behaviour** — the attribute only selects a projection slot; with
   the attribute absent the component renders exactly as it does now.
4. **Layer declared up front** — template, stated here and in the plan.

And it is the *smaller* fork divergence: Option 2 would add CSS to a shared component
whose two consumers must then diverge, which is more code and more risk than one attribute.

### 4.4 The two-consumer constraint (AC-18)
`tb-user-menu` has two consumers: the rail (`.tb-site-sidenav`) and the top toolbar.
AC-18 pins the toolbar instance visually unchanged. The `iconPositionEnd` attribute is
**not** scoped — it changes projection for both.

This is expected to be safe, and for a specific reason rather than a general one: the
`.tb-user-overflow` glyph is rendered unconditionally in the template, but in the toolbar
instance the *whole `.tb-user-menu` button* is not the visible control. The component
ships two triggers — the full button (`user-menu.component.html:18-39`) and an
`mat-icon-button` (`:40-48`, `.tb-mini-avatar`) — and `user-menu.component.scss:57-59`
hides the latter (`tb-user-menu { .tb-user-menu-icon { display: none } }`) for the rail
arrangement.

**This is the single highest-risk assumption in the D1–D3 half of this design, and the
plan does not let the Developer take it on trust.** Plan Task 5 requires proving, at
runtime on the deployed toolbar, which of the two buttons is visible, and captures a
before/after screenshot pair of the toolbar instance at both widths. If the full button
*is* visible in the toolbar, the projection change moves its glyph too, and the fix must
be re-scoped — the Developer stops and returns to the architect (§8.4).

### 4.5 The remaining D3 half — alignment
AC-14 (avatar 32px, stack centred ±2px) and AC-15 (no pairwise overlap) are governed by
`user-menu.component.scss:151` onward, which already declares `align-items: center`,
`height: 32px`, `line-height: 1`, `box-sizing: content-box`, the 32px avatar with
`flex: none`, and `.tb-user-info { flex: 1 1 auto; min-width: 0 }`. On the evidence, the
"misalignment" reported in D3 is the *glyph in slot 1 consuming the leading 16px of the
flex line* and shoving everything right — i.e. **one defect with two visible symptoms**,
not two defects.

The design therefore predicts the ordering fix resolves the alignment too, and the plan
**measures rather than assumes it** (Task 5). If a residual misalignment survives, the
Developer reports the measured numbers and the architect revises — no blind nudging.

### 4.6 Dark safety
The template edit carries no colour. No `user-menu.component.scss` colour declaration is
altered — the `--aq-chrome-ink*` references shipped by the recolour item stay exactly as
they are.

### 4.7 AC coverage
AC-12 through AC-18. AC-16 (collapsed) is already handled by the
`&.tb-collapsed { justify-content: center; .mat-icon.tb-user-overflow { display: none } }`
block at `:246-259`; the plan verifies it survives the projection change, because
`justify-content: center` now centres a *different* set of flex children.

---

## 5. D4 — restore collapsible groups (Option B, reversing ADR 0003)

### 5.1 What changes in the model
Two coordinated edits in `menu.models.ts`:

**(a) The `menuSections` type map** — restore `type: 'toggle'` on the group parents Option A
flattened to `'link'`. Measured current state (read from the file): already `toggle` —
`monitor` (`:546`), `profiles`, `data_processing`, `resources`, `edge_management`,
`security_settings`, `platform_section` (7 of 10 `toggle` entries). Flattened to `link` and
needing restoration: **`notifications_center` (`:254`)**, **`mobile_center` (`:329`)**, and
**`alarms_center`** — the entries that own `pages` in the pre-reshape tree while declaring
`type: 'link'` today.

**(b) The `defaultUserMenuMap` TENANT_ADMIN tree (`:981-1084`)** — restore the nesting.

> **CORRECTION (2026-09-08, Technical Architect).** The claim that `homeMenuMap` preserves
> the target tree **"verbatim"** is **WRONG**, and the rest of this subsection is
> superseded. The Developer verified it and correctly stopped. `homeMenuMap` differs from
> the ruled target in three structural ways: it has **no `*_label` headings** (it uses
> `monitor`/`entities` toggles instead), it wraps alarms in `alarms_center`, and it keeps
> `device_profiles`/`asset_profiles` **flat inside `entities`** rather than under a
> `profiles` toggle. Combined Option B is therefore a genuine **MERGE**, not a copy, and
> `homeMenuMap` must **NOT** be edited at all (the Home cards are derived from its toggle
> structure).
>
> **The authoritative D4 tree is now specified as data, per authority, in
> `docs/design/left-menu-defect-fixes-d4-tree.md`.** Implement from that document; ignore
> the target sketch below.

The original (superseded) sketch read:

```
{id: monitor, pages: [dashboards, {alarms_center, pages: [alarms, alarm_rules]}, {notifications_center, pages: […]}]}
```

Using `homeMenuMap` as the target is what makes AC-23 (`homeMenuMap` Home guarantee
intact) and AC-19/AC-22 mutually consistent: the rail tree converges back onto the tree
the Home page never stopped using. It also means the reversal is largely a *deletion* of
Option A's divergence rather than new invention — which, per team memory, is permitted
under ADR 0001's additive clause because it removes the **fork's own** additions.

**Section headings — an explicit decision.** The four `'section'` heading entries
(`monitor_label`, `devices_assets_label`, `operations_label`, `administration_label` at
`:840-877`) and the `'section'` member of `MenuSectionType` (`:21`) are **retained**.
Rationale: with groups restored the rail is short enough that headings are no longer
load-bearing for one-click access, but they still carry the visual grouping the canvas
established for the *expanded* rail, and the type plus its `@switch` arm
(`side-menu.component.html:32-37`) are already shipped, verified and inert. Removing them
would be a second, unrequested visual change and would delete a type the CUSTOMER_USER and
SYS_ADMIN trees also use. **Recommendation: keep `'section'`; the ADR reversal is about
`link`-vs-`toggle`, not about headings.** (Flagged for the human in §9.3 — the requirement
does not rule on it.)

### 5.2 Hazard 1 — the `.pages` consumer sweep, and a correction
The requirement and team memory both name `router-tabs.component.ts:113` as the unguarded
dereference. **It is already fixed.** At `router-tabs.component.ts:118` the code now reads:

```ts
const tabs: Array<MenuSection> = found.pages?.filter(page => !page.rootOnly || isRoot) ?? [];
```

with a comment recording exactly the failure memory describes. It was repaired during the
previous work item. Memory is stale here; §9.1 flags it.

That does **not** retire the sweep — it inverts its direction. Option A flattened toggles
into pages-less links, so the hazard was *"a consumer dereferences `.pages` on something
that no longer has them"*. Option B does the reverse: it gives `pages` back and returns
sections to `toggle`. The live hazard is now **a `toggle` whose `pages` is absent or
empty**, and there is exactly such a consumer:

```
menu-toggle.component.ts:57   return this.section.pages.length * 40 + 'px';   // UNGUARDED
```

`sectionHeight()` is called from the template's `[style.height]` binding
(`menu-toggle.component.html:62`), i.e. **on every change-detection cycle**, from inside
the shared `menuSections()` pipeline — the precise shape that blanked the menu before. It
builds clean, lints clean and greps clean.

Complete enumeration of `.pages` consumers (swept across `src/app`, excluding the unrelated
`MobilePage`/`pagesForm` namespace in `mobile-layout.component.ts` and
`mobile-app.models.ts`, which is a different `pages` entirely):

| Site | Guarded? | Risk under Option B |
|---|---|---|
| `menu.models.ts:1348-1349` `referenceToMenuSection` | yes (`?.length`) | none |
| `menu.models.ts:1365-1366` `filterMenuReference` | yes (`?.length`) | **behavioural**, see §5.5 |
| `menu.models.ts:1385-1388` `menuSectionToHomeSection` | yes (`type==='toggle' && pages?.length`) | none |
| `menu.service.ts:93-94` `allMenuLinks` | yes (`&& .length`) | none |
| `menu.service.ts:104-105` `allMenuSections` | yes (`&& .length`) | none |
| `menu.service.ts:130-131` `isSectionActive` | yes (`?.length`) | none |
| `router-tabs.component.ts:118` `buildTabs` | **yes — already fixed** | none |
| `router-tabs.component.ts:155-156` `findRootSection` | yes (`?.length`) | none |
| `menu-toggle.component.html:64,78` `@for` | yes (`@for` over `undefined` renders nothing) | none |
| **`menu-toggle.component.ts:57` `sectionHeight()`** | **NO** | **blanks the menu** |

**Fix:** guard it — `(this.section.pages?.length ?? 0) * 40 + 'px'`. One line, defensive,
and correct regardless of which tree shape ships.

And because "builds, lints and greps clean" is the whole problem, the plan's proof for this
task is **a rendered all-routes sweep counting `.tb-side-menu` children > 0 on every
affected route** — explicitly not static inspection (AC-24, plan Task 6).

### 5.3 Hazard 2 — the alarm badge disappears when `alarms` is nested
`MenuId.alarms` (`:564-569`) carries `badge: 'alarmCount'`. It is currently a **top-level**
`link` in the TENANT_ADMIN tree, and `side-menu.component.html:23` passes the count:

```html
<tb-menu-link [section]="section" [badgeCount]="section.badge === 'alarmCount' ? (alarmCount$ | async) : null">
```

Under Option B, `alarms` moves to `monitor > alarms_center > alarms`, so it is rendered by
`menu-toggle.component.html:66` instead:

```html
<tb-menu-link [section]="page"></tb-menu-link>   <!-- no badgeCount binding -->
```

`badgeCount` defaults to `null` (`menu-link.component.ts:37`), so **the alarm badge
silently vanishes** — and D2, the badge fix, would then be verified against an element that
no longer renders. This interaction is not in the requirement and is a direct consequence
of D4.

**Fix:** propagate the badge in `menu-toggle`. `tb-menu-toggle` consumes the same
`alarmCount$` and passes it through on the data-driven `page.badge === 'alarmCount'`
condition — matching the existing pattern exactly, so no template compares ids (the
property comment at `menu.models.ts:35` makes that a standing constraint).

The nested-flyout rows (`menu-toggle.component.html:78-85`) are hand-written anchors, not
`tb-menu-link`, so the collapsed-rail flyout has no badge mechanism at all. AC-10 requires
the collapsed **rail icon** to carry the dot — that is the group's own tile, not a flyout
row, so it is satisfied by the toggle tile. **The plan explicitly declares the flyout-row
badge out of scope** and records it as a follow-up, rather than expanding D4 silently (§9.6).

### 5.4 Hazard 3 — Q2 ("default COLLAPSED") vs the `active` auto-open
Ruling Q2 says multi-page groups default to collapsed on first login.
`menu.service.ts:77-84`:

```ts
this.currentMenuSections.filter(section => section.type === 'toggle' &&
  (openedMenuSections.includes(section.path) || section.active)).forEach(
  section => section.opened = true);
```

Two consequences, both needing to be stated rather than discovered:

1. **`|| section.active` auto-opens the group containing the current route.** On first
   login the landing route is `/home`, a top-level `link` in no group, so no group is
   `active` and every group starts closed — **Q2 is satisfied as-is**, by the landing
   route. But navigating to `/alarms/alarms` will open `monitor`, on first login and
   forever after. That is correct, desirable behaviour (the user can see where they are)
   and *not* a violation of Q2, which governs the default state. AC-20 must be worded and
   tested accordingly or the auto-open confounds it — §9.4.
2. **The filter only walks top-level `currentMenuSections`** — it does not recurse. Under
   Option B, `alarms_center` and `notifications_center` are toggles **nested inside**
   `monitor`, so their opened state is **never restored** and they always start closed
   regardless of stored preference. Their `active` state is likewise never applied, so
   deep-linking to `/alarms/alarms` opens `monitor` but leaves `alarms_center` shut, hiding
   the active row.

**Decision:** make the restore depth-independent. Cheapest correct form reuses the
flattened list the service has *already built* one line earlier —
`this._availableMenuSections` (assigned at `:66` from `allMenuSections`) — instead of
`this.currentMenuSections`. That is a **one-identifier change** needing no new traversal:

```ts
this._availableMenuSections.filter(section => section.type === 'toggle' && …)
```

This is additive in effect (it restores more state, never less) and cannot lose state a
user had. It is also required for AC-20 to be true of nested groups.

### 5.5 The `filterMenuReference` all-children-filtered rule, re-examined
ADR 0003 constraint 4 exists because `filterMenuReference` (`:1365-1366`) hides a parent
when **all** its children are filtered out. Option A's risk was *flattening* a group whose
children were all filtered, turning a correctly-hidden group into visible dead rows.

Option B **reduces** this risk rather than raising it: re-nesting restores the
parent-hiding behaviour that flattening bypassed. Two entries need checking, not assuming:
- **`mobile_center`** — all three children (`mobile_bundles`, `mobile_apps`,
  `mobile_qr_code_widget`) are `unavailableOffline`, and `mobile_center` is *itself*
  filtered. Restoring it to a `toggle` with `pages` means it is hidden by both mechanisms.
  Correct, and the plan asserts it stays absent.
- **`edge_management`** — gated on `edgesSupportEnabled`, already a `toggle`. Unchanged.

The **pageset diff (LOST [] / GAINED [])** in the plan is what proves this per authority
rather than by argument — including the SYS_ADMIN and CUSTOMER_USER trees, which ADR 0003
constraint 5 flagged as the most likely to break.

### 5.6 Q1 — click-to-open flyouts are retained (binding)
No change. `menu-toggle.component.ts:63-70` already implements click-only
(`if (this.collapsed) { event.preventDefault(); }`, with the popover on
`tbPopoverTrigger="click"`), and the rationale is recorded in `home.component.scss:55-58`:
collapsed sections open as flyouts **outside** the rail, so a hover-expand would collapse
the moment the pointer travelled to the flyout. Hover-expand stays abandoned. The plan
asserts the mechanism is unchanged rather than editing it.

### 5.7 AC coverage
AC-19 through AC-25.

---

## 6. The code-vs-CSS split (explicit)

### 6.1 CSS-only, in the owning component
| Defect | File | Change | Owner proof |
|---|---|---|---|
| D1 | `home.component.scss` | re-nest one `display: none` to (0,6,2) | wordmark carries `_ngcontent-ng-c935555661` = home.component |
| D2 | `menu-link.component.scss` | extend `.tb-menu-badge` with 6 geometric declarations | badge rendered by `menu-link.component.html:33` |
| D3 (part) | `user-menu.component.scss` | **no change required** — `flex: 1 1 auto` at `:186` already does the trailing-edge push | — |

### 6.2 Template / TypeScript, and why each is necessary
| # | File | Edit | Why unreachable in CSS | Merge-friendliness |
|---|---|---|---|---|
| 1 | `user-menu.component.html:38` | add `iconPositionEnd` | Content **projection slot** is chosen by attribute selectors in Material's template. CSS cannot move an element between `ng-content` slots; `order` fakes the visual result while leaving DOM and a11y order wrong (§4.2). | One attribute on one line, additive. Conflict resolvable by inspection. |
| 2 | `menu.models.ts` type map | `link` → `toggle` on 3 entries | A stylesheet cannot turn a navigating link into an accordion. Same reachability finding ADR 0003 recorded — now applied in reverse. | Value edits inside a fork-owned literal. Reverting toward `homeMenuMap`'s shape **reduces** divergence from upstream. |
| 3 | `menu.models.ts` TENANT_ADMIN tree | restore nesting | Tree shape is data. | Same; converges on upstream's own shape. |
| 4 | `menu-toggle.component.ts:57` | guard `pages?.length` | Runtime null-safety. | One line, defensive, upstream-compatible. |
| 5 | `menu-toggle.component.html` | propagate `badgeCount` | The binding does not exist; CSS cannot create a data binding. | Mirrors `side-menu.component.html:23` exactly — an additive block. |
| 6 | `menu-toggle.component.ts` | inject/expose `alarmCount$` | Supports #5. | Additive member, mirrors `side-menu.component.ts:38`. |
| 7 | `menu.service.ts:79` | `currentMenuSections` → `_availableMenuSections` | Restore depth is logic. | One identifier. |
| 8 | `menu-link.component.ts` | badge cap (**pending ruling**, §9.2) | Formatting is logic. | Additive getter. |

All eight are **additive or value-level**, none restructures upstream markup, and every one
is inside a component named in the approved requirement — satisfying ADR 0001's four
constraints.

---

## 7. ADR handling — recommendation

**Recommendation: a new ADR 0005 that supersedes 0003, plus a `Superseded by` header line
edited into 0003. Do not rewrite 0003's body.**

Justification:
1. **An ADR is an immutable decision record.** 0003 records a decision that was genuinely
   taken, on stated evidence, and shipped. Editing its Decision section to say the opposite
   destroys the audit trail — the very thing AC-25 is protecting.
2. **MADR (the overlay's declared format) has a `superseded` status and a supersede link
   for exactly this case.** Amending in place is the non-idiomatic option in the format
   this repo declared.
3. **The reversal has its own context** that does not belong in 0003: a *measured*
   consequence of Option A (the collapsed rail rendered one icon per page, not one per
   group), the three hazards in §5.2–5.4, and the human's three rulings. That is a decision
   record, not a footnote.
4. **Numbering is safe:** highest existing is 0004, so 0005 is `max + 1` with no retired
   number reused.

**What ADR 0005 must say** (drafted in full in the plan, Task 10):
- **Reversed:** Option A, "sectioned / every page one click away", chosen at the previous
  item's G1.
- **Why:** on the **collapsed** rail, flattening produced **one icon per page instead of
  one per group**. That does not scale (the rail becomes a long undifferentiated icon
  column as pages are added) and it **loses the group affordance** — the collapsed rail
  could no longer show which pages belonged together, and the flyout, which is the
  collapsed rail's only way to express a group, had nothing to show. Option A optimised
  the expanded rail and silently degraded the collapsed one, which is the state the rail
  ships in most of the time.
- **What replaces it:** multi-page groups are `toggle` parents again (Option B). Collapsed
  rail = one icon per group + click-to-open flyout (ruling Q1). Groups default
  **collapsed** on first login, per-user state persists via `openedMenuSections` (ruling Q2).
- **What of Option A's rationale still stands** — this matters, and it is most of it:
  - The **reachability finding** (no stylesheet can invent a heading the data has no type
    for, nor turn an accordion into a link) is **fully vindicated** — it is the same
    argument this design uses in reverse, in §6.2.
  - **`'section'` is kept.** The heading type was a genuine gap in the model and stays
    useful for grouping the expanded rail (§5.1).
  - **Constraint 3 (`menuFilters` untouched, not one line) remains binding** and is
    honoured by this reversal.
  - **Constraint 4 (never flatten a group with filtered children)** is honoured *a
    fortiori* — Option B stops flattening altogether (§5.5).
  - **Constraint 6 (equivalence is proved, not argued)** is carried forward and
    strengthened into the pageset diff and the rendered route sweep.
  - **Constraint 2's "five true sub-menus" is what is actually overturned** — the
    link/toggle assignment, nothing else.
  - The recorded **silent failure mode** (a `MenuSectionType` value with no `@switch` arm
    renders nothing, with no error) stands as a live warning, and is why `'section'` keeps
    its arm.

**Also per AC-25**, the same superseding note (short form, pointing at ADR 0005) is added
to `docs/requirements/left-menu-and-favicon.md` and `docs/design/left-menu-and-favicon.md`,
so all three documents agree and none is left contradicting the code.

---

## 8. Risk, sequencing, rollback

### 8.1 Risk ranking
| Rank | Defect | Worst case | Why |
|---|---|---|---|
| **1 (highest)** | **D4** | **Blanks the entire side menu on affected routes**, while building/linting/grepping clean | Touches the shared `menuSections()` pipeline; `menu-toggle.component.ts:57` is unguarded; can silently drop the alarm badge (§5.3) and lose routes (AC-22) |
| 2 | D3 | Toolbar `tb-user-menu` regresses (AC-18) — a *second* surface, unscoped | Projection change is not scopeable per consumer; rests on the assumption in §4.4 |
| 3 | D2 | Badge geometry wrong at some width; label overlap at mobile | Contained to one element; winning rule needs runtime confirmation |
| **4 (lowest)** | D1 | Wordmark still shows, or the mark mis-centres | Single declaration, single file, structurally theme-safe |

### 8.2 Task order and its rationale
Ascending risk, so every high-risk change lands on a verified base — and D2 before D4,
because D4 relocates the very element D2 fixes:

`Task 1 baseline → 2 lint baseline → 3 D1 → 4 D2 → 5 D3 → 6 D4 pages sweep + guard →
7 D4 model reshape → 8 D4 badge propagation + opened-state → 9 cross-cutting proofs →
10 ADR 0005 + doc supersede notes`

- Baseline **first**: nothing is verifiable without it (Task 1).
- D1 first among fixes: lowest risk, and it exercises the screenshot harness cheaply.
- D2 **before** D4 so the badge is proven correct while `alarms` is still top-level; D4
  then re-verifies it in its new position (guarding against §5.3 regressing it).
- D4's **guard lands before the model reshape** (Task 6 before Task 7) so the reshape
  cannot blank the menu even transiently.
- Cross-cutting proofs last, over the full stack of changes.

### 8.3 Rollback per task
Every task is a one- or two-file revert with no data migration, no schema change and no
deploy — the strongest rollback position available:
- T3 / T4: `git checkout -- <one .scss file>`.
- T5: revert one attribute in `user-menu.component.html`.
- T6: revert one line in `menu-toggle.component.ts` (re-exposes the latent bug but restores
  prior behaviour exactly).
- T7: `git checkout -- ui-ngx/src/app/core/services/menu.models.ts`. **This is the emergency
  stop for D4** — the tree is one literal in one file, so reverting it restores Option A's
  menu wholesale, independently of Tasks 6/8.
- T8: revert `menu-toggle.component.{ts,html}` + one identifier in `menu.service.ts`.
- T10: docs only.

### 8.4 Confirm-then-fix, not fix-blind
D2 and D3's winning rules are **not confirmed at runtime**. §3.1 and §4.1 are read from
source and from Material's shipped template — strong evidence, but per team memory ("assert
`getComputedStyle`, and prove any specificity diagnosis by INJECTION — never by reading the
file"), source reading is a hypothesis. So Tasks 4 and 5 each **open with a runtime
confirmation step and a stop condition**: if the measured winning declaration is not the one
this design names, the Developer records the measurement and returns to the architect for a
plan revision. They do not redesign silently, and they do not apply the fix to an
unconfirmed diagnosis.

---

## 9. Items needing the human's decision, and AC wording problems

Raised rather than designed around.

### 9.1 Team memory is stale on `router-tabs.component.ts` (informational)
The unguarded `.pages` dereference memory and the requirement both cite **is already
fixed** (`:118`, `?.` + `?? []`, with an explanatory comment). No action needed in this item
beyond the plan's sweep; Jarvis should prune/update that memory line. The hazard *class* is
real and now lives at `menu-toggle.component.ts:57` (§5.2).

### 9.2 **Ruling Q3 refers to a "99+" cap that does not exist** — decision needed
Q3 says "keep the '99+' cap" and AC-9 requires 1-digit and 2-digit badges. Verified: there
is **no cap anywhere**. `AlarmBadgeService.activeAlarmCount$` emits raw
`PageData.totalElements` (`alarm-badge.service.ts:70-81`) and `menu-link.component.html:33`
interpolates it unformatted. A 3+ digit count renders in full and will widen the chip past
the row.

The ruling was presumably made from the deployed appearance (the demo's active alarm count
is currently ≤ 2 digits, so no cap has ever been exercised). **Two options:**
- **(a) Implement the cap** — a `badgeLabel` getter in `menu-link.component.ts` returning
  `count > 99 ? '99+' : String(count)`. Small, additive, makes AC-9's implied ceiling real
  and bounds the badge width. **Recommended.**
- **(b) Record explicitly that there is no cap** and reword Q3/AC-9.

The plan carries (a) as **Task 4, Step 8, marked BLOCKED pending this ruling**, so it can be
dropped without disturbing the rest of the task.

### 9.3 Should the `'section'` headings survive the reversal? — decision needed
The requirement reverses `link`→`toggle` but is silent on the four `'section'` heading rows
and the `MenuSectionType` member. §5.1 **recommends keeping them** (they still group the
expanded rail; they are already shipped and inert; the type is used by all three authority
trees). If the human wants the pre-Option-A rail restored exactly, that is a further
deletion and should be said now — it changes AC-19's expected model and the pageset diff's
expected output.

### 9.4 AC-20 is confounded as written — reword recommended
AC-20: "clicking a group header toggles its children open/closed, and the open/closed state
persists across a route change". `menu.service.ts:81`'s `|| section.active` clause
**auto-opens** the group containing the current route. So closing `monitor` and then
navigating *to a page inside `monitor`* correctly re-opens it — and a literal reading of
AC-20 would score that as a failure. Suggested wording: *"…persists across a route change
that lands outside the group; a group containing the active route is expected to
auto-open."* This is a test-design correction, not a behaviour change.

### 9.5 AC-23's Home guarantee is stronger than it reads (informational, no action)
AC-23 is **structurally guaranteed**, not merely testable: `buildUserHome` reads
`homeMenuMap` exclusively (`menu.models.ts:1335-1340`), a map this work item does not touch.
The plan still runs the 3-authority snapshot diff (expected **empty**) because a structural
argument is not a measurement — but the risk here is genuinely low.

### 9.6 The collapsed-rail flyout rows carry no badge — scope confirmation
`menu-toggle.component.html:78-85` renders flyout rows as hand-written anchors, so a nested
`alarms` row shows no badge inside the flyout. AC-10 concerns the collapsed **rail icon**
(satisfied by the group tile's dot), so this is out of scope as written. Confirming it is
deliberate; recorded as a follow-up for `docs/requirements/airlinq-blue-followups.md` rather
than silently absorbed into D4.

### 9.7 AC-27's "no AA regression" — reachable, with one caveat
No colour changes anywhere in this item, so AC-27 should be a clean pass by construction.
The caveat is real though: D3's reordering and D2's resizing **move elements onto different
background pixels**. Per team memory (three distinct painted-vs-computed failure modes), the
plan requires a **painted-pixel decode** for the badge (which sits on
`--aq-accent-container` over the navy rail) and for the relocated glyph, not a
declared-value sweep. No AC rewording needed.

**All 32 ACs are reachable** in the layers this design uses. The three issues above
(9.2 Q3/AC-9, 9.4 AC-20, and the 9.3 silence) are the only places the requirement needs
adjusting; none blocks the plan.

---

## 10. Rollout / rollback strategy

- **Rollout:** none. No commit, no deploy in this work item's scope (per constraints). The
  Developer verifies against a local dev server plus a pristine-HEAD second worktree.
- **Deploy shape when it happens:** UI-only. `mvn install -DskipTests --projects ui-ngx`, no
  server-restart semantics beyond the static bundle, **no schema change, no upgrade script,
  no `install.sh --upgrade`**.
- **Rollback:** per-task `git checkout` (§8.3). D4's whole-defect stop is reverting
  `menu.models.ts` alone.
- **Feature flag:** not required; see §1.4.

---

## 11. Verification contract (the plan implements each as a named proof)

| # | Proof | Standard |
|---|---|---|
| V1 | Baseline capture | screenshots 2 themes × 2 rail states × {1600×1000, 390×844}; freshly-measured lint baseline on `d2263de9da`; light-palette token dump; dark-block declaration snapshot |
| V2 | `homeMenuMap` Home guarantee | 3-authority snapshot diff — **must be empty** |
| V3 | Permission/visibility sets per authority | pageset diff after redirect resolution — **LOST [] / GAINED []** |
| V4 | Blue light palette byte-identical | no `--aq-*` light value altered |
| V5 | Dark unchanged, two-way | declaration-level (name+value; declaration-**multiset** where only selectors change) **AND** rendered pixel-identity vs pristine `d2263de9da` (2nd worktree + `node_modules` **junction**), per-route noise floor measured first, **`/home` excluded** (4.07% self-difference), pointer parked + focus blurred + zero hovered rows asserted, `reducedMotion: 'reduce'` |
| V6 | Each defect | measured geometry / computed style, **both themes × both rail states + one mobile width**; painted-pixel decode wherever a background sits on a z-index sibling or an `opacity` composites |
| V7 | No new `!important` | grep **added declarations** (not text hits), each survivor confirmed outside `/* */` and absent at HEAD |
| V8 | Owning-component rule placement | `_nghost`/`_ngcontent` read off the real element for each of the 4 rail owners + `tb-user-menu` |
| V9 | `.pages` sweep | **rendered** all-routes sweep, `.tb-side-menu` children > 0 on every affected route — **not** static inspection |
| V10 | Lint delta | zero vs V1's baseline; `node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js lint` |
