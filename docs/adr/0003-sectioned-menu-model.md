# 0003 — A section-heading type in the menu model, and a sectioned TENANT_ADMIN tree

- **Status:** proposed (awaiting human approval at G2)
- **Date:** 2026-09-06
- **Deciders:** human (product owner), technical-architect
- **Context work item:** `left-menu-and-favicon`

## Context

The approved design canvas (`docs/design/2026-09-06-left-menu-canvas/`, Option A · Sectioned, chosen
by the human at G1) requires a left menu in which **every page is one click away**, grouped under
uppercase section headings, with expand chevrons on only the five true sub-menus.

Today's menu cannot express that. `MenuSectionType` is `'link' | 'toggle' | 'divider'`
(`ui-ngx/src/app/core/services/menu.models.ts:21`) — there is **no heading type** — and most of
today's groups are `toggle` accordions that bury their pages behind a click. Both facts are model
facts, not styling facts: no stylesheet can invent a heading the data has no type for, and none can
turn an accordion into a navigating link.

This is the same class of trap that cost the previous work item two implementation rounds under a
CSS-only constraint (ADR 0001). It was identified before coding this time, at G1, and recorded as a
boxed STRUCTURAL FINDING in the requirement.

The model has a second property that makes the change riskier than it looks. Menu visibility is
produced by two mechanisms: the **authority** selects one of three separate reference trees, and a
`menuFilters` map of predicates hides individual ids — including this fork's local `unavailableOffline`
filter, which hides 11 ids that cannot work on the air-gapped demo. `filterMenuReference()` also
hides a parent when *all* of its children are filtered out
(`menu.models.ts:1112-1116`). Flattening a group whose children are all filtered would therefore turn
a correctly-hidden group into visible dead rows.

## Decision

**We add a fourth member, `'section'`, to `MenuSectionType`, and reshape the TENANT_ADMIN reference
tree so that most `toggle` groups become `link` rows under section headings.**

Constraints, all binding:

1. **`'section'` is inert.** No `path`, no `icon`, not focusable, not in tab order, no
   `routerLink`. It renders through one new `@switch` arm in `side-menu.component.html`. Grouping is
   exposed to assistive technology by wrapping each section's rows in a labelled list, not by the
   heading element itself.
2. **`toggle` is retained for exactly five true sub-menus** — Profiles, Data processing, Resources,
   Security, Platform. Every other row navigates directly.
3. **`menuFilters` is not edited.** Not one line. All predicates stay byte-identical.
4. **A group is never flattened if any of its ids is filtered.** `mobile_center` (all children
   `unavailableOffline`) stays out of the sectioned tree; `edge_management` stays a `toggle` because
   it is itself gated on `edgesSupportEnabled`.
5. **The SYS_ADMIN and CUSTOMER_USER trees get headings only** — their rows are not regrouped. The
   customer tree is a separate literal and is the case most likely to break.
6. **Equivalence is proved, not argued.** The visible `(label, path)` row set is captured per
   authority before and after; the two sets must be identical. Grouping and order may differ;
   membership may not.

## Consequences

**Positive**

- The canvas becomes reachable in the layer that can express it, and "every page one click away"
  becomes true of the data rather than of the stylesheet.
- The heading type is explicit, so future menu work does not have to overload `divider` or fake a
  heading with a permanently-open toggle.
- The reachability check ("can this layer express this requirement?") is applied before coding for
  the second work item running, rather than after two failed rounds.

**Negative / accepted costs**

- **Fork divergence.** `menu.models.ts` and `side-menu.component.html` are upstream ThingsBoard
  files; both will conflict on rebase. Accepted under ADR 0001, whose additive-and-marked rule
  applies. The union edit is one line and the `@switch` arm is one block, so conflicts are
  resolvable by inspection.
- **A silent failure mode is introduced.** A `MenuSectionType` value with no `@switch` arm renders
  nothing at all — no error. Any future member must add its arm in the same change.
- **The expanded panel is longer**, and may scroll on short viewports. The canvas accepts this
  explicitly; the scroll container already exists.
- **Menu visibility now has a regression test that must actually be run.** The row-set comparison in
  constraint 6 is the only check that catches both a lost page and an appeared-orphan row.

## Alternatives considered

- **Reuse `'divider'` with an optional label.** Avoids the union change but overloads a type that
  means "horizontal rule", and still needs a guard in `menuSectionToHomeSection()`. Rejected as
  implicit.
- **Keep `toggle` and force `opened: true`.** No model change, but the heading remains a button that
  can collapse, which defeats the one-click requirement and puts a chevron on rows that are not
  sub-menus. Rejected: it does not deliver the requirement.
