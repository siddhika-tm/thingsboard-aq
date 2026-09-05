# Dashboard and entity-grid design fidelity — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development
> (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use
> checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Container Operations home dashboard and every entities-table page match the
approved design canvas in both light and dark themes.

**Architecture:** Every change declares its **layer** — token / stylesheet / template /
TypeScript / server-config. Colour stays token-only (`--aq-*`). Status cells become a real Angular
component instead of HTML strings. The numbered pager is added *beside* a retained
`MatPaginator` so page state, deep links and responsive behaviour are untouched. Dashboard widget
work is server-side config, executed by the human, not code.

**Tech Stack:** Angular 20.3.28, TypeScript 5.9.3, Angular Material (MDC), SCSS, ngx-translate,
Maven + `frontend-maven-plugin`. ThingsBoard 4.4.0-SNAPSHOT fork.

**Design doc:** `docs/design/dashboard-and-grid-design-fidelity.md`
**Requirement:** `docs/requirements/dashboard-and-grid-design-fidelity.md`
**ADRs:** `docs/adr/0001-template-edits-in-the-thingsboard-fork.md`,
`docs/adr/0002-status-cells-as-angular-templates-not-html-strings.md`

## Global Constraints

- Colours **only** via `--aq-*` tokens. No new hex/rgba outside the `.tb-default` / `.tb-dark`
  token definition blocks in `ui-ngx/src/styles.scss`. No hex/rgba added in any `.ts` or `.html`.
- **Never use `color-mix()`.** `.browserslistrc` supports Chrome ≥107 / Firefox ≥104 / Safari ≥16;
  `color-mix` needs Chrome 111 / Firefox 113 / Safari 16.2. Use the paired `--aq-*-tint` tokens.
- New tokens go in **both** `.tb-default` (line ~1428) and `.tb-dark` (line ~1478).
- Every new file carries the Apache licence header (15–17 lines; `.ts` uses `///`, `.html` uses
  `<!-- -->`, `.scss`/`.css` use `/* */`). Never truncate it.
- The entity table is shared by 10+ pages. Every new UI element is gated by an existing config
  flag (`searchEnabled`, `displayPagination`, `selectionEnabled`) and must degrade to today's
  behaviour when off.
- All new copy goes through translation keys. New keys go in
  `ui-ngx/src/assets/locale/locale.constant-en_US.json` **only** (ngx-translate falls back to
  en_US); do not edit the other 27 locale files.
- Do not change pinned dependency or toolchain versions.
- Modify files in place. No `.new` / `.v2` sibling copies.
- **Agents never commit or push** (commit policy `manual`). Where a step says "Commit", stage the
  files and report the suggested message; the human commits.
- Do not put secrets in any file. `$JWT` is fetched at run time; credentials stay in the
  gitignored `CLAUDE.md` / `env`.
- Binding decisions D1–D7 (requirement §9) are not re-opened. Notably **D2: device state is
  Active/Inactive only — invent no Watch/Alarm data** (the canvas shows Watch/Alarm chips; those
  are fixture artefacts, not spec).
- Canvas sample-data mismatches ("5 critical" vs 2 rows; "of 20" vs 9 rows) are fixture
  artefacts, **not** spec.
- Do not extend, copy or relocate the `getAssigneeTemplate` HTML-string pattern
  (`alarm-table-config.ts:213-225`) — it carries a known XSS (design §7.2).

## Verify commands (from the technical-architect overlay)

```bash
# Build (run from repo root)
mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true

# UI lint gate
cd ui-ngx && yarn lint

# Packaging (NOTE: any -Dpkg.skip.* flag silently disables the packaging profile — HANDOFF §8.6)
mvn install -pl application -Ppackaging -DskipTests -Dlicense.skip=true
```

For fast UI iteration use `cd ui-ngx && yarn start` (dev server proxied at the live server).
Headless screenshots against the live server do not bootstrap over the VPN (HANDOFF §8.6/§9).
**Component styles ship inside JS chunks** — confirm a deploy by grepping `public/main-*.js`, not
only `styles-*.css`.

---

## Task ordering rationale

1. **Task 1** (D7 rescope) is first because it is binding and zero-risk — but it is an
   **expected visual no-op** (design §3). It is not the dark-mode fix.
2. **Tasks 2–3** are token-layer: no DOM change, immediately visible, lowest risk.
3. **Tasks 4–5** add the status chip component (highest fidelity gain per unit of risk).
4. **Tasks 6–8** are the template edits, one concern each, riskiest last.
5. **Task 9** is the full regression sweep.
6. **Task 10** is server-side dashboard config — **human-executed**, separately approved.

Each task leaves the app buildable and lint-clean.

---

## File structure

| File | Responsibility | Task |
|---|---|---|
| `ui-ngx/src/styles.scss` | Token definitions + shared anatomy rules | 1, 2, 3, 6, 7, 8 |
| `ui-ngx/src/app/modules/home/components/entity/status-chip.component.ts` | **New.** Status/severity chip class | 4 |
| `.../entity/status-chip.component.html` | **New.** Dot + label markup | 4 |
| `.../entity/status-chip.component.scss` | **New.** Chip geometry, token colours | 4 |
| `.../home/components/home-components.module.ts` | Declare + export the chip | 4 |
| `.../home/models/entity/entities-table-config.models.ts` | `statusChip` column type + class | 4 |
| `.../entity/entities-table.component.html` | Chip case; search; selection dismiss; pager strip | 4, 6, 7, 8 |
| `.../entity/entities-table.component.ts` | `entityColumns` instanceof filter (step 5b); count badge, pager window, search mode | 4, 6, 7, 8 |
| `.../entity/entities-table.component.scss` | Local geometry for new toolbar/footer members | 6, 8 |
| `.../home/pages/device/devices-table-config.resolver.ts` | Device state → chip data | 5 |
| `.../home/components/alarm/alarm-table-config.ts` | Severity → chip data | 5 |
| `.../shared/services/custom-paginator-intl.ts` | "Showing 1–10 of 20" wording | 8 |
| `ui-ngx/src/assets/locale/locale.constant-en_US.json` | New `paginator.showing-range` key | 8 |

---

### Task 1: Rescope the grid/dashboard anatomy block to both themes (D7)

**Layer:** stylesheet. **Satisfies:** AC-32.
**Expected result: NO visible change in either theme.** See design §3 — `tb-default` is never
removed from `<body>`, so these rules already applied in dark. This task makes intent explicit and
removes a maintenance trap. If dark **does** change visibly, STOP and report: the diagnosis is
wrong.

**Files:**
- Modify: `ui-ngx/src/styles.scss:1770`, `:1837`, `:1883` (three `.tb-default {` openers)

**Interfaces:**
- Consumes: nothing.
- Produces: an anatomy block scoped `.tb-default, .tb-dark`, so later tasks can add rules there
  and have them apply in both themes without repeating the selector.

- [ ] **Step 1: Capture the "before" state in dark mode**

Start the dev server, set dark theme, screenshot `/devices`.

```bash
cd ui-ngx && yarn start
```

In the browser console on the app origin:

```js
localStorage.setItem('tb-theme','dark'); location.reload();
```

Navigate to `/devices` and record the computed values that the anatomy block controls:

```js
const h = document.querySelector('.mat-mdc-header-cell');
const r = document.querySelector('.mat-mdc-row');
console.log('header bg:', getComputedStyle(h).backgroundColor,
            '| header h:', getComputedStyle(h.closest('.mat-mdc-header-row')).height,
            '| row h:', getComputedStyle(r).height,
            '| divider:', getComputedStyle(h).borderRightColor);
```

Save the output. Expected (dark tokens already resolving): background `rgb(35, 42, 52)`
(`#232a34`), header row height `40px`, row height `48px`.

- [ ] **Step 2: Rescope the three block openers**

In `ui-ngx/src/styles.scss`, change the opener at line 1770 from:

```scss
.tb-default {
```

to:

```scss
.tb-default, .tb-dark {
```

Do the same for the openers at line 1837 and line 1883. Change **only** these three selectors;
do not touch any rule inside the blocks.

Also update the block's header comment (line ~1766) so it states the scoping explicitly:

```scss
/* =====================================================================
 * AIRLINQ GRID + DASHBOARD ANATOMY (design canvas 2026-09-04, both themes)
 * Entity tables, widget tables and dashboard cards share one grid
 * vocabulary: outer border, header band, 1px row + column dividers,
 * hover / selected rows, pill toolbar controls. Tokens only.
 *
 * Scoped to BOTH `.tb-default` and `.tb-dark`. Note that `tb-default` is
 * never removed from <body> (theme.service.ts only adds/removes `tb-dark`),
 * so a `.tb-default`-only selector DOES still match in dark mode; the dual
 * selector is here to state intent and to survive that ever changing.
 * ===================================================================== */
```

- [ ] **Step 3: Verify AC-32's grep passes**

```bash
cd /d/Github/airlinq-air && awk 'NR>=1765' ui-ngx/src/styles.scss | grep -c 'tb-dark'
```

Expected: `3` (at minimum, non-zero — AC-32 requires at least one occurrence).

- [ ] **Step 4: Verify no colour literal crept in**

```bash
cd /d/Github/airlinq-air && awk 'NR>=1765 && NR<=1900' ui-ngx/src/styles.scss \
  | grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' | grep -v '999px'
```

Expected: no output (every colour in the block is `var(--aq-*)`).

- [ ] **Step 5: Confirm the no-op**

Re-run Step 1's console probe. Expected: **identical** values to Step 1. Also check light mode is
unchanged.

If any value changed, STOP and report to the technical-architect before continuing.

- [ ] **Step 6: Lint**

```bash
cd ui-ngx && yarn lint
```

Expected: zero errors.

- [ ] **Step 7: Stage and report the commit message**

```bash
git add ui-ngx/src/styles.scss
```

Suggested message:

```
style(ui): scope the grid anatomy block to both themes explicitly

The AIRLINQ GRID + DASHBOARD ANATOMY block was scoped `.tb-default` only.
Because `tb-default` is never removed from <body> (theme.service.ts only
adds/removes `tb-dark`) and the block holds no colour literals, its rules
already resolved dark token values — this is a clarity fix, not a
behavioural one. Verified as a visual no-op in both themes.
```

---

### Task 2: Add the 18% tint tokens to both theme blocks

**Layer:** token. **Satisfies:** AC-17 (colour source), AC-33; enables Tasks 4, 5.

Replaces the canvas's `color-mix(in srgb, var(--X) 18%, transparent)`, which is **unsafe** for the
declared browser support window (design §5.2).

**Files:**
- Modify: `ui-ngx/src/styles.scss` — `.tb-default` token block (ends ~line 1475) and `.tb-dark`
  token block (ends ~line 1517)

**Interfaces:**
- Produces: `--aq-success-tint`, `--aq-warning-tint`, `--aq-error-tint`, `--aq-info-tint`,
  available in both themes. Tasks 4 and 5 consume these as chip backgrounds.

- [ ] **Step 1: Add the light tints**

In `ui-ngx/src/styles.scss`, inside the `.tb-default {` token block that opens at line 1428,
immediately after the `--aq-info:          #1d6b8a;` line, add:

```scss
  /* 18% tints of the semantic colours, for status chips. Pre-mixed rather
     than color-mix(): color-mix needs Chrome 111 / FF 113 / Safari 16.2, but
     .browserslistrc supports Chrome 107 / FF 104 / Safari 16 — there the
     declaration is dropped and the chip loses its background entirely. */
  --aq-success-tint:  rgba(23, 96, 58, .18);    /* --aq-success #17603a */
  --aq-warning-tint:  rgba(180, 83, 9, .18);    /* --aq-warning #b45309 */
  --aq-error-tint:    rgba(163, 24, 42, .18);   /* --aq-error   #a3182a */
  --aq-info-tint:     rgba(29, 107, 138, .18);  /* --aq-info    #1d6b8a */
```

- [ ] **Step 2: Add the dark tints**

Inside the `.tb-dark {` token block that opens at line 1478, immediately after the
`--aq-info:          #55b0df;` line, add:

```scss
  /* 18% tints of the semantic colours, for status chips (see .tb-default). */
  --aq-success-tint:  rgba(70, 192, 138, .18);  /* --aq-success #46c08a */
  --aq-warning-tint:  rgba(224, 170, 78, .18);  /* --aq-warning #e0aa4e */
  --aq-error-tint:    rgba(236, 98, 116, .18);  /* --aq-error   #ec6274 */
  --aq-info-tint:     rgba(85, 176, 223, .18);  /* --aq-info    #55b0df */
```

- [ ] **Step 3: Verify both themes define all the chip tokens**

```bash
cd /d/Github/airlinq-air && grep -c 'aq-success-tint\|aq-warning-tint\|aq-error-tint\|aq-info-tint' ui-ngx/src/styles.scss
```

Expected: `8` (four tint tokens × two themes).

Each tint also needs its paired **label** token (added at G2.5 for finding H-1 — the
full-strength semantic token does not meet 4.5:1 on its own tint):

```bash
cd /d/Github/airlinq-air && grep -c 'aq-success-chip-fg\|aq-warning-chip-fg\|aq-error-chip-fg\|aq-info-chip-fg\|aq-neutral-chip-fg' ui-ngx/src/styles.scss
```

Expected: `10` (five label tokens × two themes).

Re-derive the ratios after any change to either family:

```bash
cd /d/Github/airlinq-air && python .claude/team/artifacts/dashboard-and-grid-design-fidelity/contrast-check.py after
```

Every one of the 30 rows (5 tones × 2 themes × 3 row states) must be ≥ 4.5.

- [ ] **Step 4: Verify no `color-mix` entered the codebase**

```bash
cd /d/Github/airlinq-air && grep -rn 'color-mix' ui-ngx/src/ || echo "OK: no color-mix"
```

Expected: `OK: no color-mix`.

- [ ] **Step 5: Lint**

```bash
cd ui-ngx && yarn lint
```

Expected: zero errors.

- [ ] **Step 6: Stage and report**

```bash
git add ui-ngx/src/styles.scss
```

Suggested message: `feat(ui): add 18% semantic tint tokens for status chips`

---

### Task 3: Remap alarm severity colours onto the token layer — REJECTED, DO NOT IMPLEMENT

> **Status: implemented, then reverted at G2.5 review (finding C-3). Human-directed option (a).**
> This task is kept only so the idea is not re-proposed. Its steps must NOT be carried out.

The plan was to define `--tb-alarm-severity-*` (undefined anywhere in SCSS today) inside both
token blocks, remapping severity colour app-wide with no change to `alarm.models.ts`.

**Why it was rejected.** Because those tokens are undefined, every consumer currently falls
through to *distinct* per-severity fallbacks in `alarm.models.ts:89-107` — CRITICAL red, MAJOR
orange, MINOR amber, WARNING yellow. Aliasing them onto the `--aq-*` family collapses
MAJOR/MINOR/WARNING into one `--aq-warning` colour. That is fine inside our status chip, which
always carries a text label, but the tokens are also read by roughly five unrelated consumers
where the label is absent or colour is the only signal:

- `alarms-table-widget.component.ts:1155`
- `notification.component.ts:148` and `:162`
- `create-cf-alarm-rules.component.ts:71`
- `alarm-details-dialog.component.ts:70`

Touching those is unapproved scope, and the change would destroy severity differentiation exactly
where AC-18's text-label guarantee does not hold.

**What happens instead.** The alarm severity chip gets its colours from the contained
`--aq-*-tint` + `--aq-*-chip-fg` pair via `EntityStatusChipTableColumn` (Task 5), which *does*
always render a text label. `--tb-alarm-severity-*` stays undefined so every existing consumer
keeps its distinct fallback.

**Verification that the reversal held:**

```bash
cd /d/Github/airlinq-air && grep -c 'tb-alarm-severity' ui-ngx/src/styles.scss || echo "OK: 0 occurrences"
```

Expected: no matches in `styles.scss`.

- [ ] **Step 5: Lint**

```bash
cd ui-ngx && yarn lint
```

- [ ] **Step 6: Stage and report**

```bash
git add ui-ngx/src/styles.scss
```

Suggested message: `feat(ui): put alarm severity colours on the --aq-* token layer`

---

### Task 4: Create the `tb-status-chip` component and wire a `statusChip` column type

**Layer:** template + TypeScript. **Satisfies:** structure for AC-16, AC-18. Per ADR 0002.

This deliberately avoids the HTML-string route: the cell leaves the
`bypassSecurityTrustHtml` path (`entities-table.component.ts:657`) entirely. The label is a text
interpolation, so Angular escapes it.

**Files:**
- Create: `ui-ngx/src/app/modules/home/components/entity/status-chip.component.ts`
- Create: `ui-ngx/src/app/modules/home/components/entity/status-chip.component.html`
- Create: `ui-ngx/src/app/modules/home/components/entity/status-chip.component.scss`
- Modify: `ui-ngx/src/app/modules/home/components/home-components.module.ts` (declare + export)
- Modify: `ui-ngx/src/app/modules/home/models/entity/entities-table-config.models.ts:84`
  (type union) and add a column class
- Modify: `ui-ngx/src/app/modules/home/components/entity/entities-table.component.html:246-263`
  (new `@case`)

**Interfaces:**
- Consumes: `--aq-*-tint` (Task 2).
- Produces:
  - `StatusChipTone = 'success' | 'warning' | 'error' | 'info' | 'neutral'`
  - `StatusChipContent = { label: string; tone: StatusChipTone }`
  - `StatusChipComponent` with `@Input() label: string`, `@Input() tone: StatusChipTone`
  - `EntityStatusChipTableColumn<T>` with constructor
    `(key, title, width, statusContentFunction: (entity) => StatusChipContent, sortable?)`
  - column `type` value `'statusChip'`
  - Task 5 consumes `StatusChipContent` and `EntityStatusChipTableColumn`.

- [ ] **Step 1: Create the component class**

Create `ui-ngx/src/app/modules/home/components/entity/status-chip.component.ts`:

```ts
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

import { Component, Input } from '@angular/core';

/**
 * Semantic tone of a status chip. Maps to the `--aq-*` semantic token family;
 * never to a literal colour.
 */
export type StatusChipTone = 'success' | 'warning' | 'error' | 'info' | 'neutral';

/**
 * Data a table column supplies for one status cell. `label` is rendered as a
 * text interpolation (Angular escapes it), never as markup.
 */
export interface StatusChipContent {
  label: string;
  tone: StatusChipTone;
}

/**
 * A status pill: coloured dot + text label. Status is never conveyed by colour
 * alone — the label is always present, so the cell stays readable without
 * colour perception. Replaces the previous HTML-string pill, which carried
 * hardcoded colours in inline styles and had no dot.
 */
@Component({
    selector: 'tb-status-chip',
    templateUrl: './status-chip.component.html',
    styleUrls: ['./status-chip.component.scss'],
    standalone: false
})
export class StatusChipComponent {

  @Input()
  label: string;

  @Input()
  tone: StatusChipTone = 'neutral';
}
```

- [ ] **Step 2: Create the component template**

Create `ui-ngx/src/app/modules/home/components/entity/status-chip.component.html`:

```html
<!--

    Copyright © 2016-2026 The Thingsboard Authors

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

        http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

-->
<span class="tb-status-chip" [class]="'tb-status-chip-' + tone">
  <i class="tb-status-chip-dot" aria-hidden="true"></i>{{ label }}
</span>
```

The dot is `aria-hidden` (decorative); the label carries the meaning.

- [ ] **Step 3: Create the component styles**

Create `ui-ngx/src/app/modules/home/components/entity/status-chip.component.scss`:

```scss
/**
 * Copyright © 2016-2026 The Thingsboard Authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* Geometry from the design canvas: 6px dot, 999px radius, 12px/600 label,
   padding 2px 8px 2px 6px. Colour is always a --aq-* token pair (full-strength
   semantic colour on an 18% tint of itself) — never a literal, never color-mix. */
.tb-status-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 2px 8px 2px 6px;
  border-radius: 999px;
  font-size: 12px;
  font-weight: 600;
  line-height: 18px;
  white-space: nowrap;
}

.tb-status-chip-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: currentColor;
  flex: none;
}

.tb-status-chip-success { color: var(--aq-success); background: var(--aq-success-tint); }
.tb-status-chip-warning { color: var(--aq-warning); background: var(--aq-warning-tint); }
.tb-status-chip-error   { color: var(--aq-error);   background: var(--aq-error-tint); }
.tb-status-chip-info    { color: var(--aq-info);    background: var(--aq-info-tint); }
.tb-status-chip-neutral { color: var(--aq-text-3);  background: var(--aq-hover); }
```

The dot uses `background: currentColor`, so it always matches the label — one fewer place to
desynchronise.

- [ ] **Step 4: Declare and export the component**

In `ui-ngx/src/app/modules/home/components/home-components.module.ts`, add the import next to the
existing `EntityChipsComponent` import (line ~185):

```ts
import { StatusChipComponent } from '@home/components/entity/status-chip.component';
```

Add `StatusChipComponent,` to the `declarations` array immediately after `EntityChipsComponent,`
(line ~350), and add `StatusChipComponent,` to the `exports` array immediately after
`EntityChipsComponent,` (line ~507).

- [ ] **Step 5: Add the column type and column class**

In `ui-ngx/src/app/modules/home/models/entity/entities-table-config.models.ts`, change line 84
from:

```ts
export type EntityTableColumnType = 'content' | 'action' | 'link' | 'entityChips';
```

to:

```ts
export type EntityTableColumnType = 'content' | 'action' | 'link' | 'entityChips' | 'statusChip';
```

Add this import near the existing imports at the top of the file:

```ts
import { StatusChipContent } from '@home/components/entity/status-chip.component';
```

Then, immediately after the `EntityChipsEntityTableColumn` class (which ends around line 156),
add:

```ts
/**
 * A column whose cell is a status pill (dot + label) rendered by
 * `tb-status-chip`. Supplies structured data, not markup, so the cell never
 * reaches the `bypassSecurityTrustHtml` path used by 'content' columns.
 */
export class EntityStatusChipTableColumn<T extends BaseData<HasId>> extends BaseEntityTableColumn<T> {
  constructor(public key: string,
              public title: string,
              public width: string = '0px',
              public statusContentFunction: (entity: T) => StatusChipContent = () => ({label: '', tone: 'neutral'}),
              public sortable: boolean = true) {
    super('statusChip', key, title, width, sortable);
  }
}
```

Extend the `EntityColumn` union (line ~158) to include it:

```ts
export type EntityColumn<T extends BaseData<HasId>> = EntityTableColumn<T> | EntityActionTableColumn<T> | EntityLinkTableColumn<T> | EntityChipsEntityTableColumn<T> | EntityStatusChipTableColumn<T>;
```

- [ ] **Step 5b: Register the class in the `entityColumns` filter — MANDATORY, runtime-only failure**

> Added after G2.5 finding C-1. Omitting this step compiles cleanly, lints cleanly and passes
> every grep, but throws at runtime and the grid does not render at all.

`columnsUpdated()` in `ui-ngx/src/app/modules/home/components/entity/entities-table.component.ts`
(~line 677) builds **two** arrays that must agree:

- `entityColumns` — filtered by `instanceof`, drives the `matColumnDef` loop in the template;
- `displayedColumns` — built from the **unfiltered** `entitiesTableConfig.columns`, drives
  `mat-table`'s row rendering.

A column class missing from the `instanceof` filter still gets its key pushed into
`displayedColumns`, so `mat-table` looks for a column definition that was never created and throws
`Could not find column with id "active"`. Add the new class to the filter:

```ts
this.entityColumns = this.entitiesTableConfig.columns.filter(
  (column) => column instanceof EntityTableColumn || column instanceof EntityLinkTableColumn ||
    column instanceof EntityChipsEntityTableColumn || column instanceof EntityStatusChipTableColumn);
```

…and add `EntityStatusChipTableColumn` to that file's import block from
`@home/models/entity/entities-table-config.models` (without it the filter fails to compile).

**Verification is visual only.** No static check catches this; the grid must be opened in a
browser and observed to render rows.

- [ ] **Step 6: Render the new case in the shared table**

In `ui-ngx/src/app/modules/home/components/entity/entities-table.component.html`, inside the cell
`@switch (column.type)` block, add a `@case` immediately after the existing
`@case ('entityChips') { ... }` block (which ends at line 259):

```html
                    @case ('statusChip') {
                      @if (column.statusContentFunction(entity); as status) {
                        <tb-status-chip [label]="status.label" [tone]="status.tone"></tb-status-chip>
                      }
                    }
```

Leave the `@default` branch and every other case untouched.

- [ ] **Step 7: Build to verify the wiring compiles**

```bash
cd /d/Github/airlinq-air && mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true
```

Expected: `BUILD SUCCESS`. Grep the log for `BUILD SUCCESS` rather than trusting an exit code
(HANDOFF §10.3).

- [ ] **Step 8: Lint**

```bash
cd ui-ngx && yarn lint
```

Expected: zero errors. (No page uses the new column type yet, so there is no visual change —
Task 5 activates it.)

- [ ] **Step 9: Stage and report**

```bash
git add ui-ngx/src/app/modules/home/components/entity/status-chip.component.ts \
        ui-ngx/src/app/modules/home/components/entity/status-chip.component.html \
        ui-ngx/src/app/modules/home/components/entity/status-chip.component.scss \
        ui-ngx/src/app/modules/home/components/home-components.module.ts \
        ui-ngx/src/app/modules/home/models/entity/entities-table-config.models.ts \
        ui-ngx/src/app/modules/home/components/entity/entities-table.component.html
```

Suggested message: `feat(ui): add tb-status-chip component and statusChip column type`

---

### Task 5: Convert device state and alarm severity to status chips

**Layer:** TypeScript. **Satisfies:** AC-16, AC-17, AC-18.

**Files:**
- Modify: `ui-ngx/src/app/modules/home/pages/device/devices-table-config.resolver.ts` — column at
  line ~228, and delete `deviceState()`/`deviceStateStyle()` at lines 244-268
- Modify: `ui-ngx/src/app/modules/home/components/alarm/alarm-table-config.ts:126-131`

**Interfaces:**
- Consumes: `EntityStatusChipTableColumn`, `StatusChipContent` (Task 4); `--aq-*-tint` and
  `--aq-*-chip-fg` (Task 2). NOT `--tb-alarm-severity-*` — Task 3 was rejected; severity colour
  comes from the chip's own token pair.
- Produces: nothing consumed downstream.

D2 is binding: device state is **Active / Inactive only**. Do not add Watch/Alarm tones — the
canvas's Watch/Alarm chips are fixture artefacts.

- [ ] **Step 1: Replace the device state column**

In `ui-ngx/src/app/modules/home/pages/device/devices-table-config.resolver.ts`, find in
`configureColumns` (line ~228):

```ts
      new EntityTableColumn<DeviceInfo>('active', 'device.state', '80px',
        entity => this.deviceState(entity), entity => this.deviceStateStyle(entity))
```

Replace it with:

```ts
      new EntityStatusChipTableColumn<DeviceInfo>('active', 'device.state', '80px',
        entity => this.deviceStatus(entity))
```

- [ ] **Step 2: Replace the two colour-building methods with one data method**

In the same file, delete the whole `deviceState()` method (lines 244-256) and the whole
`deviceStateStyle()` method (lines 258-268), and put this in their place:

```ts
  /**
   * Device state as structured chip data. Active/Inactive only — no derived
   * Watch/Alarm state (that data does not exist). Colour is chosen by the
   * chip's `tone`, which maps to --aq-* tokens, so no colour literal lives
   * here any more.
   */
  private deviceStatus(device: DeviceInfo): StatusChipContent {
    return device.active
      ? {label: this.translate.instant('device.active'), tone: 'success'}
      : {label: this.translate.instant('device.inactive'), tone: 'error'};
  }
```

Update the imports in that file: add `EntityStatusChipTableColumn` to the existing import from
`@home/models/entity/entities-table-config.models`, and add:

```ts
import { StatusChipContent } from '@home/components/entity/status-chip.component';
```

If `EntityTableColumn` becomes unused after this change, leave it — the file's other columns still
use it. Do not remove imports the linter does not flag.

- [ ] **Step 3: Verify AC-17's grep passes**

```bash
cd /d/Github/airlinq-air && grep -nE '#198038|#d12730|rgba\(25, 128, 56|rgba\(209, 39, 48' \
  ui-ngx/src/app/modules/home/pages/device/devices-table-config.resolver.ts \
  || echo "OK: AC-17 satisfied — no hardcoded status colours remain"
```

Expected: `OK: AC-17 satisfied — no hardcoded status colours remain`.

- [ ] **Step 4: Convert the alarm severity column**

In `ui-ngx/src/app/modules/home/components/alarm/alarm-table-config.ts`, replace the severity
column (lines 126-131):

```ts
    this.columns.push(
      new EntityTableColumn<AlarmInfo>('severity', 'alarm.severity', '25%',
        (entity) => this.translate.instant(alarmSeverityTranslations.get(entity.severity)),
        entity => ({
          fontWeight: 'bold',
          color: alarmSeverityColors.get(entity.severity)
        })));
```

with:

```ts
    this.columns.push(
      new EntityStatusChipTableColumn<AlarmInfo>('severity', 'alarm.severity', '25%',
        (entity) => this.alarmSeverityStatus(entity)));
```

Then add this method to the same class, immediately before `getAssigneeTemplate` (line ~213):

```ts
  /**
   * Severity as chip data: pill + dot + text label, so severity is never
   * conveyed by colour alone. Severity values come from the existing
   * `alarmSeverityTranslations` / AlarmSeverity enum, unchanged. Tone maps to
   * the --aq-* semantic family; MAJOR/MINOR/WARNING share the warning tone
   * because the palette has no distinct amber/orange/yellow trio and the
   * label always disambiguates them.
   */
  private alarmSeverityStatus(entity: AlarmInfo): StatusChipContent {
    const label = this.translate.instant(alarmSeverityTranslations.get(entity.severity));
    switch (entity.severity) {
      case AlarmSeverity.CRITICAL:
        return {label, tone: 'error'};
      case AlarmSeverity.MAJOR:
      case AlarmSeverity.MINOR:
      case AlarmSeverity.WARNING:
        return {label, tone: 'warning'};
      default:
        return {label, tone: 'neutral'};
    }
  }
```

Update imports in that file: add `EntityStatusChipTableColumn` to the existing
`@home/models/entity/entities-table-config.models` import; add

```ts
import { StatusChipContent } from '@home/components/entity/status-chip.component';
```

and ensure `AlarmSeverity` is imported from `@shared/models/alarm.models` (the file already
imports `alarmSeverityTranslations` from there — add `AlarmSeverity` to that same import if it is
not already present). If `alarmSeverityColors` is now unused in the file, remove it from the
import to keep lint clean.

**Do not touch `getAssigneeTemplate`** — it carries a known XSS (design §7.2) and is out of scope.

- [ ] **Step 5: Build**

```bash
cd /d/Github/airlinq-air && mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 6: Verify the chips render in both themes**

With `yarn start`, open `/devices`. Each State cell should show a pill with a 6px dot and the text
"Active" or "Inactive". Verify the computed geometry against AC-16:

```js
const chip = document.querySelector('.tb-status-chip');
const dot  = document.querySelector('.tb-status-chip-dot');
const cs = getComputedStyle(chip);
console.log('font:', cs.fontSize, cs.fontWeight, '| radius:', cs.borderRadius,
            '| padding:', cs.padding, '| dot:', getComputedStyle(dot).width,
            getComputedStyle(dot).height, '| colour:', cs.color, '| bg:', cs.backgroundColor);
```

Expected: `12px 600`, `999px`, `2px 8px 2px 6px`, dot `6px 6px`. Light active: colour
`rgb(23, 96, 58)`, background `rgba(23, 96, 58, 0.18)`.

Repeat with `localStorage.setItem('tb-theme','dark'); location.reload();` — expect
`rgb(70, 192, 138)` / `rgba(70, 192, 138, 0.18)`.

Then open `/alarms` and confirm severity is now a pill + dot + label in both themes (AC-18), and
that severity remains readable if you force `color: inherit` on the chip (proving colour is not the
sole channel).

- [ ] **Step 7: Lint**

```bash
cd ui-ngx && yarn lint
```

- [ ] **Step 8: Stage and report**

```bash
git add ui-ngx/src/app/modules/home/pages/device/devices-table-config.resolver.ts \
        ui-ngx/src/app/modules/home/components/alarm/alarm-table-config.ts
```

Suggested message:

```
feat(ui): render device state and alarm severity as status chips

Device state and alarm severity become pill + dot + text label, so status is
never conveyed by colour alone. Both cells now supply structured data instead
of an HTML string, which also takes them off the bypassSecurityTrustHtml path.
Removes the hardcoded #198038/#d12730 status colours.
```

---

### Task 6: Make search always visible and add the record-count badge

**Layer:** template + TypeScript + stylesheet. **Satisfies:** AC-8, AC-9, AC-10.

Collapses the two rival toolbars into one. `textSearchMode` **keeps** its field and semantics (it
still tracks "a search term is active", which drives URL sync and is read at
`entities-table.component.ts:280,350` and written by `resetSortAndFilter`); it simply stops being
the visibility switch. This preserves `?textSearch=` deep links.

**Files:**
- Modify: `ui-ngx/src/app/modules/home/components/entity/entities-table.component.html` — lines
  40-52 (toolbar head), 99-106 (remove magnifier), 175-194 (delete second toolbar)
- Modify: `ui-ngx/src/app/modules/home/components/entity/entities-table.component.scss`
- Modify: `ui-ngx/src/styles.scss` (anatomy block)

**Interfaces:**
- Consumes: anatomy block scoped to both themes (Task 1).
- Produces: a single toolbar containing title, count badge, injected filter anchor, and search.
  Task 7 adds the selection dismiss; Task 8 adds the footer.

- [ ] **Step 1: Remove the visibility gate from the first toolbar and add the count badge**

In `entities-table.component.html`, replace lines 40-52:

```html
        <mat-toolbar class="mat-mdc-table-toolbar" [class.!hidden]="textSearchMode || !dataSource.selection.isEmpty()">
          <div class="mat-toolbar-tools">
            <div class="title-container flex flex-row items-center justify-start xs:flex-col xs:items-start xs:justify-center">
              @if (entitiesTableConfig.tableTitle) {
                <span class="tb-entity-table-title">{{ entitiesTableConfig.tableTitle }}</span>
              }
              <tb-anchor #entityTableHeader></tb-anchor>
              @if (entitiesTableConfig.useTimePageLink) {
                <tb-timewindow [(ngModel)]="timewindow"
                               (ngModelChange)="onTimewindowChange()"
                asButton strokedButton historyOnly [forAllTimeEnabled]="entitiesTableConfig.forAllTimeEnabled"></tb-timewindow>
              }
            </div>
```

with:

```html
        <mat-toolbar class="mat-mdc-table-toolbar" [class.!hidden]="!dataSource.selection.isEmpty()">
          <div class="mat-toolbar-tools">
            <div class="title-container flex flex-row items-center justify-start xs:flex-col xs:items-start xs:justify-center">
              @if (entitiesTableConfig.tableTitle) {
                <span class="tb-entity-table-title">{{ entitiesTableConfig.tableTitle }}</span>
              }
              @if (displayPagination) {
                <span class="tb-entity-table-count" [class.!hidden]="(dataSource.total() | async) === null">
                  {{ dataSource.total() | async }}
                </span>
              }
              <tb-anchor #entityTableHeader></tb-anchor>
              @if (entitiesTableConfig.useTimePageLink) {
                <tb-timewindow [(ngModel)]="timewindow"
                               (ngModelChange)="onTimewindowChange()"
                asButton strokedButton historyOnly [forAllTimeEnabled]="entitiesTableConfig.forAllTimeEnabled"></tb-timewindow>
              }
            </div>
```

The badge reads `dataSource.total()`, which is the filtered total, so AC-10 (badge follows the
search) is satisfied with no extra code.

- [ ] **Step 2: Replace the magnifier button with the always-visible search field**

In the same file, replace lines 99-106:

```html
            @if (entitiesTableConfig.searchEnabled) {
              <button
                mat-icon-button [disabled]="isLoading$ | async" (click)="enterFilterMode()"
                matTooltip="{{ translations.search | translate }}"
                matTooltipPosition="above">
                <mat-icon>search</mat-icon>
              </button>
            }
```

with:

```html
            @if (entitiesTableConfig.searchEnabled) {
              <div class="tb-entity-table-search">
                <mat-icon class="tb-entity-table-search-icon">search</mat-icon>
                <input #searchInput
                       [formControl]="textSearch"
                       [attr.aria-label]="translations.search | translate"
                       placeholder="{{ translations.search | translate }}"/>
                <button mat-icon-button class="tb-entity-table-search-clear"
                        [class.!hidden]="!textSearch.value"
                        (click)="exitFilterMode()"
                        [attr.aria-label]="'action.clear' | translate"
                        matTooltip="{{ 'action.clear' | translate }}"
                        matTooltipPosition="above">
                  <mat-icon>close</mat-icon>
                </button>
              </div>
            }
```

The placeholder uses the existing per-entity `translations.search` key (`device.search` =
"Search devices"), so AC-9's copy needs **no new translation key**.

- [ ] **Step 3: Delete the now-dead second toolbar**

Delete the entire second `mat-toolbar` block, lines 175-194 (from
`<mat-toolbar class="mat-mdc-table-toolbar" [class.!hidden]="!textSearchMode || ...">` through its
closing `</mat-toolbar>`). The `#searchInput` ViewChild it hosted now lives in the first toolbar,
so `enterFilterMode()`'s focus call still resolves.

- [ ] **Step 4: Keep `enterFilterMode` working for programmatic callers**

In `ui-ngx/src/app/modules/home/components/entity/entities-table.component.ts`, replace
`enterFilterMode()` (lines 562-569):

```ts
  enterFilterMode() {
    this.textSearchMode = true;
    setTimeout(() => {
      this.searchInputField.nativeElement.focus();
      this.searchInputField.nativeElement.setSelectionRange(0, 0);
    }, 10);
  }
```

with:

```ts
  /**
   * The search field is always visible now, so this only moves focus into it.
   * `textSearchMode` is still maintained because it drives the `textSearch`
   * query-param sync and is read by resetSortAndFilter().
   */
  enterFilterMode() {
    this.textSearchMode = true;
    setTimeout(() => {
      if (this.searchInputField) {
        this.searchInputField.nativeElement.focus();
        this.searchInputField.nativeElement.setSelectionRange(0, 0);
      }
    }, 10);
  }
```

Leave `exitFilterMode()` and `resetSortAndFilter()` unchanged — clearing the term is still the
right behaviour for the clear button.

- [ ] **Step 5: Style the badge and the search field**

In `ui-ngx/src/styles.scss`, inside the anatomy block that now opens
`.tb-default, .tb-dark {` at line ~1770, add before the block's closing brace:

```scss
  /* ---- toolbar: record-count badge + always-visible search (design canvas) ---- */
  .tb-entity-table-count {
    display: inline-flex;
    align-items: center;
    height: 20px;
    margin-left: 8px;
    padding: 0 8px;
    border-radius: 999px;
    background: var(--aq-surface-2);
    color: var(--aq-text-2);
    font-size: 12px;
    font-weight: 600;
  }
  .tb-entity-table-search {
    display: flex;
    align-items: center;
    gap: 8px;
    width: 260px;
    height: 36px;
    padding: 0 4px 0 12px;
    border-radius: 10px;
    border: 0;
    background: var(--aq-surface-2);

    .tb-entity-table-search-icon {
      flex: none;
      width: 18px;
      height: 18px;
      font-size: 18px;
      color: var(--aq-text-3);
    }
    input {
      flex: 1;
      min-width: 0;
      border: 0;
      outline: 0;
      background: transparent;
      color: var(--aq-text);
      font-size: 13px;
      font-family: inherit;
      &::placeholder { color: var(--aq-text-3); }
    }
    /* the pill styling removes Material's focus ring — put one back */
    &:focus-within {
      outline: 2px solid var(--aq-focus);
      outline-offset: 1px;
    }
    .tb-entity-table-search-clear.mat-mdc-icon-button {
      width: 28px;
      height: 28px;
      padding: 4px;
      --mdc-icon-button-state-layer-size: 28px;
      .mat-icon { width: 18px; height: 18px; font-size: 18px; }
    }
  }
```

- [ ] **Step 6: Build**

```bash
cd /d/Github/airlinq-air && mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 7: Verify AC-8, AC-9, AC-10 in both themes**

With `yarn start`, open `/devices`:

```js
const s = document.querySelector('.tb-entity-table-search');
const b = document.querySelector('.tb-entity-table-count');
console.log('search w/h:', getComputedStyle(s).width, getComputedStyle(s).height,
            '| radius:', getComputedStyle(s).borderRadius,
            '| bg:', getComputedStyle(s).backgroundColor,
            '| badge:', b.textContent.trim(), getComputedStyle(b).fontSize, getComputedStyle(b).fontWeight,
            getComputedStyle(b).borderRadius);
```

Expected: `260px 36px`, `10px`, badge `20` at `12px 600` with `999px`. Confirm the search field is
visible **without any click** (AC-9).

Type `CONTAINER` in the search box: the grid filters and the badge drops to the filtered total
(AC-10). Clear it and confirm the badge returns to 20.

Repeat the whole check in dark mode.

- [ ] **Step 8: Verify the deep-link regression (R4)**

Navigate to `/devices?textSearch=CONTAINER`. Expected: the search field is pre-filled with
`CONTAINER`, the grid is filtered, and the badge shows the filtered total.

- [ ] **Step 9: Verify a table with search disabled still works**

Open a page whose config sets `searchEnabled = false` if one exists in the running build; otherwise
temporarily set `searchEnabled = false` in `alarm-table-config.ts`, confirm the search field is
absent and the toolbar still lays out correctly, then revert that temporary edit.

- [ ] **Step 10: Keyboard check (R5)**

Tab into the toolbar. The search input must receive a visible focus ring in both themes, and the
clear button must be reachable by Tab and activatable with Enter.

- [ ] **Step 11: Lint**

```bash
cd ui-ngx && yarn lint
```

- [ ] **Step 12: Stage and report**

```bash
git add ui-ngx/src/app/modules/home/components/entity/entities-table.component.html \
        ui-ngx/src/app/modules/home/components/entity/entities-table.component.ts \
        ui-ngx/src/styles.scss
```

Suggested message:

```
feat(ui): make entity-table search always visible and add a count badge

Collapses the two mutually exclusive toolbars into one: the search field is now
permanently visible beside the title and actions instead of hiding behind a
magnifier toggle, and a record-count badge follows the filtered total.
textSearchMode is retained as state so ?textSearch= deep links still work.
```

---

### Task 7: Add the selection-bar dismiss control

**Layer:** template. **Satisfies:** AC-13, AC-14, AC-15.

AC-13's accent-container band and AC-14's "1 device selected" wording **already work** — the band
is styled at `styles.scss:1779-1784` and the ICU plural key `device.selected-devices` is already
rendered at `entities-table.component.html:199`. Only the dismiss (×) is missing.

**Files:**
- Modify: `ui-ngx/src/app/modules/home/components/entity/entities-table.component.html:196-212`

**Interfaces:**
- Consumes: `dataSource.selection` (existing `SelectionModel`).
- Produces: nothing consumed downstream.

- [ ] **Step 1: Add the dismiss button to the selection toolbar**

In `entities-table.component.html`, inside the selection `mat-toolbar` block, after the closing
`}` of the `@for (actionDescriptor of groupActionDescriptors; ...)` loop and before the closing
`</div>` of `.mat-toolbar-tools` (around line 210), add:

```html
              <button mat-icon-button
                      (click)="dataSource.selection.clear()"
                      [attr.aria-label]="'action.close' | translate"
                      matTooltip="{{ 'action.close' | translate }}"
                      matTooltipPosition="above">
                <mat-icon>close</mat-icon>
              </button>
```

`action.close` already exists as a translation key (it is used at line 189 today), so no new key
is needed.

- [ ] **Step 2: Build**

```bash
cd /d/Github/airlinq-air && mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true
```

- [ ] **Step 3: Verify AC-13, AC-14, AC-15 in both themes**

On `/devices`, tick one row checkbox:

```js
const t = document.querySelector('mat-toolbar.mat-mdc-table-toolbar.mat-primary');
console.log('bar bg:', getComputedStyle(t).backgroundColor,
            '| colour:', getComputedStyle(t).color,
            '| height:', getComputedStyle(t).height,
            '| text:', t.querySelector('.tb-entity-table-info').textContent.trim());
```

Expected light: background `rgb(191, 241, 251)` (`--aq-accent-container`), colour
`rgb(0, 54, 62)`, height `40px`, text `1 device selected`. Dark: background `rgb(14, 90, 102)`,
colour `rgb(191, 241, 251)`.

Tick a second row: the text must read `2 devices selected` (plural, AC-14).

Click the × : the selection clears and the normal toolbar returns (AC-15).

- [ ] **Step 4: Keyboard check**

With a row selected, Tab to the × and press Enter. The selection must clear.

- [ ] **Step 5: Lint**

```bash
cd ui-ngx && yarn lint
```

- [ ] **Step 6: Stage and report**

```bash
git add ui-ngx/src/app/modules/home/components/entity/entities-table.component.html
```

Suggested message: `feat(ui): add a dismiss control to the entity-table selection bar`

---

### Task 8: Replace the footer with a range label and windowed numbered pager

**Layer:** template + TypeScript + stylesheet + i18n. **Satisfies:** AC-20, AC-21, AC-22, AC-23.

Per design §4.3 Option B: `MatPaginator` **stays** as the state owner so `pageIndex`/`pageSize`,
the existing `page` subscription in `updatePaginationSubscriptions`, the `?page=` deep-link param
and the `ResizeObserver`/`hidePageSize` behaviour all keep working. Its default range and nav
chrome are hidden; a numbered strip is added beside it. D3 is binding: **windowed** pager,
~5 chips with ellipsis.

**Files:**
- Modify: `ui-ngx/src/app/shared/services/custom-paginator-intl.ts:35-39`
- Modify: `ui-ngx/src/assets/locale/locale.constant-en_US.json` (`paginator` block, ~line 10550)
- Modify: `ui-ngx/src/app/modules/home/components/entity/entities-table.component.ts`
- Modify: `ui-ngx/src/app/modules/home/components/entity/entities-table.component.html:376-387`
- Modify: `ui-ngx/src/styles.scss` (anatomy block)

**Interfaces:**
- Consumes: `MatPaginator` (`@ViewChild(MatPaginator) paginator`), `dataSource.total()`.
- Produces:
  - `pageNumbers: Array<number | null>` — page indices to render as chips, `null` = ellipsis
  - `rangeText: string` — just the "1–10" part; the words come from translation keys
  - `goToPage(pageIndex: number): void`
  - `totalPages: number`

- [ ] **Step 1: Add the range translation key**

In `ui-ngx/src/assets/locale/locale.constant-en_US.json`, extend the `paginator` block (line
10550-10557) to add one key:

```json
    "paginator" : {
        "items-per-page": "Items per page:",
        "first-page-label": "First page",
        "last-page-label": "Last page",
        "next-page-label": "Next page",
        "previous-page-label": "Previous page",
        "items-per-page-separator": "of",
        "showing-range": "Showing {{range}} of {{total}}",
        "rows-per-page": "Rows per page"
    },
```

Only these two keys are added; the six existing keys keep their values. Do **not** edit the other
27 locale files (ngx-translate falls back to en_US).

- [ ] **Step 2: Emit the canvas range wording from `CustomPaginatorIntl`**

In `ui-ngx/src/app/shared/services/custom-paginator-intl.ts`, replace `getRangeLabel`
(lines 35-39):

```ts
  getRangeLabel(page: number, pageSize: number, length: number): string {
    const startNumber = page * pageSize + 1;
    const endNumber = pageSize * (page + 1);
    return `${startNumber} – ${endNumber > length ? length : endNumber}  ${this.separator} ${length}`;
  }
```

with:

```ts
  /**
   * "Showing 1–10 of 20", per the design canvas: an en dash inside the range,
   * and the wording supplied by a translation key rather than assembled from
   * fragments. The range is returned as plain text; the template applies the
   * 600-weight emphasis, so the translated string stays markup-free.
   */
  getRangeLabel(page: number, pageSize: number, length: number): string {
    if (!length || !pageSize) {
      return this.translate.instant('paginator.showing-range', {range: '0', total: length ?? 0});
    }
    const startNumber = page * pageSize + 1;
    const endNumber = Math.min(pageSize * (page + 1), length);
    return this.translate.instant('paginator.showing-range',
      {range: `${startNumber}–${endNumber}`, total: length});
  }
```

`–` is the en dash AC-20 requires. `this.translate` is already injected in the constructor.

- [ ] **Step 3: Compute the windowed page list in the table component**

In `ui-ngx/src/app/modules/home/components/entity/entities-table.component.ts`, add these members
to the class (next to the existing `hidePageSize` / `pageSizeOptions` declarations around line
105):

```ts
  /** Total record count last reported by the data source; drives the pager. */
  totalEntities = 0;
  /** Page indices to render as chips; `null` marks an ellipsis gap. */
  pageNumbers: Array<number | null> = [];
```

Add these methods to the class (place them next to `enterFilterMode`, around line 562):

```ts
  /** Number of pages currently available. */
  get totalPages(): number {
    if (!this.displayPagination || !this.pageLink.pageSize) {
      return 1;
    }
    return Math.max(1, Math.ceil(this.totalEntities / this.pageLink.pageSize));
  }

  /**
   * Windowed page list: up to 5 numbered chips around the current page, with
   * `null` standing in for an elided run, plus always the first and last page.
   * Keeps the footer a fixed width however many pages exist (D3).
   */
  private updatePageNumbers() {
    const total = this.totalPages;
    const current = this.pageLink.page;
    const windowSize = 5;
    if (total <= windowSize + 2) {
      this.pageNumbers = Array.from({length: total}, (_, i) => i);
      return;
    }
    const half = Math.floor(windowSize / 2);
    let start = Math.max(1, current - half);
    let end = Math.min(total - 2, start + windowSize - 1);
    start = Math.max(1, end - windowSize + 1);
    const pages: Array<number | null> = [0];
    if (start > 1) {
      pages.push(null);
    }
    for (let i = start; i <= end; i++) {
      pages.push(i);
    }
    if (end < total - 2) {
      pages.push(null);
    }
    pages.push(total - 1);
    this.pageNumbers = pages;
  }

  /** Move to `pageIndex` through MatPaginator so every existing subscription fires. */
  goToPage(pageIndex: number) {
    if (pageIndex < 0 || pageIndex > this.totalPages - 1 || pageIndex === this.pageLink.page) {
      return;
    }
    this.paginator.pageIndex = pageIndex;
    this.paginator.page.emit({
      pageIndex,
      pageSize: this.paginator.pageSize,
      length: this.paginator.length
    });
  }

  /**
   * Just the "1-10" part of the range; the surrounding words come from
   * translation keys in the template, so the translated strings stay
   * markup-free. Deliberately does NOT reach into MatPaginator's `_intl`
   * (a private Material API used nowhere else in this codebase).
   */
  get rangeText(): string {
    if (!this.totalEntities || !this.pageLink.pageSize) {
      return '0';
    }
    const start = this.pageLink.page * this.pageLink.pageSize + 1;
    const end = Math.min(this.pageLink.pageSize * (this.pageLink.page + 1), this.totalEntities);
    return `${start}–${end}`;
  }
```

Now keep `totalEntities` and the chip list current. `EntitiesDataSource` exposes exactly one
total API — `total(): Observable<number>` over a `BehaviorSubject`
(`ui-ngx/src/app/modules/home/models/datasource/entity-datasource.ts:103-107`), so it resolves
synchronously. There is **no** `currentPageTotal` property; do not invent one.

Find `dataLoaded` (line 438) and add to the end of its body:

```ts
    this.dataSource.total().pipe(take(1)).subscribe((total) => {
      this.totalEntities = total ?? 0;
      this.updatePageNumbers();
      this.cd.markForCheck();
    });
```

Add `take` to the existing `rxjs/operators` import in this file.

- [ ] **Step 4: Render the footer**

In `entities-table.component.html`, replace lines 376-387:

```html
        @if (displayPagination) {
          <mat-divider></mat-divider>
        }
        @if (displayPagination) {
          <mat-paginator
            [length]="dataSource.total() | async"
            [pageIndex]="pageLink.page"
            [pageSize]="pageLink.pageSize"
            [pageSizeOptions]="pageSizeOptions"
            [hidePageSize]="hidePageSize"
          showFirstLastButtons></mat-paginator>
        }
```

with:

```html
        @if (displayPagination) {
          <mat-divider></mat-divider>
          <div class="tb-entity-table-footer">
            <span class="tb-entity-table-range">
              {{ 'paginator.showing' | translate }}
              <b>{{ rangeText }}</b>
              {{ 'paginator.items-per-page-separator' | translate }} {{ totalEntities }}
            </span>
            <span class="flex-1"></span>
            <!-- MatPaginator is retained as the page-state owner (it drives the
                 existing page subscription, the ?page= deep link and the
                 responsive hidePageSize behaviour). Its range label and nav
                 buttons are hidden; the numbered strip below replaces them. -->
            <mat-paginator class="tb-entity-table-paginator-host"
              [length]="dataSource.total() | async"
              [pageIndex]="pageLink.page"
              [pageSize]="pageLink.pageSize"
              [pageSizeOptions]="pageSizeOptions"
              [hidePageSize]="hidePageSize"
            showFirstLastButtons></mat-paginator>
            <div class="tb-entity-table-pager" role="group"
                 [attr.aria-label]="'paginator.showing-range' | translate:{range: '', total: totalEntities}">
              <button mat-icon-button [disabled]="pageLink.page === 0"
                      (click)="goToPage(0)"
                      [attr.aria-label]="'paginator.first-page-label' | translate"
                      matTooltip="{{ 'paginator.first-page-label' | translate }}"
                      matTooltipPosition="above">
                <mat-icon>first_page</mat-icon>
              </button>
              <button mat-icon-button [disabled]="pageLink.page === 0"
                      (click)="goToPage(pageLink.page - 1)"
                      [attr.aria-label]="'paginator.previous-page-label' | translate"
                      matTooltip="{{ 'paginator.previous-page-label' | translate }}"
                      matTooltipPosition="above">
                <mat-icon>chevron_left</mat-icon>
              </button>
              @for (p of pageNumbers; track $index) {
                @if (p === null) {
                  <span class="tb-entity-table-pager-gap" aria-hidden="true">…</span>
                } @else {
                  <button class="tb-entity-table-pager-chip"
                          [class.tb-active]="p === pageLink.page"
                          [attr.aria-current]="p === pageLink.page ? 'page' : null"
                          (click)="goToPage(p)">{{ p + 1 }}</button>
                }
              }
              <button mat-icon-button [disabled]="pageLink.page >= totalPages - 1"
                      (click)="goToPage(pageLink.page + 1)"
                      [attr.aria-label]="'paginator.next-page-label' | translate"
                      matTooltip="{{ 'paginator.next-page-label' | translate }}"
                      matTooltipPosition="above">
                <mat-icon>chevron_right</mat-icon>
              </button>
              <button mat-icon-button [disabled]="pageLink.page >= totalPages - 1"
                      (click)="goToPage(totalPages - 1)"
                      [attr.aria-label]="'paginator.last-page-label' | translate"
                      matTooltip="{{ 'paginator.last-page-label' | translate }}"
                      matTooltipPosition="above">
                <mat-icon>last_page</mat-icon>
              </button>
            </div>
          </div>
        }
```

The chips are real `<button>` elements (focusable, Enter/Space-activatable) and disabled states use
the native `disabled` attribute, so AT and tab order behave correctly. `[innerText]` (not
`innerHTML`) is used for the range so the translated string can never inject markup.

- [ ] **Step 5: Render the range with the numbers emphasised**

AC-20 needs "Showing **1–10** of 20" with the range at `font-weight: 600` in `--aq-text`. The
template in Step 4 already builds it from parts, so no markup is ever interpolated into a
translated string and translators cannot break the DOM.

`paginator.items-per-page-separator` ("of") already exists. Add the one remaining key to the
`paginator` block in `locale.constant-en_US.json` alongside those from Step 1:

```json
        "showing": "Showing",
```

`CustomPaginatorIntl.getRangeLabel` from Step 2 stays in place — it still serves every other
`mat-paginator` in the app.

- [ ] **Step 5b: Style the footer, chips and range**

In `ui-ngx/src/styles.scss`, inside the anatomy block, add before its closing brace:

```scss
  /* ---- footer: range wording, rows-per-page chip, numbered pager (canvas) ---- */
  .tb-entity-table-footer {
    display: flex;
    align-items: center;
    gap: 16px;
    height: 52px;
    padding: 0 20px;
    border-top: 1px solid var(--aq-border);
    font-size: 13px;
    color: var(--aq-text-2);
  }
  .tb-entity-table-range {
    white-space: nowrap;
    color: var(--aq-text-2);

    b { font-weight: 600; color: var(--aq-text); }
  }

  /* MatPaginator is kept only for page state — hide its range + nav chrome,
     leave its rows-per-page selector visible (AC-23). */
  .tb-entity-table-paginator-host {
    background: transparent !important;
    border-top: 0 !important;
    .mat-mdc-paginator-range-actions .mat-mdc-icon-button,
    .mat-mdc-paginator-range-label { display: none !important; }
    .mat-mdc-paginator-container { padding: 0; min-height: 0; }
  }

  .tb-entity-table-pager {
    display: flex;
    align-items: center;
    gap: 4px;
    color: var(--aq-text-3);

    .mat-mdc-icon-button.mat-mdc-button-base {
      width: 32px;
      height: 32px;
      padding: 4px;
      border-radius: var(--aq-radius-sm);
      --mdc-icon-button-state-layer-size: 32px;
      &:not([disabled]):hover { background: var(--aq-hover); }
      &[disabled] { color: var(--aq-text-disabled); }
    }
    .tb-entity-table-pager-chip {
      width: 32px;
      height: 32px;
      border: 0;
      border-radius: var(--aq-radius-sm);
      background: transparent;
      color: var(--aq-text-2);
      font-size: 13px;
      font-family: inherit;
      cursor: pointer;
      &:hover { background: var(--aq-hover); }
      &:focus-visible { outline: 2px solid var(--aq-focus); outline-offset: 1px; }
      &.tb-active {
        background: var(--aq-accent-container);
        color: var(--aq-on-accent-container);
        font-weight: 600;
      }
    }
    .tb-entity-table-pager-gap {
      width: 20px;
      text-align: center;
      color: var(--aq-text-disabled);
    }
  }
```

- [ ] **Step 6: Style the rows-per-page chip label (AC-23)**

The existing rule at `styles.scss:1858` already renders the rows-per-page select as a 30px,
8px-radius outlined chip. Confirm it still applies inside
`.tb-entity-table-paginator-host` and, if the label is hidden by the chrome-hiding rule in Step 5,
add:

```scss
  .tb-entity-table-paginator-host .mat-mdc-paginator-page-size-label {
    color: var(--aq-text-2);
    font-size: 13px;
  }
```

- [ ] **Step 7: Build**

```bash
cd /d/Github/airlinq-air && mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true
```

Expected: `BUILD SUCCESS`.

- [ ] **Step 8: Verify AC-20, AC-21, AC-22, AC-23 in both themes**

On `/devices` (20 devices, page size 10):

```js
const f = document.querySelector('.tb-entity-table-footer');
const active = document.querySelector('.tb-entity-table-pager-chip.tb-active');
console.log('range:', f.querySelector('.tb-entity-table-range').textContent.replace(/\s+/g,' ').trim(),
            '| chips:', [...document.querySelectorAll('.tb-entity-table-pager-chip')].map(c=>c.textContent.trim()),
            '| active:', active.textContent.trim(),
            getComputedStyle(active).backgroundColor, getComputedStyle(active).fontWeight,
            '| chip size:', getComputedStyle(active).width, getComputedStyle(active).height);
```

Expected: range `Showing 1–10 of 20` with an **en dash**; chips `['1','2']`; active `1` with
background `rgb(191, 241, 251)` in light / `rgb(14, 90, 102)` in dark, `font-weight: 600`, size
`32px 32px`.

Confirm first/prev are `disabled` on page 1 and render in `--aq-text-disabled` (AC-21).

Click chip `2` → grid loads page 2, chip 2 becomes active, range reads `Showing 11–20 of 20`
(AC-22).

Change rows-per-page to 20 → grid re-pages, range reads `Showing 1–20 of 20`, and the select is a
30px/8px-radius outlined chip (AC-23).

- [ ] **Step 9: Verify the responsive and deep-link regressions (R2)**

- Narrow the window below the `hidePageSizePixelValue` threshold: the rows-per-page control must
  hide, exactly as before the change, and the numbered strip must not overflow the footer.
- Navigate to `/devices?page=1`: the grid must open on page 2 with chip 2 active.
- Sort by a column while on page 2: the pager must reset to page 1 (existing behaviour).

- [ ] **Step 10: Verify a windowed case**

On a table with many pages (e.g. `/auditLogs` with page size 10), confirm the strip shows about
5 numbered chips plus first/last with `…` gaps, and that it does not grow with total page count
(D3).

- [ ] **Step 11: Keyboard check (R5)**

Tab through the footer: every chip and nav button must be focusable with a visible focus ring in
both themes; Enter must activate; disabled first/prev must be skipped; the `…` must not be
focusable.

- [ ] **Step 12: Lint**

```bash
cd ui-ngx && yarn lint
```

- [ ] **Step 13: Stage and report**

```bash
git add ui-ngx/src/app/shared/services/custom-paginator-intl.ts \
        ui-ngx/src/assets/locale/locale.constant-en_US.json \
        ui-ngx/src/app/modules/home/components/entity/entities-table.component.ts \
        ui-ngx/src/app/modules/home/components/entity/entities-table.component.html \
        ui-ngx/src/styles.scss
```

Suggested message:

```
feat(ui): add a range label and windowed numbered pager to entity tables

The footer now reads "Showing 1-10 of 20" and offers first/prev, ~5 numbered
page chips with ellipsis, and next/last. MatPaginator is retained as the page
state owner so the existing page subscription, ?page= deep links and the
responsive hidePageSize behaviour are unaffected; only its range and nav
chrome are hidden.
```

---

### Task 9: Full regression sweep, both themes

**Layer:** verification only — no code change expected. **Satisfies:** AC-33, AC-34, AC-35,
AC-36, AC-37, AC-40.

The shared component backs 10+ tables (design §2.2), so this task is where R1 is caught. If a
defect is found, fix it in the task that introduced it rather than patching here.

**Files:**
- Create: screenshots under `.claude/team/artifacts/dashboard-and-grid-design-fidelity/`

**Interfaces:**
- Consumes: Tasks 1–8.
- Produces: screenshot evidence for AC-40 and a pass/fail record for AC-36/AC-37.

- [ ] **Step 1: Verify AC-33 — no colour literal outside the token blocks**

```bash
cd /d/Github/airlinq-air && git diff --unified=0 -- ui-ngx/src/styles.scss \
  | grep -E '^\+' | grep -vE '^\+\+\+' \
  | grep -nE '#[0-9a-fA-F]{3,8}\b|rgba?\(' 
```

Every hit must be one of the `--aq-*-tint` or `--aq-*-chip-fg` declarations added inside the
`.tb-default` / `.tb-dark` token blocks in Task 2. Any hit inside a rule body is a violation.
There must be no `--tb-alarm-severity-*` declarations at all (Task 3 rejected).

```bash
# No colour literal may be added in any touched .ts or .html
cd /d/Github/airlinq-air && git diff -- '*.ts' '*.html' | grep -E '^\+' | grep -vE '^\+\+\+' \
  | grep -nE '#[0-9a-fA-F]{3,6}\b|rgba?\(' || echo "OK: no colour literals in ts/html"
```

Expected: `OK: no colour literals in ts/html`.

- [ ] **Step 2: Verify AC-34 — lint**

```bash
cd ui-ngx && yarn lint
```

Expected: zero errors.

- [ ] **Step 3: Verify AC-35 — build and licence headers**

```bash
cd /d/Github/airlinq-air && mvn install -pl application -am -Dskip.installyarn=true 2>&1 | tee /tmp/build.log | tail -20
grep -c 'BUILD SUCCESS' /tmp/build.log
```

Note this run **omits** `-Dlicence.skip` so `license:check` actually runs and proves the three new
files carry the Apache header. If `license:check` fails on unrelated untracked files, run
`mvn -T 1C license:format` and re-check that only the three new files were modified.

- [ ] **Step 4: Verify AC-37 — functional non-regression on the three main pages**

For **each** of `/devices`, `/assets`, `/alarms`, in **both** themes, perform and confirm:

| Action | Expected |
|---|---|
| Sort by a column header | Rows reorder; pager resets to page 1 |
| Page via a numbered chip | Correct rows; range label updates |
| Search a term | Grid filters; count badge updates |
| Select-all via header checkbox | Selection bar shows correct plural count |
| Open the details drawer (click a row) | Drawer opens with the right entity |
| Use one row action | Action executes as before |

- [ ] **Step 5: Verify AC-36 — the wider table sweep**

Open each of these in **both** themes and confirm the grid renders with the new anatomy, no
light-surface / near-black-text leak in dark, and no layout break:

`/auditLogs`, `/security-settings/api-keys` (or the API-keys route in this build),
`/alarm-rules`, `/calculated-fields` (via a device profile), the event table (via a device's
Events tab), and the edge downlink table if edges are enabled.

Specifically confirm on a table with `searchEnabled = false` or `displayPagination = false` that
the toolbar and footer degrade cleanly.

- [ ] **Step 6: Verify AC-36 — shell and login non-regression**

In both themes: the collapsed icon rail and its flyout popovers, the pinned-open rail, the
entity-details drawer, the Container Operations dashboard, and `/login` must all render as before.
The rail is **not** in scope for change — any difference here is a regression.

- [ ] **Step 7: Capture AC-40 screenshot evidence**

```bash
mkdir -p /d/Github/airlinq-air/.claude/team/artifacts/dashboard-and-grid-design-fidelity
```

Capture, in **both** themes (8 images minimum): Home dashboard, `/devices`, `/assets`, `/alarms`.
Name them `<page>-<theme>.png`. Use the dev server per HANDOFF §9; if driving headless Chrome,
**never** clean up with `pkill chrome` — match `--user-data-dir=/tmp/cdp-profile` (HANDOFF §9).

- [ ] **Step 8: Report**

Summarise pass/fail per criterion for AC-33 through AC-37 and AC-40. Report any deviation to the
technical-architect rather than adjusting the design unilaterally.

---

### Task 10: Dashboard configuration on the demo server — HUMAN-EXECUTED

**Layer:** server-config (REST on the demo host). **Satisfies:** AC-24 (context line), AC-25,
AC-26, AC-27, AC-28, AC-29, AC-30, AC-38.

**This task is NOT executed by an agent.** It mutates live tenant data on the demo server. It runs
only after the human approves it separately, following the code tasks. The dashboard exists only
as tenant data in PostgreSQL on the server, **not in git** (HANDOFF §6.4).

**Blocked on a G2 decision** (design §13.1): AC-27/28's segmented bar is not a stock ThingsBoard
widget type. The human must choose (a) a small custom widget, reusing the mechanism that already
ships `tenant.airlinq.container_corner_state`, or (b) an approximation with a stacked bar chart
widget. Design recommends (a). Do not start this task before that decision.

**Files:**
- Create: `.claude/team/artifacts/dashboard-and-grid-design-fidelity/container-operations-backup-<stamp>.json`

- [ ] **Step 1: Take the AC-38 backup FIRST — before any change**

```bash
# $JWT from POST /api/auth/login with the tenant-admin account (credentials in
# the gitignored CLAUDE.md — never paste them into a file or a commit).
mkdir -p .claude/team/artifacts/dashboard-and-grid-design-fidelity
curl -s -H "X-Authorization: Bearer $JWT" \
  http://10.221.89.67:8080/api/dashboard/44076f90-a5f3-11f1-8cd8-d5f3ffee79db \
  -o .claude/team/artifacts/dashboard-and-grid-design-fidelity/container-operations-backup-$(date +%Y%m%d-%H%M%S).json
```

Verify the backup is a complete dashboard, not an error payload:

```bash
python -c "import json,glob,sys; f=sorted(glob.glob('.claude/team/artifacts/dashboard-and-grid-design-fidelity/container-operations-backup-*.json'))[-1]; d=json.load(open(f)); print(f, '| widgets:', len(d['configuration']['widgets']), '| version:', d.get('version'))"
```

Expected: 19 widgets (HANDOFF §6.4). **Do not proceed if this fails.**

- [ ] **Step 2: Record the restore command in the delivery notes (AC-38)**

```bash
# Restore: POST with a body carrying the original id performs an update.
curl -s -X POST -H "X-Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  http://10.221.89.67:8080/api/dashboard \
  -d @.claude/team/artifacts/dashboard-and-grid-design-fidelity/container-operations-backup-<stamp>.json
```

- [ ] **Step 3: Apply the widget changes, one widget at a time**

Observe HANDOFF §10.1 for every edit — these have each broken this dashboard before:

- Build each widget config from `GET /api/widgetType?fqn=system.<fqn>` → `defaultConfig`, and
  override **only** `datasources` / `title`. A hand-written `settings: {}` breaks the widget.
- `timewindow.realtime.realtimeType` must be `0` (LAST_INTERVAL). `1` silently fetches a whole day
  and the widget spins forever.
- A widget-level `timewindow` must be **complete**: a full `history` block plus
  `quickInterval` / `hideInterval` / `hideLastInterval` / `hideQuickInterval` under `realtime`.
- Aggregation bucket ≥ 60s (the publish interval), or buckets come back empty.
- `AVG` blanks string keys — those need `agg: NONE`.
- In `dashboardCss`, never put a comment line immediately before `@media` (it truncates the
  stylesheet); leave a blank line.

Changes, by criterion:

| AC | Widget | Change |
|---|---|---|
| AC-24 | new markdown/HTML card, or `dashboardCss` | Context line under the title, 12px in `--aq-text-3` |
| AC-25 | 4 × `cards.value_card` | Uppercase 11px/500/.06em label, 32px/600 value, one 12px context line |
| AC-26 | Misaligned tile | Error-tinted border, visibly distinct from the other three tiles |
| AC-27 | fleet-health progress bar | Replace with the segmented bar chosen at G2 (3 segments, 10px, 999px, 2px gaps) |
| AC-28 | same | Legend with a swatch + label + count per segment; widths proportional |
| AC-29 | alignment chart | Grid in `--aq-chart-grid` lighter than the `--aq-chart-axis` axis; 2px series; dashed threshold rule **with a visible "alarm 3.0°" label** |
| AC-30 | same | Legend chips (line swatch per series) + 1h/6h/24h range pills, active pill in accent-container |

- [ ] **Step 4: Verify each widget still loads**

After **each** widget change, reload the dashboard and confirm the widget renders data rather than
spinning. A spinning widget means a `timewindow` / `realtimeType` / aggregation mistake — fix it
before moving to the next widget. Verify in **both** themes.

- [ ] **Step 5: Confirm AC-31 needs no config**

The dashboard's alarms table inherits the shared grid anatomy and the status chip from the code
tasks. Confirm it shows the `--aq-surface-2` header band with 11px uppercase labels, 1px row
dividers, hover state, and severity as pill + dot — with **no** config change.

- [ ] **Step 6: Re-capture dashboard screenshots**

Refresh the Home-dashboard images in
`.claude/team/artifacts/dashboard-and-grid-design-fidelity/` for both themes (AC-40).

- [ ] **Step 7: Deploy and verify the bundle (AC-39)**

Only after the human approves deployment. Follow HANDOFF §4.2: tar backup of
`/usr/share/thingsboard` + `/etc/thingsboard`, keep the previous RPM as
`/tmp/thingsboard.prev.rpm`, md5-verified upload, `rpm -Uvh --force`, confirm the conf md5 is
unchanged.

```bash
# Build the RPM. NOTE: any -Dpkg.skip.* flag silently disables the packaging
# profile and you get a plain jar with no RPM (HANDOFF §8.6).
cd /d/Github/airlinq-air
mvn install -pl application -am -DskipTests -Dlicense.skip=true
mvn install -pl application -Ppackaging -DskipTests -Dlicense.skip=true
```

Post-deploy checks:

```bash
# /login returns 200 within 120s
curl -s -o /dev/null -w '%{http_code}\n' --max-time 120 http://10.221.89.67:8080/login
```

Confirm the served bundle carries the change — component styles ship in the **JS chunks**, so
check both:

```bash
# on the server, or against the served URLs
grep -o 'tb-status-chip' /usr/share/thingsboard/web/public/main-*.js | head -1
grep -o 'tb-entity-table-pager' /usr/share/thingsboard/web/public/styles-*.css | head -1
```

Both greps must hit. A changed bundle hash alone is not sufficient evidence.

---

## Self-review

**Spec coverage.** Every criterion AC-1…AC-41 maps to a task via design §9:

- AC-1…AC-7, AC-19, AC-23: already satisfied by the existing anatomy block; Task 1 confirms them
  in both themes and Task 9 verifies them.
- AC-8, AC-9, AC-10: Task 6. AC-11, AC-12: existing rules at `styles.scss:1839` (design §9);
  verified in Task 9 Step 5. AC-13, AC-14, AC-15: Task 7. AC-16, AC-17, AC-18: Tasks 4–5.
- AC-20, AC-21, AC-22: Task 8. AC-24…AC-30: Task 10. AC-31: code tasks, verified Task 10 Step 5.
- AC-32: Task 1. AC-33…AC-37, AC-40: Task 9. AC-38, AC-39: Task 10.
- AC-41: human-judged at G4; no agent check invented, as the requirement demands.

**Placeholder scan.** No "TBD"/"TODO"/"handle edge cases"; every code step carries the actual
code. Two API traps were checked against the source rather than assumed and are pinned in the
plan: `EntitiesDataSource` exposes only `total(): Observable<number>` (there is no
`currentPageTotal`), and `MatPaginator._intl` is a private Material API used nowhere else in this
codebase, so the range text is computed in the component instead.

**Type consistency.** `StatusChipContent {label, tone}` and `StatusChipTone` are defined in Task 4
Step 1 and consumed with those exact names in Task 5 Steps 2 and 4. `EntityStatusChipTableColumn`
is defined in Task 4 Step 5 with the constructor
`(key, title, width, statusContentFunction, sortable)` and called with that arity in Task 5.
`statusContentFunction` is the same name in the class, the template `@case` (Task 4 Step 6) and
both call sites. `pageNumbers`, `totalPages`, `goToPage`, `rangeText` and `totalEntities` are
defined in Task 8 Step 3 and used with those names in Step 4's template.

**Known gap deliberately left.** The design's §7.2 HIGH stored-XSS finding
(`getAssigneeTemplate`) has **no task** — it is out of scope per requirement §4 and is escalated
to the human as a separate work item. The plan instead forbids extending that pattern (Global
Constraints, Task 5 Step 4).
