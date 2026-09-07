# 0001 — Accept Angular template edits in the ThingsBoard fork for design fidelity

- **Status:** proposed (awaiting human approval at G2)
- **Date:** 2026-09-04
- **Deciders:** human (product owner), technical-architect
- **Context work item:** `dashboard-and-grid-design-fidelity`

## Context

This repository is a fork of ThingsBoard 4.4.0-SNAPSHOT that is periodically rebased on
`upstream/master`. Until now the Airlinq theming rule was deliberately **token-layer and
stylesheet only** — no `.html` or `.ts` edits — precisely to keep rebase cost near zero
(`.claude/team/memory/MEMORY.md`; HANDOFF §8.6: "no template changes, so upstream merges stay
cheap").

The approved design canvas (`docs/design/2026-09-04-dashboard-and-grid-canvas/`) has now been
implemented twice under that rule, and both times the human's verdict was "the UI looks the same".
The cause is structural, not a quality problem: the canvas specifies DOM that the application does
not render. Verified instances:

- The device status cell is an HTML string built in TypeScript with colours in **inline styles**
  and **no dot element** (`devices-table-config.resolver.ts:244-268`). CSS can neither create the
  dot nor beat an inline `style=` attribute.
- Search is two mutually exclusive toolbars gated on `textSearchMode`
  (`entities-table.component.html:40,175`); the canvas requires an always-visible field.
- The footer is a stock `mat-paginator` (`:379-386`), which emits **no** page-number buttons; the
  canvas requires numbered page chips.

A CSS-only constraint therefore makes ~10 of the 41 acceptance criteria unreachable in their
layer. Two full implementation cycles were spent discovering this.

## Decision

**We accept Angular template (`.html`) and TypeScript edits in this fork where a design
requirement is unreachable in the token or stylesheet layer**, subject to four constraints:

1. **Confined blast radius.** Template edits are limited to components named in the approved
   requirement — for this work item the shared entity table, the status/severity cells, and
   paginator usage. No upstream-wide refactor.
2. **Additive and clearly marked.** Prefer adding a self-contained block over restructuring
   existing markup, so a rebase conflict is localised and resolvable by inspection.
3. **Guarded by existing configuration flags.** New UI must degrade to today's behaviour when the
   relevant flag (`searchEnabled`, `displayPagination`, `selectionEnabled`) is off, because the
   component is shared by 10+ pages.
4. **Layer declared up front.** Every change states its layer — token / stylesheet / template /
   TypeScript / server-config — so no requirement is again accepted as satisfiable in a layer that
   cannot express it.

Colour remains **token-only**: no new hex or rgba outside the `--aq-*` token definition blocks.

## Consequences

**Positive**

- The canvas becomes reachable; the third attempt can actually succeed.
- The reachability check ("can this layer express this requirement?") becomes an explicit gate,
  preventing a repeat of two wasted cycles.
- Retiring the two rival search toolbars is a net **reduction** in template lines.

**Negative / accepted costs**

- Rebases onto upstream will now conflict in `entities-table.component.html`, its `.ts` and
  `.scss`, `devices-table-config.resolver.ts`, `alarm-table-config.ts` and
  `custom-paginator-intl.ts`. Previously these files were pristine.
- Conflict resolution needs judgement, not just "take upstream" — the constraint that edits be
  additive and marked is what keeps this tractable.
- Upstream changes to `MatPaginator` usage or the cell-rendering `@switch` could silently
  interact with our additions; the regression sweep must be re-run after every rebase.

**Neutral**

- The token-layer-only rule still stands for **colour**. This ADR narrows the old rule to
  "colour is token-only; structure may be edited when necessary", it does not abolish it.
- `.claude/team/memory/MEMORY.md` states "Theming is token-layer only ... no template edits for
  colour." That remains true and is unchanged by this ADR.

---

## Addendum — 2026-09-05: scope widened to the alarms table WIDGET (decision D18)

**Status:** accepted (human ruling at the G2.7 test loop).

### Context

Test run-1 (48 PASS / 5 FAIL) reported that the dashboard alarms widget still rendered severity as
**bold coloured text**, not the pill+dot chip AC-31 requires. The G2 design doc had assessed AC-31
as reachable through the existing `.tb-widget` anatomy CSS — i.e. CSS-only, no template edit — and
requirement §5 accordingly did NOT permit editing that widget.

That assessment was **wrong**. The widget is a different component from the shared entity table
(`ui-ngx/src/app/modules/home/components/widget/lib/alarm/alarms-table-widget.component.*`), and its
severity styling is produced in TypeScript, not CSS: `defaultStyle()` (`:1148-1160`) returns
`{ fontWeight: 'bold', color: alarmSeverityColors.get(value) }`. No stylesheet rule can turn that
into a chip, for the same reason the CSS-only rounds could not reach the device status pill.

The Developer correctly STOPPED and escalated rather than editing outside the approved surface.

### Decision

Requirement §5 is **widened** to permit a minimal, additive edit to
`alarms-table-widget.component.{ts,html,scss}`, solely to render severity through the existing
`tb-status-chip` component (pill + dot, label from `alarmSeverityTranslations`, closed-set tone).

The ADR 0002 rules apply unchanged: **no entity-derived value in the chip markup, no `style=""`,
and the severity cell must not pass through `bypassSecurityTrustHtml`.**

### Consequences

**Positive**

- AC-31's severity half becomes reachable, and the dashboard alarms table gains the same status
  vocabulary as every entity grid.
- The severity cell moves OFF this widget's sanitizer-bypass path, which is a security improvement
  in a component that is materially riskier than the entity table (see below).

**Negative / accepted costs**

- A **second** widget file now carries fork-local edits and will conflict on rebase. The
  "additive and marked" constraint applies here too.
- This widget's cell path is more dangerous than the entity table's: `cellContent()` (`:830-869`)
  ends in `bypassSecurityTrustHtml` (`:859`), bound by `[innerHTML]`
  (`alarms-table-widget.component.html:93`), **and it executes user-authored `cellContentFunction`s**
  (`:843-845`). Because dashboard authors can supply arbitrary content functions there, the severity
  chip must be a real component in the template rather than generated markup — extending the string
  path would have been a genuine security regression.

**Neutral**

- The *label-size* half of AC-31 (9.5px / JetBrains Mono headers) is **not** code at all: it lives in
  the dashboard's stored `dashboardCss` and is folded into task 10 as server-side config (decision
  D19). This ADR covers only the severity-chip half.
- The reachability lesson repeats a third time in this work item: **check which layer actually owns
  a property before promising a criterion is reachable in another.**

---

## Addendum — 2026-09-06: the rail head in `home.component`

**Status:** accepted · **Work item:** left-menu-and-favicon · **Decision:** requirement §9 D14

### Context

The left-menu work item scoped fork-local template edits to the three menu components
(`menu-link`, `menu-toggle`, `side-menu`) plus `user-menu`. Verification against the canvas
found the **rail head** could not be reached from that set: the head is not rendered by any
menu component. It is rendered by `home.component.html` (`:27-29`), which draws the
144px `<tb-logo>` raster image in the expanded state.

The canvas specifies a **64px head band**, padding `0 12px 0 16px`, a **24x24 brand mark**
beside an **"AIRLINQ" wordmark at 13px / 700 / letter-spacing .12em**, and a **32px pin
control** with an 8px radius and a 16px glyph in `--aq-text-3`. None of that is expressible
without editing the element that owns it — the same "spec-vs-constraint reachability"
failure already recorded twice in this repo's team memory.

### Decision

ADR 0001's scope is **widened** to permit a minimal, additive edit to
`home.component.{html,scss}`, **confined to the rail head** — the `<header class="tb-nav-header">`
block and its toolbar. Specifically:

- the `<tb-logo>` element in the **expanded** head is replaced by a `.tb-brand` block
  (24px `<img>` mark reusing the existing `collapsedLogo` asset + a `.tb-brand-wordmark`
  span), so both rail states show the same mark;
- the head band becomes 64px with the canvas padding, and the pin button is laid out by the
  head's flex flow (`margin-left: auto`) instead of absolute positioning;
- the pin glyph is sized by swapping the template's `tb-mat-20` utility class for
  `tb-mat-16` — the sanctioned sizing mechanism — rather than a CSS override that would
  have to out-specify the `tb-mat-*` mixin in `styles.scss`.

**Nothing else in `home.component` is in scope.** The collapsed head keeps the mark +
chevron already shipped.

The wordmark is a **translation-safe literal** ("AIRLINQ"), not an i18n key: a product name
is not translated, and routing it through a locale file would let a translation change the
brand. The mark carries `alt=""` + `aria-hidden`, with the accessible name on the
`.tb-brand` container, so the pair is announced once.

ADR 0002 applies unchanged: no entity-derived value in the new markup, no `style=""`
attributes, and all colour via `--aq-*` tokens defined in **both** theme blocks.

### Consequences

**Positive**

- The head criteria (AC-13, AC-14) become reachable at all, and the expanded and collapsed
  rail states finally share one brand mark instead of two different logo assets.
- Dropping the 144px raster for a 24px mark + text removes the widest element in the rail
  head, which is what forced the pin into absolute positioning in the first place.

**Negative / accepted costs**

- A **third** area of the fork now carries local template edits and will conflict on rebase.
  The edit is deliberately small and marked with `AIRLINQ` comments naming the criterion.
- `home.component.html` is a high-traffic upstream file; a future ThingsBoard release that
  restructures the sidenav header will require re-applying this by hand.

**Neutral**

- `logo` / `logo_title_*.svg` remain bound in `home.component.ts` and are still used by the
  login page; only the sidenav head stops consuming them.
