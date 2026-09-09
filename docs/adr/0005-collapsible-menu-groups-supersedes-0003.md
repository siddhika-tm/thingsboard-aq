# 0005 — Collapsible menu groups (Option B), superseding the sectioned menu model

- **Status:** proposed (awaiting human approval at G4)
- **Date:** 2026-09-08
- **Deciders:** human (product owner), technical-architect
- **Context work item:** `left-menu-defect-fixes`
- **Supersedes:** [ADR 0003 — A section-heading type in the menu model, and a sectioned TENANT_ADMIN tree](0003-sectioned-menu-model.md)

## Context

ADR 0003 adopted Option A ("Sectioned"): every page one click away, groups replaced by
uppercase section headings, `toggle` retained for only five true sub-menus. It shipped.

Option A optimised the EXPANDED rail and silently degraded the COLLAPSED one — which is
the state the rail ships in most of the time. Flattening every multi-page group into
top-level `link` rows meant the collapsed rail rendered **one icon per page instead of one
per group**. Two consequences, both observed on the deployed demo:

1. **It does not scale.** The collapsed rail became a long undifferentiated icon column
   that grows with every page added, with no visual grouping to navigate by.
2. **It loses the group affordance entirely.** The flyout popover is the collapsed rail's
   only way to express a group. With no `toggle` parents there was nothing to show, so the
   collapsed rail could no longer tell the user which pages belonged together.

The human reviewed the deployed result and reversed the decision on **2026-09-08**.

## Decision

**Multi-page groups return to `type: 'toggle'` (Option B). The collapsed rail shows one
icon per group with a click-to-open flyout.**

Constraints, all binding:

1. **Click, not hover.** Collapsed groups open as flyout popovers OUTSIDE the rail, so a
   hover-expand would collapse the moment the pointer travelled to the flyout. Hover-expand
   stays abandoned (human ruling Q1). Today's `tbPopoverTrigger="click"` mechanism is kept
   unmodified.
2. **Groups default to COLLAPSED on first login**; per-user state persists thereafter via
   the existing `openedMenuSections` preference (human ruling Q2).
3. **`'section'` is RETAINED.** `MenuSectionType` keeps its fourth member and its
   `@switch` arm. The headings still group the expanded rail, they are already shipped and
   inert, and the type is used by all three authority trees. This reversal is about
   `link`-vs-`toggle`, not about headings.
4. **`menuFilters` is still not edited.** Not one line. ADR 0003 constraint 3 survives the
   reversal intact.
5. **`homeMenuMap` is the reference shape.** It preserved the pre-reshape tree verbatim, so
   the rail tree converges back onto the tree the Home page never stopped using. The
   reversal is largely a DELETION of the fork's own divergence, not new invention.
6. **The opened-state restore must be depth-independent.** `updateOpenedMenuSections()`
   originally filtered only top-level sections; Option B nests toggles inside toggles, so it
   now filters the flattened `_availableMenuSections`. Without this a nested group never
   restores its state and hides the active row.
7. **Equivalence is proved, not argued** — carried forward from ADR 0003 constraint 6 and
   strengthened: a per-authority pageset diff (LOST []/GAINED []) after redirect resolution,
   AND a RENDERED all-routes sweep counting `.tb-side-menu` children > 0.

## Consequences

**Positive**

- The collapsed rail regains one icon per group and a flyout that has something to show.
- Re-nesting restores `filterMenuReference`'s parent-hiding, which flattening bypassed —
  ADR 0003 constraint 4 is now honoured *a fortiori*.
- Fork divergence DECREASES: the tree returns toward upstream's own shape.

**Measured outcomes (not predictions)**

- **Pageset equivalence: LOST [] / GAINED [], for all three authorities × both
  `edgesSupportEnabled` states** (6 combinations). The diff is empty in every cell.
  *Counting-basis note:* the harness counts each reachable leaf page after redirect
  resolution and reports **22 / 35 / 8** (SYS_ADMIN / TENANT_ADMIN / CUSTOMER_USER), where
  the requirement quotes 22 / 33 / 8. The 2-row difference is a **counting-basis**
  difference only, and it is immaterial to the invariant: the same basis is applied on both
  sides of the before/after diff, and the delta is empty. No page is lost or gained on
  either basis.
- **Rendered route sweep: 33/33 routes render a non-empty `.tb-side-menu`**, with **20 menu
  children** on the TENANT_ADMIN rail. This is the check that catches the `.pages` hazard
  class described below; zero routes blanked.
- **Home-page projection — the nuance a future reader needs.** The raw `buildUserHome`
  projection is **NOT** byte-identical before and after. The `alarms_center` `type` flip
  (`link` → `toggle`) leaks through the shared `menuSectionMap` and shows up as a differing
  `place` field on **4 captures**. That leak was proved **unreachable**: a sweep of all four
  Home files found **zero reads of `.type`** — `filterPlace` keys on `place.path`, and
  `sectionColspan` computes from `places.length`; nothing else consults the field. The
  invariant therefore holds on the **RENDERED** basis, not on the raw-projection basis.
  Anyone re-running a projection diff will see this delta and must not read it as an
  undiscovered regression: it is a dead field on the Home page.
- **Badge propagation verified.** `MenuId.alarms`'s `badge: 'alarmCount'` renders through
  `tb-menu-toggle`'s new propagation on the expanded rail.

**Negative / accepted costs**

- **The `.pages` hazard class is live again, in mirror image.** Option A's risk was a
  consumer dereferencing `.pages` on a pages-less `link`. Option B's is a `toggle` whose
  `pages` is absent or empty. `menu-toggle.component.ts:57` (`sectionHeight()`, bound to
  `[style.height]` and therefore run on every change-detection cycle) was unguarded and is
  now guarded. This failure class BUILDS, LINTS AND GREPS CLEAN while blanking the entire
  side menu, so the rendered route sweep is the only sufficient check.
- **Badge propagation is now a group concern.** `MenuId.alarms` carries the only
  `badge: 'alarmCount'` and moved from a top-level row (whose renderer passes `badgeCount`)
  into a group child (whose renderer did not). `tb-menu-toggle` now propagates it. The
  collapsed-rail FLYOUT rows are hand-written anchors with no badge mechanism — accepted
  and recorded as a follow-up, not fixed here.
- **Pages are one click further away in the expanded rail.** This is the trade ADR 0003
  made in the other direction, now made deliberately in favour of the collapsed rail.
- **A nested-toggle structural rule is now load-bearing.**
  `menu-toggle.component.html` renders every child as `<tb-menu-link>` with no child
  `@switch`, so a toggle nested inside a toggle would render as a flat link and silently
  lose its grandchildren. The tree must stay `heading → toggle → link`, and that is
  asserted structurally rather than inferred from `sectionHeight()`, whose arithmetic can be
  accidentally right while the content is wrong.

## What of ADR 0003's rationale still stands

Most of it. This is a reversal of one decision, not a repudiation of the analysis:

- **The reachability finding is fully vindicated.** "No stylesheet can invent a heading the
  data has no type for, and none can turn an accordion into a navigating link" is exactly
  the argument this reversal uses in the opposite direction: restoring groups is likewise a
  MODEL change, not a styling change. The layer-reachability check stays a G1 gate.
- **The `'section'` type was a genuine model gap** and is kept (constraint 3 above).
- **`menuFilters` immutability** (0003 constraint 3) remains binding.
- **Never flatten a group whose children are all filtered** (0003 constraint 4) is honoured
  by not flattening at all.
- **Equivalence proved, not argued** (0003 constraint 6) is carried forward and strengthened.
- **The recorded silent failure mode** — a `MenuSectionType` value with no `@switch` arm
  renders nothing, with no error — stands as a live warning, and is why `'section'` keeps
  its arm rather than being deleted.

**What is actually overturned** is ADR 0003 constraint 2 ("`toggle` is retained for exactly
five true sub-menus; every other row navigates directly") and the flattened TENANT_ADMIN
tree that followed from it.

## Alternatives considered

- **Keep Option A and fix only the collapsed rail's density** (e.g. smaller icons, a
  scrolling rail). Rejected: it treats the symptom. The collapsed rail's problem is not
  size but the absent grouping, which no amount of density recovers.
- **Hybrid — flat in the expanded rail, grouped when collapsed.** Rejected: it needs two
  divergent trees for one menu, doubling the equivalence-proof surface, and the rail would
  reorganise itself as the user collapses it, which is disorienting.
- **Amend ADR 0003 in place** rather than superseding it. Rejected on process grounds: an
  ADR is an immutable decision record, and editing 0003's Decision to say the opposite would
  destroy the audit trail this note exists to protect. MADR has a `superseded` status for
  exactly this case.
