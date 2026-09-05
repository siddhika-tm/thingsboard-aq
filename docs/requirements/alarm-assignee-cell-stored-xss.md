# Requirement (backlog) — Fix stored XSS in the alarm assignee cell

- **Work item slug:** `alarm-assignee-cell-stored-xss`
- **Status:** LOGGED, not started. Raised at the G2 gate of `dashboard-and-grid-design-fidelity`
  by human decision D10. Deliberately NOT fixed in that round.
- **Mode:** dev
- **Severity:** High (CWE-79, OWASP A03:2021 Injection). Architect assessed CVSS 7.3.
- **Date raised:** 2026-09-04

## Problem

The shared entity table renders cell content through a deliberate sanitizer bypass:

    // ui-ngx/src/app/modules/home/components/entity/entities-table.component.ts:657
    res = this.domSanitizer.bypassSecurityTrustHtml(column.cellContentFunction(entity, column.key));

bound with `[innerHTML]` (entities-table.component.html:250,253,261). Angular's sanitizer is
therefore fully disabled for every cell, and whatever a `cellContentFunction` returns is live markup.

`ui-ngx/src/app/modules/home/components/alarm/alarm-table-config.ts:215-235`
(`getAssigneeTemplate`) interpolates `getUserDisplayName(entity.assignee)` and
`getUserInitials(entity.assignee)` — derived from the user's raw, unescaped `firstName`,
`lastName` and `email` (`alarm.models.ts:392-410`) — directly into that HTML string.

## Impact

A user who can set their own profile name and be assigned an alarm can execute script in the
session of every user who views an alarms table showing that assignee — including tenant admins.
The payload is stored server-side (user profile), so this is stored XSS, not reflected.

## Scope notes

- Pre-existing upstream ThingsBoard code; not introduced by Airlinq work.
- Sibling paths using the same bypass pattern must be assessed in the same pass:
  `alarms-table-widget.component.ts`, `entities-table-widget.component.ts`,
  `timeseries-table-widget.component.ts`.
- ADR 0002 (approved 2026-09-04) already establishes the direction: status-like cells render via a
  real Angular component with `{{ }}` auto-escaping rather than HTML strings. The same approach
  applies here.

## Suggested direction (to be designed properly at G1/G2 of this work item)

1. Render the assignee cell through a real Angular component/template so interpolation is escaped.
2. Failing that, escape the interpolated values at the source.
3. Longer term, narrow or retire the blanket `bypassSecurityTrustHtml` at
   `entities-table.component.ts:657` so a future `cellContentFunction` cannot reintroduce this.

## Acceptance criteria (draft — to be confirmed at that work item's G1)

- A user profile name containing markup (e.g. `<img src=x onerror=...>`) renders as inert TEXT in
  the alarms table assignee cell, in both themes, and no script executes.
- The alarms table continues to display avatar initials, background colour and display name as today.
- No regression in the other cell-content paths that share the sink.
