# 0002 — Render status/severity cells as Angular components, not HTML strings

- **Status:** proposed (awaiting human approval at G2)
- **Date:** 2026-09-04
- **Deciders:** human (product owner), technical-architect
- **Context work item:** `dashboard-and-grid-design-fidelity`
- **Related:** ADR 0001

## Context

The shared entity table renders cell content through a sanitizer bypass:

```ts
// ui-ngx/src/app/modules/home/components/entity/entities-table.component.ts:657
res = this.domSanitizer.bypassSecurityTrustHtml(column.cellContentFunction(entity, column.key));
```

bound with `[innerHTML]` (`entities-table.component.html:253,261`). Angular's sanitizer is
therefore **fully disabled** for every cell, and any HTML a `cellContentFunction` returns is live
markup. Several upstream `cellContentFunction`s exploit this to return styled `<div>`s.

The requirement needs the device state cell to become a pill with a coloured **dot** plus a text
label, with colours from `--aq-*` tokens and no hardcoded hex (AC-16, AC-17), and the alarm
severity cell to stop being colour-only text (AC-18).

While assessing this, a **live stored-XSS path** was found in the same mechanism:
`alarm-table-config.ts:213-225` (`getAssigneeTemplate`) interpolates
`getUserDisplayName(entity.assignee)` — the user's raw, unescaped `firstName`/`lastName`/`email`
(`alarm.models.ts:392-410`) — into an HTML string that reaches `bypassSecurityTrustHtml`. It is
pre-existing upstream and out of scope for this work item, but it demonstrates that the
string-building pattern is not merely inelegant: it is actively dangerous, and every new use of it
is a future vulnerability.

The device status cell itself interpolates only `translate.instant()` output with a
compile-time-constant key, so that specific instance is **not** exploitable today.

## Decision

**New and reworked status-like cells are rendered by a real Angular component, not by returning an
HTML string.**

For this work item: a `tb-status-chip` component (dot + label, tone as a class binding) is rendered
through a new `@case ('statusChip')` branch in the cell `@switch`, alongside the existing
`@case ('entityChips')` branch that already establishes this pattern
(`entities-table.component.html:256`).

- The label is passed as a **text interpolation** (`{{ label }}`), so Angular escapes it.
- Colour comes from a CSS class consuming `--aq-*` tokens — never inline styles, never hex in
  TypeScript.
- `devices-table-config.resolver.ts` and `alarm-table-config.ts` return **data**
  (`{label, tone}`), not markup.

Corollary constraints:

- No task in this work item may extend, copy or relocate the `getAssigneeTemplate` string-building
  pattern.
- The pre-existing assignee XSS is **reported, not fixed**, here (requirement §4 forbids
  upstream-wide refactors); it is recommended as a separate work item.

## Consequences

**Positive**

- The device status cell leaves the `bypassSecurityTrustHtml` path entirely — the raw-HTML surface
  **shrinks** rather than grows.
- AC-17's grep (no `#198038`, `#d12730`, `rgba(25, 128, 56`, `rgba(209, 39, 48` in the resolver)
  passes by construction, not by careful editing.
- The dot is a real element, so it is expressible at all, and the label is real text, so severity
  and state stay readable without colour (accessibility requirement).
- One component serves both Devices (AC-16) and Alarms (AC-18) with no duplication.

**Negative / accepted costs**

- One new component (template + class + styles) instead of a four-line string — more files for a
  visually small feature.
- A new `@case` in the shared cell `@switch` is an upstream merge surface (accepted under ADR 0001).
- The column type gains a value (`statusChip`) that upstream does not know about; a future upstream
  change to the cell-rendering switch must be reconciled with it.

**Neutral**

- The `bypassSecurityTrustHtml` call itself is **not** removed — other upstream
  `cellContentFunction`s still rely on it. This ADR stops the bleeding for cells we own; it does
  not re-architect upstream cell rendering.
