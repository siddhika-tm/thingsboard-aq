# Requirement — Dashboard and entity-grid design fidelity

- **Work item slug:** `dashboard-and-grid-design-fidelity`
- **Mode:** dev
- **Task-size class:** `standard` (human-confirmed at G1)
- **Author:** Jarvis (Product Manager)
- **Date:** 2026-09-04
- **Gate status:** G1 APPROVED by the human 2026-09-04; task-size class `standard` confirmed. G2 (design + plan) in progress.
- **Spec (source of truth):** `docs/design/2026-09-04-dashboard-and-grid-canvas/` — `Main.dc.html`, `DashboardLight.dc.html`, `DataGrid.dc.html`, `DataGridLight.dc.html`, `canvas.json`

---

## 1. Problem statement

The approved design canvas has been implemented twice, and both times the human's verdict was
"the UI looks the same". The cause is now understood and is **not** a quality problem in the
previous work — it is a scope constraint that made the target unreachable:

Both earlier passes were deliberately **CSS-only** ("no functionality change", `HANDOFF.md` §8.6).
The canvas, however, specifies structure that does not exist in the DOM the app renders. CSS
cannot create a missing element, cannot change a mode-toggle into an always-visible control, and
cannot override an inline `style="..."` attribute written by TypeScript. Three concrete, verified
examples of the dead end:

1. **Status pill + coloured dot.** `devices-table-config.resolver.ts:246-268` builds the pill as an
   HTML string with hardcoded colours in inline styles (`#198038`, `#d12730`,
   `rgba(25,128,56,0.08)`) and **contains no dot element at all**. The canvas requires a 6×6 dot
   plus an 18%-tint chip. CSS cannot add the dot, and inline styles outrank the stylesheet.
2. **Always-visible search.** `entities-table.component.html:40,175` implements search as two
   mutually exclusive toolbars gated on `textSearchMode`. The canvas shows a 260×36 search field
   permanently present *beside* the title and actions. That is a template change.
3. **Numbered pager + "Showing 1–10 of 20".** The footer is a stock `mat-paginator`
   (`entities-table.component.html:379-386`), which renders no page-number buttons and uses
   Material's own range wording. The canvas requires numbered page chips and specific copy.

A fourth item was recorded here as a scoping defect ("the anatomy block is `.tb-default`-only,
so dark is missing the anatomy"). **That rationale was WRONG and is corrected — see the design
doc §3.** `ui-ngx/src/index.html:101` sets `<body class="tb-default">` statically and the boot
script (`:108`) and `theme.service.ts:73-75` only ever ADD/REMOVE `tb-dark`. In dark mode the body
is `class="tb-default tb-dark"`, so `.tb-default`-scoped rules DO match in dark, and the paired
token blocks (`styles.scss:1428` light / `:1478` dark, equal specificity, dark later in source
order) flip the colours correctly. The anatomy block contains no colour literals.

D7 (rescoping to `.tb-default, .tb-dark`) therefore remains binding and worth doing as a
robustness/clarity fix, but it is an **expected visual no-op** — it does NOT close a dark-mode
gap, and nobody should read a lack of visible dark change as a failure. The genuine dark-mode
risk lies in the NEW pill/search/pager markup, which must be token-only from the outset.

The human has now **lifted the CSS-only constraint**. This round must reach full design fidelity.

## 2. Goal

Make the live Container Operations home dashboard and every entities-table page visually match
the design canvas in **both** light (default) and dark themes, and have the human confirm it on
http://10.221.89.67:8080.

## 3. Users affected

- Tenant administrators and customer users of the Airlinq demo platform (the demo audience).
- Internally: the platform team, who inherit the merge cost of any template edit against upstream
  ThingsBoard.

## 4. Scope

**In scope**

| Area | What |
|---|---|
| Entity grid | The shared `entities-table.component.{html,ts,scss}` and its anatomy: toolbar, header band, rows, selection bar, footer/pager |
| Grid pages | Devices, Assets, Alarms, **and every other page using the shared component** (audit log, calculated fields, API keys, alarm rules, edge downlink, event table — a shared-component change reaches all of them) |
| Status cells | Devices `active` state pill (dot + tint) and Alarms `severity` (currently colour-only text) |
| Dashboard | Container Operations home dashboard: header, KPI tiles, fleet-health segmented bar, chart treatment, alarms table |
| Dashboard config | Widget types/settings/layout on the demo server via REST API (human-approved, backup first) |
| Themes | Light (default) and dark, both |
| Tokens | `--aq-*` token layer in `ui-ngx/src/styles.scss`; new tokens allowed **inside the token blocks only** |

**Out of scope / non-goals**

- No change to data, telemetry, calculated fields, device profiles, or the simulator.
- No new backend endpoints, no schema change, no dependency version change.
- No upstream-wide refactor: template edits stay confined to the components named in §5.
- Residual cosmetics from `HANDOFF.md` §8.3 stay deferred: map basemap tiles in dark, radial-gauge
  bezels, ECharts `dataZoom` slider, canvas-level pie/doughnut labels.
- The canvas's left nav rail is **already delivered** (`HANDOFF.md` §8.6, treatment C) and is not
  re-implemented; it is only checked for regression.
- No re-tokenising of the brand logo hex values (see §9 Q4).

## 5. Allowed change surface (human decisions already taken)

1. **Angular template (HTML) edits ARE allowed**, kept inside: the shared entity table component
   (`ui-ngx/src/app/modules/home/components/entity/entities-table.component.*`), the dashboard
   toolbar / widget header, and paginator usage — plus SCSS.
2. **Dashboard configuration changes on the demo server via REST API ARE allowed**, with a JSON
   export backup taken **first** and a documented restore command.
3. Colours only via `--aq-*` tokens; no new hex literals outside the token blocks.
4. Commit policy is **manual** — agents never commit or push.

## 6. User stories

- **US-1** As a demo viewer I see a Devices grid whose card, header band, rows, dividers, hover and
  selection states match the canvas, so the product looks designed rather than default.
- **US-2** As a demo viewer I can see how many records exist and search them without first
  clicking a magnifier, because the count badge and search box are always visible.
- **US-3** As a demo viewer I can tell device state without relying on colour perception, because
  state is a labelled pill with a dot.
- **US-4** As a demo viewer selecting rows, the toolbar becomes a selection action bar telling me
  how many are selected and what I can do with them.
- **US-5** As a demo viewer I know my position in the data ("Showing 1–10 of 20") and can jump to a
  page by number.
- **US-6** As a demo viewer the home dashboard leads with a titled header, a context line and a
  time-window pill, then KPI tiles, fleet health and a chart with a labelled alarm threshold.
- **US-7** As a demo viewer switching to dark theme, everything above still holds.

## 7. Acceptance criteria (numbered, testable)

Format: **precondition/input → expected observable result**. Unless stated otherwise every
criterion is asserted **twice — once in light theme, once in dark** (`localStorage['tb-theme']`
unset/`'light'` vs `'dark'`). Measurements are taken from rendered/computed values at 1600×1000.
Tolerance: ±1px on lengths, exact on text, exact on token identity.

### A. Entity grid — card and structure

- **AC-1** Open `/devices` → the grid card has a 1px solid outer border in `--aq-border` and
  `border-radius: 16px`.
- **AC-2** → the column header band computes to `height: 40px`, its background is `--aq-surface-2`,
  and it has a 1px bottom rule in `--aq-border`.
- **AC-3** → every header label computes to `font-size: 11px`, `font-weight: 500`,
  `letter-spacing: 0.06em`, `text-transform: uppercase`.
- **AC-4** → data rows compute to `height: 48px`.
- **AC-5** → cells show a 1px **right** divider (column divider) and a 1px **bottom** divider (row
  divider) in `--aq-border-subtle`; the last column has no right divider.
- **AC-6** Hover a data row → **each `.mat-mdc-cell` of that row** (the element carrying the
  declaration) computes `background-color` equal to the resolved `--aq-hover` value. On pointer-out
  it returns to `rgba(0, 0, 0, 0)`. *(Amended at G2: the rule is declared on the cell, not the row;
  asserting the row would fail a correct implementation.)*
- **AC-7** Tick a row checkbox → **each `.mat-mdc-cell` of that row** computes `background-color`
  equal to the resolved `--aq-selected` value, and the checkbox's selected fill equals the resolved
  `--aq-accent` value (via `--mdc-checkbox-selected-*` in the token blocks). *(Amended at G2:
  element named; "the accent colour" replaced by an explicit token.)*

### B. Entity grid — toolbar

- **AC-8** Open `/devices` → a record-count badge sits immediately after the "Devices" title,
  showing the total record count as a rounded (999px) badge with `--aq-surface-2` background,
  `font-size: 12px`, `font-weight: 600`. Its text equals `String(totalElements)` from the same
  page request. *(Amended at G2: the literal "20" removed — the demo server holds 11 simulated
  containers, so the count is asserted against the API's own total, not a hardcoded number.)*
- **AC-9** → a search input is **visible without any click**, ~260px wide, 36px high,
  `border-radius: 10px`, filled `--aq-surface-2`, no border, with a leading magnifier icon and the
  placeholder "Search devices" (or the page's translated equivalent).
- **AC-10** Type a term in that search box → the grid filters, and the count badge (AC-8) updates to
  the filtered total.
- **AC-11** With a device-profile filter applied → it renders as an **outlined pill** (1px
  `--aq-border`, 999px radius, 34px high) whose text is `Label: value` form (e.g. "Profile:
  Container"), carrying a leading filter icon and a trailing clear (×) control.
- **AC-12** Click that pill's × → the filter is removed, the pill disappears, and the grid + count
  badge reflect the unfiltered set.

### C. Entity grid — selection action bar

- **AC-13** Select one row → the normal toolbar actions are **replaced** by a selection action bar
  whose background is `--aq-accent-container` and text/icons `--aq-on-accent-container`, 40px high.
- **AC-14** → that bar states the selection count in the form "1 device selected" (page-appropriate
  noun; pluralised for >1), exposes the page's bulk actions (e.g. delete), and offers a dismiss (×)
  control.
- **AC-15** Click the bar's dismiss → the selection clears and the normal toolbar returns.

### D. Entity grid — status as pill + dot

- **AC-16** On `/devices` → the State cell renders a pill containing **both** a 6×6 circular dot and
  a text label ("Active"/"Inactive"), `font-size: 12px`, `font-weight: 600`, `border-radius: 999px`,
  padding `2px 8px 2px 6px`.
- **AC-17** → that pill's colours derive from `--aq-*` semantic tokens (success/error family) with
  the background a ~18% tint of the semantic colour. **No hardcoded hex or rgba remains** in
  `devices-table-config.resolver.ts` for this cell (grep-verifiable: `#198038`, `#d12730`,
  `rgba(25, 128, 56` and `rgba(209, 39, 48` are absent from the file).
- **AC-18** On `/alarms` → severity is conveyed by pill + dot + text label, not colour alone; the
  same token family drives it (removing the colour still leaves severity readable).

### E. Entity grid — row actions and footer

- **AC-19** → each row-action control has a 32×32 hit target with `border-radius: 8px`, right
  aligned in a fixed last column, and shows an `--aq-hover` background on hover.
- **AC-20** → the footer displays the range in the wording "Showing 1–10 of 20" (en dash),
  reflecting the true page and total, rendered from a single ICU-parameterised translation key.
  *(Amended 2026-09-05 by human ruling Q-A: the original "the range part emphasised at
  `font-weight: 600` in `--aq-text`" is DROPPED. Emphasising a fragment would require splitting the
  ICU string, which breaks word order for the RTL locales in the repo (`ar_AE`, `fa_IR`); correct
  i18n outranks the bolding, consistent with design §6's single-key ICU mandate. The now-unreachable
  `.tb-entity-table-range b { }` rule in `styles.scss` is to be removed as a Low fix.)*

- **AC-21** → the footer shows a **numbered** pager: first/prev/next/last controls plus one 32×32
  chip per page; the current page chip uses `--aq-accent-container` / `--aq-on-accent-container` and
  `font-weight: 600`; first/prev are disabled on page 1 (rendered in the disabled token).
- **AC-22** Click page chip "2" → the grid loads page 2, the chip 2 becomes the active chip, and
  AC-20's wording updates accordingly (e.g. "Showing 11–20 of 20").
- **AC-23** → a "Rows per page" select renders as a 30px-high, 8px-radius outlined chip; changing it
  re-pages the grid and updates AC-20.

### F. Dashboard — Container Operations

- **AC-24** Open the Container Operations home dashboard → a header shows the dashboard title at
  `font-size: 20px` / `font-weight: 600`, a context line beneath it at `font-size: 12px` in
  `--aq-text-3`, and a time-window control rendered as a **pill** (999px radius, 1px `--aq-border`,
  36px high) with a leading clock icon.
- **AC-25** → KPI tiles each show: an uppercase label at 11px/500/0.06em, a value at
  `font-size: 32px` / `font-weight: 600`, and one line of context text at 12px in `--aq-text-3`.
- **AC-26** → the alerting/misaligned KPI tile additionally carries a tinted outline derived from
  the `--aq-error` token (a visibly error-tinted border, distinct from the other tiles).
- **AC-27** → fleet alignment health renders as a **segmented** bar (three adjacent segments —
  aligned / watch / misaligned — in the success / warning / error tokens, 10px high, 999px radius,
  2px gaps) and **not** as a single bare progress line.
- **AC-28** → that bar is accompanied by a legend with one swatch + label per segment, each label
  including its count (e.g. "Aligned 6", "Watch 1", "Misaligned 4"), and the segment widths are
  proportional to those counts.
- **AC-29** → the tilt/alignment chart shows a recessive grid (gridlines in `--aq-chart-grid`, visibly lighter than the `--aq-chart-axis` axis line), 2px series lines, and a **dashed horizontal
  threshold rule with a visible text label naming the alarm threshold** (e.g. "alarm 3.0°").
- **AC-30** → the chart carries legend chips (one per series, each with a short line swatch) and
  range pills (e.g. 1h / 6h / 24h) where the active pill uses
  `--aq-accent-container` / `--aq-on-accent-container`.
- **AC-31** → the dashboard's alarms table follows the same grid anatomy as §A: `--aq-surface-2`
  header band with 11px uppercase labels, 1px row dividers, hover state, and severity as pill + dot.

### G. Theming, tokens and regression

- **AC-32** `ui-ngx/src/styles.scss` — the grid/dashboard anatomy rules apply to **both** themes:
  the block is scoped so that `.tb-dark` is covered (grep: at least one `tb-dark` occurrence in the
  anatomy block, or a shared `.tb-default, .tb-dark` selector). Every AC in §A–§F passes with
  `localStorage['tb-theme'] = 'dark'`.
- **AC-33** No new colour literal is introduced outside the `--aq-*` token definition blocks: a diff
  review of `styles.scss` shows added hex/rgba values only inside the `.tb-default` / `.tb-dark`
  token blocks, and no hex/rgba literal is added in any `.ts`/`.html` file touched.
- **AC-34** `cd ui-ngx && yarn lint` introduces **zero NEW problems** versus the pre-change
  baseline, evidenced by before/after logs. *(Amended 2026-09-05, RATIFIED BY THE HUMAN 2026-09-05: the
  original wording "passes with zero errors" is unsatisfiable — the gate is already red on a
  pristine tree at `569 problems (462 errors, 107 warnings)`, measured by the developer and
  independently re-checked by Jarvis; after the change it is byte-identical. No CI workflow runs
  `yarn lint`, and ESLint does not lint `.scss` at all. Note the run needs
  `NODE_OPTIONS=--max-old-space-size=8192` or it OOMs.)*
  Baseline evidence: `.claude/team/artifacts/dashboard-and-grid-design-fidelity/lint-baseline.log`;
  after: `lint-after.log`.
- **AC-35** `mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true` succeeds;
  every new file carries the Apache licence header. *(Note 2026-09-05: `license:check` reports 7
  pre-existing `Missing header` offenders, all UNTRACKED and none from this change — the 4
  design-canvas `.dc.html` artboards and 3 `.superpowers/` files. `mvn license:format` must NOT be
  run to clear them: it would inject Apache headers into the design-spec artboards and corrupt the
  source of truth. Separately, a full reactor build WITH tests fails in `netty-mqtt` for want of
  Docker; this change touches zero Java files.)*
- **AC-36** Regression, both themes: Devices, Assets, Alarms, the Container Operations dashboard and
  the login page render with no light-surface/near-black-text leak in dark and no visual regression
  in light; the collapsed icon rail and its flyout popovers, the pinned-open rail, the entity
  details drawer, and row/bulk actions (add, delete, assign) all still function.
- **AC-37** Functional non-regression: on each of Devices / Assets / Alarms — sort by a column,
  page, search, select-all, open the details drawer, and use one row action; each behaves as before
  the change.

### H. Delivery

- **AC-38** Before any dashboard-config change, a JSON export of the Container Operations dashboard
  is saved as a backup artifact, and the requirement's delivery notes record the exact restore
  command.
- **AC-39** After the human approves deployment: the RPM is deployed to 10.221.89.67 per
  `HANDOFF.md` §4.2 (tar backup, previous RPM kept, md5-verified upload, conf md5 unchanged),
  `/login` returns HTTP 200 within 120s, and the **served bundle is verified to carry the change**
  (bundle hash changed and the change greppable in the served `styles-*.css` / `main-*.js`).
- **AC-40** Screenshot evidence exists in `.claude/team/artifacts/dashboard-and-grid-design-fidelity/`
  for Home dashboard + Devices + Assets + Alarms in **both** themes.
- **AC-41** **Human-judged, not agent-verifiable:** the human, viewing http://10.221.89.67:8080,
  confirms the UI matches the design canvas. No agent invents a check for this criterion; it is the
  human's sign-off at G4.

## 8. Notes for the Technical Architect (not decisions — inputs)

Findings from the G1 analysis that the design/plan phase should account for:

- The `.tb-default`-only scoping of `styles.scss:1765-1891` is the single cheapest high-impact fix
  and should be treated as a defect, not a feature.
- `CustomPaginatorIntl` already exists (`ui-ngx/src/app/shared/services/custom-paginator-intl.ts`)
  and is registered in `shared.module.ts:286` — a natural, low-blast-radius seam for AC-20's wording.
  The numbered chips (AC-21) still need markup.
- The per-page filter surface is injected through `tb-anchor #entityTableHeader` (e.g.
  `tb-device-info-filter`), so AC-11's pill must work for an injected component, not just static
  markup.
- `entities-table.component.html` already has a selection toolbar at line 196 (`color="primary"`)
  and a search toolbar at line 175 — AC-13/AC-9 are re-shaping existing structures, not net-new ones.
- Only Devices uses the `class="status"` HTML-string pill; Alarms severity is colour-only text.
- The shared component reaches at least 7 additional tables (§4) — blast radius is wide; the
  regression scope in AC-36/AC-37 exists because of this.
- Canvas internal inconsistencies to resolve in the design doc rather than copy blindly: `.ico`
  base size differs between the dashboard (24px) and grid (20px) files; dashboard cards have no
  outer border while the grid card does; pill heights vary by context (36/34/30px). Canvas sample
  data mismatches (5-critical badge vs 2 rows; "of 20" vs 9 rows) are fixture artefacts, not spec.

## 9. Human decisions at G1 (binding — do not re-ask)

All G1 open questions are resolved. These are constraints on the design and the plan:

- **D1 (was Q1):** The entity-grid card **keeps** its 1px outer border in `--aq-border` with 16px
  radius. Dashboard widgets stay **border-free** (shadow only, `--aq-shadow-1`), exactly as the
  canvas shows. Do not add borders to dashboard cards; do not remove the grid card border.
- **D2 (was Q2):** Device state renders **Active / Inactive only**, as pill + coloured dot + text
  label. **Do not derive Watch/Alarm; invent no data.** Alarms severity also becomes pill + dot +
  text label (it is colour-only text today) — severity values themselves come from the existing
  `alarmSeverityTranslations` / severity enum, unchanged.
- **D3 (was Q3):** The pager is a **windowed** numbered pager: first / prev, approximately 5
  numbered chips with ellipsis for longer ranges, next / last — plus the "Showing 1–10 of 20"
  range wording (en dash, range emphasised).
- **D4 (was Q4):** Brand-mark hex values are **left as-is, out of scope.** No tokenising of the logo.
- **D5 (was Q5):** The canvas's "Add filter" dashed pill and the column/density button are
  **decorative — out of scope. No new functionality.** (The refresh control is likewise not new
  functionality; if an equivalent already exists it may be styled, but nothing new is added.)
- **D6 (was Q6):** Task-size class **`standard`** — design doc + implementation plan, human
  approval at G2, before any code.
- **D8 (G2):** AC-27/28 fleet-health segmented bar is built as a **small custom widget**, reusing
  the mechanism that already ships `tenant.airlinq.container_corner_state`. Exact match to the
  canvas (not the cheaper stacked-bar approximation).
- **D9 (G2):** Task 10 (live dashboard JSON on the demo server) is executed by the team, but ONLY
  after an explicit human go-ahead at that step: export backup first, restore command documented,
  then STOP and ask before firing any REST change.
- **D10 (G2):** The stored-XSS assignee-cell finding is raised as a SEPARATE work item and is not
  fixed in this round. The `env` gitignore line was added by the human (verified:
  `git check-ignore env` now matches `.gitignore:58`).
- **D11 (G2):** ADR 0001 (template edits in the fork) and ADR 0002 (status cells as Angular
  components) are both APPROVED.
- **D12 (G2.7):** Q-A — the unbolded footer range is ACCEPTED; AC-20 amended accordingly, test case
  C-31a struck, and the dead `.tb-entity-table-range b { }` CSS removed as a Low fix.
- **D13 (G2.7):** Q-B — the record-count badge being hidden entirely at zero records is ACCEPTED.
- **D14 (G2.7):** Q-C — the severity tone collapse (MAJOR/MINOR/WARNING share the `warning` tone,
  distinguished by text label; INDETERMINATE → `neutral`) is CONFIRMED per design §5.3.
- **D15 (G2.7):** Q-E — AC-24…AC-30 are carried as BLOCKED pending task 10 and excluded from the
  Tester's pass/fail tally. AC-31 is code and IS tested. AC-41 stays human-judged at G4.
- **D16 (test loop, 2026-09-05):** The entity-table header band is **40px**, per AC-2. This
  RECONCILES the contradiction flagged at G2: `HANDOFF.md` §8.6 documents a 44px band and the
  anatomy block shipped `height: 44px` (`styles.scss:1836`). **40px wins**; HANDOFF §8.6 is stale
  on this point.
- **D17 (test loop, 2026-09-05):** CSS fixes are made by **matching or exceeding the competing
  selector's specificity**, never by escalating `!important`. Root cause of 4 of the 5 run-1
  failures: anatomy rules are `.tb-default .mat-mdc-header-row` (0,2,0) while pre-existing upstream
  rules nest deeper — `.tb-default .mat-mdc-table .mat-mdc-header-row` (0,3,0) at `styles.scss:747-758`
  — and (0,3,0) wins regardless of source order.
- **D18 (test loop, 2026-09-05): §5 WIDENED.** The Developer MAY edit
  `ui-ngx/src/app/modules/home/components/alarm/alarm-table-widget/alarms-table-widget.component.*`
  (path per the repo) to render alarm severity via the new `tb-status-chip` — pill + dot, label from
  the existing `alarmSeverityTranslations`, closed-set tone. **The ADR 0002 rules apply unchanged:**
  no entity-derived value in the markup, no `style=""`, and the cell must not go through
  `bypassSecurityTrustHtml`. Keep the edit MINIMAL and additive. Recorded as an ADR 0001 addendum
  (this is the second file where the fork accepts real rebase cost).
- **D19 (test loop, 2026-09-05): AC-31 is SPLIT.**
  - *Severity-chip half* — CODE, stays in this test loop (D18).
  - *Label-size half* — the 9.5px / JetBrains Mono header override lives in the dashboard's stored
    `dashboardCss`, i.e. SERVER-SIDE config. **Folded into task 10** and therefore
    `BLOCKED — pending task 10`, like AC-24…AC-30, and excluded from the Tester's tally.
- **D7 (carried forward, explicit):** Fix the `.tb-default`-only scoping of the
  `AIRLINQ GRID + DASHBOARD ANATOMY` block (`ui-ngx/src/styles.scss:1765-1891`) so the **dark**
  theme receives the anatomy too. Everything stays token-driven.

Consequences for the acceptance criteria: AC-16 reads Active/Inactive (not Watch/Alarm); AC-21 is
satisfied by a windowed pager; AC-1's border applies to the grid card only; no AC is added for the
decorative controls in D5.

## 10. Kickoff record

Roster briefed with this requirement doc after G1 approval; all three responded read-only (no
code, no build). Full blocker list distilled to
`.claude/team/artifacts/dashboard-and-grid-design-fidelity/kickoff-blockers-for-architect.md`.
Roster: technical-architect, developer, code-reviewer (on-demand at G2.5), tester.

| Member | Headline concerns | Estimate |
|---|---|---|
| developer | Blast radius is far wider than 7 tables — effectively every entity list in the product. `EntitiesTableComponent` is public API for dynamically-compiled user widgets (`modules-map.ts:562`), so `textSearchMode` etc. must not be removed. The global `CustomPaginatorIntl` serves ~12 paginators and returns a plain `string`, so AC-20's emphasised range is unreachable through it. Material's `pageIndex` setter does not emit `page`. Biggest layout risk: no narrow-width rule defined for the merged toolbar. | ~40–63 h (5–8 working days) |
| tester | ~12 criteria are not assertable as written: `getComputedStyle` never returns `var(--aq-*)`, and hover/selected are declared on the **cell**, not the row — so AC-6/AC-7 would fail against a correct implementation. Dashboard criteria (AC-24–31) have no environment where the config exists AND automation works. Fixture literals (20 devices, counts 6/1/4) will drift. | test plan 1.5–2.5 h + 2–3 h harness; ~4–7 h per full pass; ~10–16 h across the loop |
| code-reviewer | Upstream-merge cost: wants a declared hunk budget, additive-only edits, new behaviour in new files, `AIRLINQ`-marked blocks. Confirmed `entities-table.component.ts:657` is a blanket `bypassSecurityTrustHtml`; requires the new pills interpolate zero entity-derived values. `device.selected-devices` ICU plural already exists — reuse it. Wants unit tests for the pure functions. | ~3.5 h first pass; 6–8 h across ~3 iterations |

**Aggregate estimate:** roughly 60–90 hours of agent work across implementation, review and test
loops — i.e. this is a multi-session work item, not a single-sitting change.

**Security discovery (pre-existing, out of scope, logged):** a stored-XSS path where
user-controlled alarm-assignee names are interpolated unescaped into HTML that reaches
`bypassSecurityTrustHtml`. Recorded at
`.claude/team/artifacts/dashboard-and-grid-design-fidelity/security-finding-preexisting.md`
and reported to the human; needs its own work item. This round must not widen it.

## 11. Sign-off

| Gate | Status | Date |
|---|---|---|
| G1 Requirement | **APPROVED (human)** | 2026-09-04 |
| G2 Design + plan | **APPROVED (human)** | 2026-09-04 |
| G2.5 Implementation review | **PASSED** — zero findings after 3 iterations; diff package APPROVED by human | 2026-09-05 |
| G2.7 Test plan | **APPROVED (human)** — 60 cases, executing | 2026-09-05 |
| G3 Quality (tester, zero findings) | **PASSED** — run-2: 53 PASS / 0 FAIL, zero findings | 2026-09-05 |
| G4 Release (human) | **awaiting human final review** | — |
