# Left-menu defect fixes (blue theme)

- **Class:** standard (5 defects, one reverses a prior architectural decision; D5 added 2026-09-08)
- **Mode:** dev
- **Reported against:** commit `d2263de9da` ("style(ui): recolour light theme to the Airlinq Blue product palette"), live and verified on the deployed demo
- **Status:** G1 — awaiting human approval

## Problem statement

Four defects in the left menu, all visible on the deployed blue theme. Three are
visual/layout regressions in the rail; the fourth is a deliberate reversal of the
menu-structure decision taken in the previous left-menu work item.

## Diagnosis (established before writing this doc, from source; runtime confirmation is the Developer's task)

### D1 — collapsed rail shows a clipped "AIRLINQ" wordmark
`home.component.scss` **does** carry `.tb-brand { display: none }` under `&.tb-collapsed`
(line 62), so the rule exists. It **loses on specificity**:

| Rule | Selector (post-compile, `_nghost` counts as a class) | Weight |
|---|---|---|
| collapse (`:62`) | `:host mat-sidenav-container.tb-desktop.tb-collapsed mat-sidenav.tb-site-sidenav .tb-brand` | **(0,4,2)** |
| blue theme (`:147`) | `:host mat-sidenav.tb-site-sidenav .tb-nav-header .tb-nav-header-toolbar .tb-brand` | **(0,5,2)** |

The blue-theme rule's `display: flex` outranks the collapse rule's `display: none` by one
class, so the wordmark never hides and is clipped by the 64px rail. Both rules live in
`home.component.scss`, which is also the component that **owns** the element (verified last
item: the wordmark carries `_ngcontent-ng-c935555661`). So this is a same-file specificity
defect, not a wrong-owner defect — but the owner rule still applies to the fix.

### D2 — alarm badge renders as a tall stretched pill
`.tb-menu-badge` (`menu-link.component.scss:61`) sets only `font-size`, `line-height: 14px`,
`padding: 1px 6px`, `border-radius: 999px`, `margin-left: auto`, `flex: none`. Nothing
constrains its **height** or `align-self`, and it is a flex child of an `<a mat-button>`
whose Material rules set `height: 100%` / `align-items: stretch` behaviours on children.
Hypothesis: the badge is being stretched to the row's full height by the button's flex
line, and `border-radius: 999px` then renders that as a tall rounded blob. Requires runtime
measurement (`getBoundingClientRect` + `align-self`) to confirm the exact winning rule.

### D3 — user block misaligned, overflow glyph detached to the left
Template order is **correct** (`user-menu.component.html`: avatar `:27` → `.tb-user-info`
`:28` → `.tb-user-overflow` `:38`), so this is CSS, not markup. Two competing layout blocks
exist in `user-menu.component.scss`:
- `:62` generic `button.mat-mdc-button:not(.mat-mdc-icon-button).tb-user-menu` — `flex-direction: row`, `gap: 8px`, `justify-content: start`
- `:151` rail-scoped `.tb-site-sidenav` block — the approved 12/12/12/16 + 10px-gap anatomy

The overflow glyph appearing **before** the avatar indicates the trailing-edge mechanism
(`margin-left: auto` or `order`) is not landing, most likely because the generic block's
`gap`/`justify-content` wins or the rail block's expected `margin-left: auto` is absent.
Requires runtime confirmation of the winning declaration per element.

### D4 — menu groups: restore collapsible parents (human ruling, Option B)
The previous item added `'section'` to `MenuSectionType` (`menu.models.ts:21`) and flattened
multi-page groups from `'toggle'` to `'link'`. The human now rules that collapsible groups
return: Monitor, Devices & assets and the other multi-page sections become `'toggle'`
parents again, so the collapsed rail shows **one icon per group with its flyout**, not one
icon per page.

Enabling machinery is intact: `menu.service.ts:80-82` already restores `opened` for
`type === 'toggle'` sections, and `allMenuLinks`/`allMenuSections` already recurse through
`.pages`.

**Known hazard (team memory):** `router-tabs.component.ts:113` dereferences
`found.pages.filter(...)` **unguarded** while `findRootSection` two lines below guards it.
Reshaping `menu.models.ts` without checking every `.pages` consumer previously blanked the
entire side menu on affected routes. Every `.pages` consumer must be re-swept.


### D5 — KPI tile label/context text illegible when the menu is expanded
**Root-caused by Jarvis before design (not assumed):** the shrink is the widget's **own
`autoScale`**, not `dashboardCss` and not a stored font-size.

`value-card-widget.component.ts:148-215`: when `settings.autoScale` is true (and it defaults
to `true`, `value-card-widget.models.ts:90`) a **`ResizeObserver`** (`:156`) recomputes on
every panel resize:

```
scale = Math.min(panelWidth, panelHeight) / squareLayoutSize        // non-horizontal
renderer.setStyle(valueCardContent, 'transform', `scale(${scale})`)  // :215
```

So the whole content element is shrunk by a **CSS transform**. Pinning the menu open narrows
the sheet, which narrows each tile panel, which lowers `scale`.

**Consequence for the fix — this contradicts ruling (a) as written:** a CSS
`min-font-size` **cannot** counteract `transform: scale()`. The transform scales
already-computed pixels, so an 11px label inside a `scale(0.55)` element still paints at
~6px. Raising the declared size only changes what gets multiplied down. The reachable
levers are: cap the scale factor's lower bound, disable `autoScale` for these tiles, or
raise the stored sizes so the post-scale result clears the floor (layer b). **This needs a
human re-decision — see Open questions Q4.**

## Acceptance criteria

Numbered, each testable as input/precondition → expected observable result.

### D1 — collapsed wordmark
> **REPRODUCE-FIRST 2026-09-08 (human ruling Q7).** The G1/G2 diagnosis was WRONG: compiled
> selectors show `display: none` at **(0,5,2)** already BEATS `display: flex` at **(0,5,1)**, so it
> wins at desktop width. Before any fix, measure computed `display` of `.tb-brand` and the
> wordmark's rendered box at **1600x1000, 900 and 390** on the real authenticated route,
> collapsed. If it only reproduces below the `gt-sm` breakpoint (where `.tb-desktop` drops off and
> the two-class collapse rule cannot match), that is the fix target and D1 is a **narrow/mobile**
> defect. If it reproduces at full desktop width, there is a THIRD mechanism - find it by computed
> style and report before fixing. Screenshots at each width either way.

1. **AC-1** — Rail collapsed, light theme, desktop: `.tb-brand-wordmark` has computed
   `display: none` (or is absent from the layout box), and `getBoundingClientRect().width === 0`.
2. **AC-2** — Rail collapsed: the 24px `.tb-brand-mark` is visible and its horizontal centre
   is at **x = 40 ± 1px** (the rail axis: 64px rail with an 8px `--aq-gap` offset → centre 40).
3. **AC-3** — Rail collapsed: no element in the rail head has a right edge beyond the rail's
   right edge (no clipping/overflow), measured by `getBoundingClientRect`.
4. **AC-4** — Rail **expanded**: the wordmark is visible again, `display: flex` on `.tb-brand`,
   wordmark width > 0, ink `--aq-chrome-ink` (unchanged from deployed).
5. **AC-5** — AC-1 through AC-4 hold identically in **dark** theme.

### D2 — alarm badge
6. **AC-6** — Expanded rail, a menu row with `badgeCount > 0`, light: `.tb-menu-badge`
   height is **≤ 18px** and its width ≥ its height (a compact chip, never taller than wide).
7. **AC-7** — Same row: the badge's bounding box does **not** intersect the row label's
   bounding box (no overlap).
8. **AC-8** — Same row: the badge is vertically centred within the row — badge centre-y is
   within **±2px** of the row's centre-y.
9. **AC-9** — Badge sized to its digits: a 1-digit and a 2-digit count both satisfy AC-6/AC-7,
   with the 2-digit badge wider than the 1-digit one.
10. **AC-10** — **Collapsed** rail: the badge is replaced by the `.tb-menu-dot` (6px dot) and
    the visually-hidden count remains in the accessibility tree (meaning never colour-only).
11. **AC-11** — AC-6 through AC-10 hold in **dark** theme.

### D3 — user block
12. **AC-12** — Expanded rail, light: DOM/visual order left→right is avatar → name/role stack
    → overflow glyph, asserted by `getBoundingClientRect().left` being strictly increasing.
13. **AC-13** — Expanded rail: the overflow glyph sits at the **trailing edge** — its right
    edge is within **12px** of the user block's content right edge.
14. **AC-14** — Expanded rail: avatar is 32px × 32px; the name/role stack is vertically
    centred against the avatar (centre-y within ±2px).
15. **AC-15** — Expanded rail: name and role do not overlap each other or the avatar or the
    overflow glyph (no pairwise bounding-box intersection).
16. **AC-16** — **Collapsed** rail: the user block shows the avatar (or mini-avatar) centred
    on the rail axis (x = 40 ± 1px); name, role and overflow are not visible.
17. **AC-17** — AC-12 through AC-16 hold in **dark** theme.
18. **AC-18** — **RETIRED AND REPLACED 2026-09-08 (human ruling Q8).** The original text pinned the top-toolbar `tb-user-menu` instance as visually unchanged. That is unsatisfiable: `tb-user-menu` has four consumers and ONE shared template, and the projection-slot defect lives in that shared markup, so fixing the rail necessarily fixes the toolbar. Replacement: the **toolbar instance's overflow glyph now also sits at the trailing edge** (right edge within 12px of the instance's content right edge, verified by `getBoundingClientRect`), and **nothing else about that instance is altered** - avatar size, name/role inks and geometry unchanged from deployed. Verify by geometry in **both themes**.
    is visually unchanged from deployed — this component has two consumers and only the rail
    one is in scope.

### D4 — collapsible groups
19. **AC-19** — Multi-page groups (Monitor, Devices & assets, and every other section with `pages.length > 1`) have `type === 'toggle'` in the built menu model, AND the four `type === 'section'` headings are RETAINED (human ruling 2026-09-08, Q5): the shape is Option B collapsible groups NESTED UNDER the section headings, not one or the other. The expected pageset diff is computed against that combined shape.
    has `pages.length > 1`) have `type === 'toggle'` in the built menu model.
20. **AC-20** — Expanded rail: clicking a group header toggles its children open/closed, and per-user open state persists across a route change via `openedMenuSections`. **Reworded 2026-09-08:** `menu.service.ts:81` restores `opened` when `openedMenuSections.includes(path) || section.active`, so the group containing the CURRENT route is auto-opened by design. The test must therefore assert persistence on a group that does NOT contain the active route (toggle it, navigate elsewhere, return, and confirm the state survived), and must treat the active group's auto-open as EXPECTED, never as a failure.
    the open/closed state persists across a route change (the `menu.service.ts:80` restore).
21. **AC-21** — **Collapsed** rail: the rail shows **one icon per group**, not one per page;
    clicking a group icon opens its flyout listing that group's pages.
22. **AC-22** — Every page reachable before this change is still reachable after it (no
    orphaned routes): the set of `type === 'link'` leaf paths is unchanged.
23. **AC-23** — The **Home** page guarantee is intact: `homeMenuMap` still drives the Home
    entry and the Home page renders its expected tiles (the guarantee recorded in ADR 0003).
24. **AC-24** — **Every `.pages` consumer is swept and guarded**: a route sweep across all
    affected routes shows `.tb-side-menu` children > 0 on each (i.e. the menu never blanks),
    explicitly covering `router-tabs.component.ts:113`.
25. **AC-25** — Docs updated, not silently contradicted: the previous left-menu requirement,
    its design doc and **ADR 0003** carry a superseding-decision note recording that Option A
    (flat sections) is reversed in favour of Option B (collapsible groups), with the date and
    the rationale.


### D5 — KPI tile text legibility
33. **AC-33** — `/home`, light, **menu collapsed** (widest sheet): the four value-card tiles'
    label and context elements have computed **effective** font-size (declared size ×
    cumulative transform scale) of **label ≥ 11px** and **context ≥ 12px**.
34. **AC-34** — Same, **menu expanded** (narrowed sheet): AC-33's floors still hold. This is
    the reported defect condition.
35. **AC-35** — Same, at **one narrow desktop width** (menu expanded plus a reduced viewport):
    AC-33's floors still hold.
36. **AC-36** — At all three widths the **numeric value remains dominant**: value effective
    font-size is strictly greater than the label's and the context's.
37. **AC-37** — The existing **uppercase / .06em letter-spacing** treatment on the label is
    preserved at all three widths.
38. **AC-38** — AC-33 through AC-37 hold in **dark** theme, and dark tile rendering is
    otherwise unchanged per AC-26's two-way proof.
39. **AC-39** — No new `!important` is used to win against the widget's inline
    `transform`/sizing; the app-CSS layer matches or exceeds selector depth (AC-29 applies).
40. **AC-40** — The app-CSS layer (ruling a) is scoped so it **cannot regress dark** and
    applies to value cards generally, not only this dashboard.
41. **AC-41** — Measured by **computed style plus the cumulative transform chain** (not the
    declared size alone) at all three widths, with screenshots per width per theme.

### D5 layer (b) — dashboard config, human-gated
42. **AC-42** — A **fresh backup** of the Container Operations dashboard is taken first and
    **aborts unless** it reports **19 widgets** and a matching title.
43. **AC-43** — A **dry-run report** is produced and reviewed before any write.
44. **AC-44** — The apply step runs **only after explicit human go-ahead**, sets `version` to
    the server's current value (optimistic locking — a stale `version` returns HTTP 409), and
    is followed by a verify step.
45. **AC-45** — The **restore command is documented** in the handover before the apply runs.
46. **AC-46** — Post-apply, AC-33 through AC-38 hold **on the deployed dashboard**.


> **CUSTOMER_USER exception (human ruling 2026-09-08):** that authority keeps `alarms` **FLAT** - no one-item `alarms_center` accordion. Pageset-identical, badge path untouched, better affordance. Its pageset-diff expectation reflects the flat shape.

### D4 — carried consequences and the unguarded dereference (human-directed 2026-09-08)
47. **AC-47** — **REWORDED 2026-09-08 (human ruling).** The alarm **count is NOT required in the collapsed rail** - the presence **dot alone is correct**. Expanded menu: the numeric badge renders on the nested Alarm list row, honouring the **99+ cap**, which requires `menu-toggle` to pass `badgeCount` through to its child `<tb-menu-link>` (it currently passes none). Collapsed rail: **only the presence dot** on the Monitor tile, **no digits** - a missing count in the rail must NOT be scored as a failure. The dot **retains its `cdk-visually-hidden` number** so the information stays available to a screen reader (meaning is never colour-only).
    `menu-toggle` passes `badgeCount` through to its child `<tb-menu-link>`, and the badge
    renders on the nested Alarm list row (expanded) with the dot form in the collapsed rail.
    This is a real consequence of D4 — the toggle currently passes no `badgeCount`.
48. **AC-48** — `updateOpenedMenuSections()` **recurses**, so nested toggles restore their
    open state; verified by opening a nested group, reloading, and confirming it is still open.
49. **AC-49** — `menu-toggle.component.ts:57` `sectionHeight()` no longer dereferences
    `this.section.pages.length` unguarded. It is bound to `[style.height]` and therefore runs
    on **every change-detection cycle**, so an unguarded read throws continuously and blanks
    the menu. Proof is the AC-24 rendered all-routes sweep, plus a zero-console-error check.

### D5 — the autoScale floor's blast radius (human-accepted 2026-09-08)
50. **AC-50** — The chosen scale floor is **stated with its rationale** (the value and why it
    was picked), and is applied so that **no value card clips or overflows** at the narrowest
    sheet width.
51. **AC-51** — At least **two other value-card widgets** on the Container Operations
    dashboard are checked for clipping/overflow at the narrowest sheet width, in both themes.
    The human has explicitly accepted that the floor changes shared behaviour for every
    `autoScale` value card; this is the guard on that acceptance.

### Cross-cutting
26. **AC-26** — **Dark theme unchanged**, proven to the standard set in the previous item:
    (a) declaration-level — any edited frozen/shared block is declaration-identical by name
    and value where only selectors change; and (b) **rendered** — dark chrome pixel-identical
    against a pristine-HEAD (`d2263de9da`) two-server comparison on pixel-stable routes, with
    a measured per-route noise floor and `/home` excluded as unstable.
27. **AC-27** — **No AA regression**: the contrast sweep over the rail, both themes, shows no
    pair that passed before and fails after. New/changed inks meet 4.5:1 for text and 3:1 for
    non-text.
28. **AC-28** — The **Airlinq Blue light palette is unchanged**: no `--aq-*` token value in
    the light block is altered by this work item.
29. **AC-29** — **No new `!important`** declarations; specificity conflicts are resolved by
    matching or exceeding selector depth.
30. **AC-30** — Rules live in the stylesheet of the component that **owns** the element (this
    rail has four owners: `tb-side-menu`, `tb-menu-link`, `tb-menu-toggle`, `home.component`;
    the user block is owned by `tb-user-menu`).
31. **AC-31** — Build exits 0; `yarn lint` delta is zero against a freshly-measured baseline
    on `d2263de9da`.
32. **AC-32** — Screenshots captured for each of the four defects, in **both themes** and
    **both rail states**, at desktop (1600×1000) and one mobile width (390×844).

## Out of scope
- Any change to the light palette token values (AC-28).
- The remaining auth-page inks, the chart series palette, and the other entries in
  `docs/requirements/airlinq-blue-followups.md`.
- Restyling the top-toolbar `tb-user-menu` instance (AC-18 pins it unchanged).

## Open questions
1. **D4 flyout behaviour on the collapsed rail** — the previous item established that
   collapsed sections open as **flyout popovers outside the rail** and that hover-expand was
   deliberately rejected (a hover-expand collapses the moment the pointer reaches the
   flyout). Confirm the restored groups keep click-to-open flyouts, not hover.
2. **D4 default state** — should multi-page groups start **collapsed** on first login, or
   expanded? `menu.service.ts` persists user state thereafter; this is only about the default.
3. **D2 count cap — RESOLVED 2026-09-08:** the "99+" cap does **not** exist in the code today
   (`AlarmBadgeService` emits raw `totalElements`, interpolated unformatted). Human ruling:
   **IMPLEMENT** it via a `badgeLabel` getter. Step unblocked.

4. **D5 layer (a) is unreachable as ruled — needs a re-decision.** The shrink is
   `transform: scale()` applied by the widget's own `ResizeObserver`
   (`value-card-widget.component.ts:215`), so a minimum declared font-size cannot win: the
   transform multiplies whatever is declared. Options: **(i)** clamp the scale factor's lower
   bound in app CSS/TS so tiles never scale below a legibility floor; **(ii)** set
   `autoScale: false` for these tiles (layer b, config-only) and let CSS sizes govern;
   **(iii)** raise the stored label/context sizes (layer b) so the post-scale product clears
   the floor, accepting that very narrow sheets still fall below it; **(iv)** combination —
   clamp in CSS *and* raise stored sizes. Recommend **(i) + (iii)**: (i) fixes every
   dashboard and ships with the code as ruling (a) intends, (iii) makes this dashboard
   correct immediately. Note (i) touches a shared widget behaviour, so its blast radius is
   every `autoScale` value card — that needs the human's explicit acceptance.

## Sign-off
- G1: awaiting human approval.
