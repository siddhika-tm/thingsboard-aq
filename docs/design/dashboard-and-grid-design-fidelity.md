# Design — Dashboard and entity-grid design fidelity

- **Work item slug:** `dashboard-and-grid-design-fidelity`
- **Author:** technical-architect
- **Date:** 2026-09-04
- **Gate:** G2 deliverable (design). Requires human approval before any code.
- **Requirement:** `docs/requirements/dashboard-and-grid-design-fidelity.md` (G1 APPROVED)
- **Spec (immutable, treated as data):** `docs/design/2026-09-04-dashboard-and-grid-canvas/`
- **Plan:** `docs/plans/dashboard-and-grid-design-fidelity.md`
- **ADRs written:** `docs/adr/0001-template-edits-in-the-thingsboard-fork.md`,
  `docs/adr/0002-status-cells-as-angular-templates-not-html-strings.md`

---

## 1. Summary

Third attempt at the same canvas. The first two failed for a structural reason, not a quality
reason: they were CSS-only, and the canvas specifies DOM that does not exist. This design
therefore names, for **every** acceptance criterion, the **layer** the change lives in —
token / stylesheet / template / TypeScript / server-config — so no criterion can be silently
unreachable in its layer again. That layer column is the core deliverable of this document.

Two findings materially change the plan versus the G1 brief and are covered in §3:

1. **D7 is a real cleanup but not a functional fix.** `.tb-default` is never removed from
   `<body>`; `tb-dark` is added *alongside* it. The anatomy block contains **zero colour
   literals**, so its `.tb-default`-scoped rules already resolve dark token values in dark mode.
   D7 must still be executed (it is binding, and it makes intent explicit), but it must **not**
   be scheduled as the "cheapest high-impact win" — it is expected to be a visual no-op.
2. **A live stored-XSS path exists** in the same file family as the AC-18 work
   (`getAssigneeTemplate` → `bypassSecurityTrustHtml`). Flagged in §7; it is pre-existing
   upstream and formally out of scope, but our AC-17 fix must not extend the pattern.

---

## 2. Impact analysis

### 2.1 Files in scope

| Layer | File | Why it is touched |
|---|---|---|
| Token | `ui-ngx/src/styles.scss:1428-1475` (`.tb-default` tokens) | New tint + severity tokens (light) |
| Token | `ui-ngx/src/styles.scss:1478-1517` (`.tb-dark` tokens) | Same tokens (dark) |
| Stylesheet | `ui-ngx/src/styles.scss:1765-1891` (anatomy block) | D7 rescoping; new pill/search/pager rules |
| Template | `ui-ngx/src/app/modules/home/components/entity/entities-table.component.html` | Always-visible search (AC-9), numbered pager (AC-21/22/23), selection bar (AC-13/14/15) |
| TS | `ui-ngx/src/app/modules/home/components/entity/entities-table.component.ts` | Count badge total, pager window computation, search-mode retirement |
| Component SCSS | `ui-ngx/src/app/modules/home/components/entity/entities-table.component.scss` | Local geometry for the new toolbar/footer members |
| TS | `ui-ngx/src/app/modules/home/pages/device/devices-table-config.resolver.ts:244-268` | AC-16/17 pill + dot, de-hardcode colours |
| TS | `ui-ngx/src/app/modules/home/components/alarm/alarm-table-config.ts:126-131` | AC-18 severity pill + dot |
| TS | `ui-ngx/src/app/shared/services/custom-paginator-intl.ts:35-39` | AC-20 range wording |
| i18n | `ui-ngx/src/assets/locale/locale.constant-en_US.json` | One new key (see §6) |
| Server config | Container Operations dashboard `44076f90-a5f3-11f1-8cd8-d5f3ffee79db` | AC-24 context line, AC-27/28 segmented bar, AC-29/30 chart |

### 2.2 Blast radius

`entities-table.component.*` is shared. Confirmed consumers beyond Devices/Assets/Alarms:
alarm-rules-table, api-keys-table, audit-log-table, calculated-fields-table, edge-downlink-table,
event-table — plus every other `EntityTableConfig` page. Consequences that shape the design:

- Every template change must be **guarded by an existing config flag** and degrade to today's
  behaviour when the flag is off. Specifically `searchEnabled`
  (`entities-table-config.models.ts:179`, default `true`) gates the search field, and
  `displayPagination` gates the pager.
- The responsive `ResizeObserver` / `hidePageSizePixelValue` mechanism
  (`entities-table.component.ts:161-170`) must survive the pager replacement, because narrow
  layouts (widget-embedded tables) depend on it.
- `pageSizeOptions` is derived at `:259` from `defaultPageSize`; the rows-per-page chip keeps
  consuming it unchanged.

### 2.3 Data-model impact

**None.** No schema change, no migration, no new endpoint. This work is presentation-only, so the
overlay's versioned-migration mechanism (ThingsBoard `install.sh --upgrade` +
`application/src/main/data/upgrade/`) is not engaged. Stated explicitly because the overlay
requires any data-model change to go through it — there is none here.

### 2.4 Backward compatibility

`textSearchMode` is public API of the component and is read at
`entities-table.component.ts:110,280,350,563,571,576` and written by `resetSortAndFilter`. It is
also set from the `textSearch` query parameter on deep links. The design **keeps the field and
its semantics** (it still tracks "a search term is active", which drives URL sync); it only stops
being the visibility switch for two rival toolbars. This preserves deep-link behaviour and any
subclass calling `enterFilterMode()` / `exitFilterMode()`.

---

## 3. Corrected diagnosis of the dark-theme scoping (D7)

D7 is binding and will be executed. The rationale in the requirement is, however, inaccurate, and
acting on the stated rationale would waste the plan's first step on an expected no-op believed to
be a fix. Recording the correction so the Developer and Tester do not misread the result.

**What the requirement says:** the anatomy block is `.tb-default`-only, therefore "the dark theme
is silently missing the entire anatomy".

**What the code does:**

- `ui-ngx/src/index.html:101` — `<body class="tb-default">`; the boot script at `:108` only ever
  **adds** `tb-dark`. `theme.service.ts:73-75` likewise adds/removes only `DARK_CLASS`.
  `tb-default` is never removed. In dark mode the body is `class="tb-default tb-dark"`.
- Therefore `.tb-default .mat-mdc-header-cell` **matches in dark mode too**.
- The anatomy block contains **no colour literals** — verified: every colour is
  `var(--aq-*)`.
- `--aq-*` tokens are defined twice at equal specificity (0,1,0): `.tb-default` at line 1428 and
  `.tb-dark` at line 1478. Dark is later in source order, so **dark values win** in dark mode.
  This is exactly the mechanism HANDOFF §7.2 documents ("both classes sit on body; dark wins by
  source order") and is the same mechanism that makes the already-shipped `.tb-default` blocks at
  1524-1576 (widget cards, header cells) render correctly in dark today.

**Conclusion:** geometry (40px band, 48px rows, dividers, radii) and colour both already apply in
dark. Rescoping to `.tb-default, .tb-dark` is a **clarity/robustness change, not a behavioural
one**. It is still worth doing: it removes a booby-trap for the next maintainer, and it protects
against a future change that removes `tb-default` from the body.

**Consequences for the plan:**

- D7 is Task 1 (cheap, zero-risk, satisfies AC-32's grep) but is explicitly labelled
  **expected visual no-op**.
- The plan must **not** treat D7 as closing the dark-mode gap. The genuine dark-mode risk is
  elsewhere: the new pill/search/pager markup, which the plan requires to be token-only from the
  outset.
- **Verification obligation:** because this reasoning is analytical, Task 1 carries an explicit
  before/after dark-mode screenshot comparison. If dark **does** change visibly, the diagnosis
  above is wrong and the Developer must stop and report rather than proceed.

---

## 4. Architecture decision and alternatives

### 4.1 The layered rule

Every change is assigned exactly one layer, and a criterion is only accepted as satisfiable if
its layer can express it:

| Layer | Can do | Cannot do |
|---|---|---|
| Token (`--aq-*` blocks) | Colour values, both themes at once | Geometry that needs new DOM |
| Stylesheet (`styles.scss`, component SCSS) | Restyle existing DOM | Create DOM; beat inline styles from TS |
| Template (`.html`) | Create/reshape DOM | Change data or computed values |
| TS | Computed values, cell content, i18n | Nothing the template does not render |
| Server config (REST) | Widget type/settings/layout | Anything in `ui-ngx` |

This table is the direct countermeasure to the failure mode that produced two dead attempts.

### 4.2 Alternatives considered for the status cell

**Option A — keep the HTML string, swap literals for `var(--aq-*)`.** Cheapest; one function
body. But it keeps the cell on the `bypassSecurityTrustHtml` path, keeps colours in inline
`style=`, and cannot easily express the dot. It also perpetuates the exact pattern that carries
the XSS in §7.

**Option B (chosen) — a real Angular component `tb-status-chip`, rendered via the existing
`entityChips`-style column type.** The template already has a non-`innerHTML` branch
(`@case ('entityChips')` at `entities-table.component.html:256`) proving the pattern is
supported. A new `@case ('statusChip')` renders a component with `[label]`, `[tone]` inputs. All
colour comes from a CSS class driven by tokens, so AC-17's grep passes by construction, the dot
is trivial, and the cell leaves the raw-HTML path entirely. Reusable by Devices (AC-16) and
Alarms (AC-18) with no duplication.

**Option C — CSS-only `::before` dot on the existing `.status` div.** Rejected: cannot beat the
inline `background-color`, and a pseudo-element dot is invisible to assistive technology, failing
the AC-18 requirement that severity stay readable without colour.

**Recommendation: Option B.** Slightly more code than A, but it is the only option that satisfies
AC-17, AC-18 and the accessibility requirement simultaneously, and it reduces the raw-HTML
surface rather than growing it. Recorded as ADR 0002.

### 4.3 Alternatives considered for the pager

**Option A — style `mat-paginator` harder.** Already attempted (`styles.scss:1837-1882`).
`mat-paginator` emits no page-number buttons at all, so AC-21 is unreachable. Dead end.

**Option B (chosen) — keep `mat-paginator` for state, add a sibling numbered strip.** Retain
`MatPaginator` as the state owner (`pageIndex`, `pageSize`, `length`, and the existing
`page` subscription in `updatePaginationSubscriptions`), hide its default range/nav chrome, and
render an additional windowed chip strip in the template that calls into the same paginator
instance. Preserves the `ResizeObserver`/`hidePageSize` behaviour and every existing subscription;
`CustomPaginatorIntl` still supplies the range wording (AC-20).

**Option C — replace `mat-paginator` entirely with a custom component.** Cleanest markup, but it
re-implements page-state management for 10+ tables and breaks `hidePageSize`, deep-link page
params and the intl seam. Disproportionate risk for a visual goal.

**Recommendation: Option B** — minimal, additive, reversible by deleting one template block.

### 4.4 Alternative considered for search

**Chosen:** collapse the two rival toolbars into one. Keep the first toolbar as the only toolbar
and move the search input into it, gated `@if (entitiesTableConfig.searchEnabled)`. Delete the
second toolbar (lines 175-194) and the magnifier button that opened it (99-106). `textSearchMode`
survives as state (§2.4) but no longer gates visibility. This is a net **reduction** in template
size, which helps rather than hurts merge cost.

---

## 5. Token strategy

### 5.1 Tokens that already serve the canvas

Canvas var names map 1:1 to `--aq-*` by prefix. All confirmed present in **both** theme blocks:

| Canvas | App token | Used by |
|---|---|---|
| `--surface` / `--surface-2` | `--aq-surface` / `--aq-surface-2` | AC-1, AC-2, AC-8, AC-9 |
| `--border` / `--border-subtle` | `--aq-border` / `--aq-border-subtle` | AC-1, AC-2, AC-5, AC-11 |
| `--hover` / `--selected` | `--aq-hover` / `--aq-selected` | AC-6, AC-7, AC-19 |
| `--accent-c` / `--on-accent-c` | `--aq-accent-container` / `--aq-on-accent-container` | AC-13, AC-21, AC-30 |
| `--text` / `-2` / `-3` / `-dis` | `--aq-text` / `-2` / `-3` / `-disabled` | AC-3, AC-20, AC-21, AC-24, AC-25 |
| `--success` / `--warning` / `--error` | `--aq-success` / `--aq-warning` / `--aq-error` | AC-16, AC-17, AC-26, AC-27 |
| `--grid` / `--axis` | `--aq-chart-grid` / `--aq-chart-axis` | AC-29 |
| `--shadow` | `--aq-shadow-1` | AC-1, D1 |
| radii | `--aq-radius-sm/md/lg` | AC-1, AC-19 |

No new hex is needed for any of these. AC-33 therefore holds for the bulk of the work.

### 5.2 The 18%-tint mechanism — `color-mix` is NOT safe here

The canvas uses `background: color-mix(in srgb, var(--success) 18%, transparent)`. This must
**not** be copied literally. `ui-ngx/.browserslistrc` declares:

```
Chrome >= 107   Edge >= 107   Firefox >= 104   Safari >= 16   iOS >= 16   Firefox ESR
```

`color-mix()` shipped in Chrome/Edge 111, Safari 16.2, Firefox 113. Chrome 107-110,
Firefox 104-112 and Safari 16.0-16.1 are **inside the declared support window and lack it**.
In those browsers the declaration is dropped at parse time and the chip renders with **no
background** — a silent, theme-wide fidelity failure precisely in the cell the requirement is
about. Angular's build does not polyfill `color-mix`.

**Decision: paired tint tokens.** Add explicit pre-mixed tint tokens to both theme blocks. This
is also more honest about contrast: an 18% mix against a *transparent* backdrop composites
differently over `--aq-surface` than over `--aq-selected`, so a hand-checked value is safer than
an arithmetic one.

New tokens, added **inside the token blocks only** (AC-33 compliant), to **both**
`.tb-default` and `.tb-dark`:

| Token | Light | Dark | Derivation |
|---|---|---|---|
| `--aq-success-tint` | `rgba(23, 96, 58, .18)` | `rgba(70, 192, 138, .18)` | 18% of the theme's `--aq-success` |
| `--aq-warning-tint` | `rgba(180, 83, 9, .18)` | `rgba(224, 170, 78, .18)` | 18% of `--aq-warning` |
| `--aq-error-tint` | `rgba(163, 24, 42, .18)` | `rgba(236, 98, 116, .18)` | 18% of `--aq-error` |
| `--aq-info-tint` | `rgba(29, 107, 138, .18)` | `rgba(85, 176, 223, .18)` | 18% of `--aq-info` |

`rgba()` with the same channel values as the existing semantic token is universally supported and
reproduces the canvas appearance exactly. Because they are declared in the token blocks, adding
them satisfies AC-33's "hex/rgba only inside the token blocks" rule.

**Paired label tokens (added at G2.5 review, finding H-1).** The tint alone is not sufficient:
using the full-strength semantic token as the chip's *text* colour fails WCAG AA on that tint in
both themes (see §8). Each tint therefore has a matching foreground token, declared in the same
blocks:

| Token | Light | Dark |
|---|---|---|
| `--aq-success-chip-fg` | `#0f4527` | `#7fd7ae` |
| `--aq-warning-chip-fg` | `#7c3806` | `#eec684` |
| `--aq-error-chip-fg` | `#8c1424` | `#f5a3af` |
| `--aq-info-chip-fg` | `#154f66` | `#8ccbec` |
| `--aq-neutral-chip-fg` | `#546070` | `#aab3be` |

These are scoped to the chip on purpose. The shared `--aq-success`/`--aq-warning`/… tokens are
read against page backgrounds elsewhere and carry their own contrast budgets, so they are left
untouched; only the chip's label colour moves. The dot inherits via `currentColor`, so it tracks
the label automatically and needs no token of its own.

### 5.3 Alarm severity — token seam considered and REJECTED

> **Status: rejected at G2.5 review (finding C-3), human-directed option (a).**
> The design originally proposed defining `--tb-alarm-severity-*` here. That was implemented,
> then **reverted**. This section is retained to record why, so the idea is not re-proposed.

`alarm.models.ts:89-97` emits `var(--tb-alarm-severity-critical, rgb(209, 39, 48))` (and `-bg`
variants at `:99-107`). Those custom properties are defined nowhere in any SCSS file, so every
consumer currently falls through to the hardcoded fallbacks. That looked like a free token seam.

**Why it was rejected.** The fallbacks are *distinct per severity* — CRITICAL red, MAJOR orange,
MINOR amber, WARNING yellow. Defining the tokens against the `--aq-*` family collapses
MAJOR/MINOR/WARNING to a single `--aq-warning` colour. That is acceptable inside our status chip,
which always carries a text label, but the tokens are read by ~5 unrelated consumers where the
label is absent or colour is the only signal:

- `alarms-table-widget.component.ts:1155`
- `notification.component.ts:148` and `:162`
- `create-cf-alarm-rules.component.ts:71`
- `alarm-details-dialog.component.ts:70`

Remapping those is unapproved scope, and it destroys severity differentiation where AC-18's
text-label guarantee does not apply. The chip therefore gets its colours from the contained
`--aq-*-tint` + `--aq-*-chip-fg` pair only (§5.2), and `--tb-alarm-severity-*` stays undefined so
existing consumers keep their distinct fallbacks.

---

## 6. i18n

All new copy goes through translation keys. Most needed strings **already exist** — confirmed, so
the plan adds only one key.

| Copy | Key | Status |
|---|---|---|
| "Search devices" (AC-9 placeholder) | `device.search` | **Exists** (`en_US.json:2281`); per-entity via `entityTranslations.search` (`entity-type.models.ts:150`). Assets/alarms/etc. have their own. |
| "1 device selected" (AC-14) | `device.selected-devices` | **Exists** as ICU plural (`en_US.json:3154` pattern); already rendered at `entities-table.component.html:199`. No change. |
| "Showing 1–10 of 20" (AC-20) | `paginator.showing-range` — **NEW** | Add to `en_US.json` `paginator` block (`:10550-10557`) |
| Pager nav labels (AC-21) | `paginator.first-page-label`, `.previous-page-label`, `.next-page-label`, `.last-page-label` | **Exist** (`:10552-10555`); reuse as `aria-label`/`matTooltip` on the new chips |
| Clear filter (AC-12) | `action.clear` / `action.close` | **Exist**; reuse for the pill's × |

New key values, using ICU-free interpolation so `CustomPaginatorIntl` can build them with
`translate.instant(key, params)`:

```json
"showing-range": "Showing {{range}} of {{total}}",
"page-label": "Page {{page}}"
```

`page-label` was added at G2.5 review (finding H-2): the pager chips' `aria-label` had been built
by concatenating the `paginator.showing` key with a number, which announced "Showing 3" instead of
"Page 3" and overloaded that key's meaning for translators. A dedicated parameterised key fixes
both. `paginator.showing` was consequently left with no consumer and removed again — it was
introduced in this same uncommitted change, so no dead key remains.

**AC-20's emphasised range — deviation, accepted (finding M-4).** The footer originally assembled
"Showing" + `<b>{{range}}</b>` + "of" + total from separate fragments in fixed English order,
which breaks in RTL locales. The whole sentence is now rendered from the single `showing-range`
ICU string, so word order belongs to the translator. The cost is the `<b>` 600-weight emphasis on
the range: markup cannot be placed inside an interpolated parameter without splitting the string
again and reintroducing the ordering bug. **Correct word order was judged to outrank the bolding**,
so AC-20's emphasis is deliberately not implemented. Translation strings stay markup-free either
way, so this is not an injection vector.

**Locale files:** the new key is added to `locale.constant-en_US.json` **only**. The other 27
locale files are left untouched; ngx-translate falls back to the en_US bundle for missing keys,
which is the established convention in this repo. Adding 27 machine translations would be
unreviewable.

---

## 7. Security

### 7.1 Assessment of the status cell (the requirement's question)

`entities-table.component.ts:651-660` renders every non-chip cell through:

```ts
res = this.domSanitizer.bypassSecurityTrustHtml(column.cellContentFunction(entity, column.key));
```

`bypassSecurityTrustHtml` **disables Angular's sanitizer entirely** for that value, and the
template binds it with `[innerHTML]` (`:253`, `:261`). Any HTML in a `cellContentFunction`
return value is therefore live markup, including `<img onerror>` and `<svg onload>`.

**For the device status cell specifically (AC-16/17): no live injection path.** `deviceState()`
(`devices-table-config.resolver.ts:244-256`) interpolates only
`this.translate.instant(translateKey)` with a compile-time-constant key
(`'device.active'`/`'device.inactive'`) and a locally-chosen colour literal. No entity-provided
value reaches the string. Severity: **Informational** — the pattern is dangerous, the instance
is not exploitable.

**Specified safe construction (AC-16/17):** per §4.2 Option B the cell becomes a real Angular
component (`tb-status-chip`) rendered through a new `@case ('statusChip')` branch, with the label
passed as a **text interpolation** (`{{ label }}`) and the tone as a class binding. This removes
the device status cell from the `bypassSecurityTrustHtml` path entirely rather than merely
escaping within it. No string concatenation of HTML is retained for this cell, so no escaping
specification is required.

### 7.2 Finding: stored XSS in the alarm assignee cell (pre-existing, upstream)

Found while assessing the same file the AC-18 work touches. Reported per team-protocol §6.

```
### [HIGH] Stored XSS via alarm assignee display name
- CVSS 3.1: 7.3 (AV:N/AC:L/PR:L/UI:R/S:U/C:H/I:L/A:N)
- CWE: CWE-79 — Improper Neutralization of Input During Web Page Generation
- OWASP: A03:2021 — Injection
- Affected: ui-ngx/src/app/modules/home/components/alarm/alarm-table-config.ts:213-225
           via ui-ngx/.../entities-table.component.ts:657 (bypassSecurityTrustHtml)
```

`getAssigneeTemplate()` builds an HTML string interpolating
`getUserDisplayName(entity.assignee)` and `getUserInitials(entity.assignee)`.
`getUserDisplayName` (`ui-ngx/src/app/shared/models/alarm.models.ts:392-410`) returns the user's
`firstName`/`lastName`, or `email`, **raw and unescaped**. That string is returned as a
`cellContentFunction` value and reaches `bypassSecurityTrustHtml` → `[innerHTML]`.

**Impact:** a tenant user who can set their own profile name, and who can be assigned an alarm,
achieves stored XSS in the browser of every user viewing that alarms table — including a tenant
admin. Script runs in the victim's origin with their JWT in scope.

**Status: pre-existing upstream defect, formally OUT OF SCOPE for this work item.** The
requirement §4 forbids upstream-wide refactors and confines template edits to named components.
This design does **not** fix it, and does **not** make it worse. Two hard constraints follow for
the implementation, which the plan enforces:

- The AC-18 severity change must **not** be modelled on `getAssigneeTemplate`. It uses the
  `tb-status-chip` component route, adding no new interpolation into a raw-HTML string.
- No task may extend, copy or relocate the `getAssigneeTemplate` pattern.

**Recommended remediation (separate work item, for the human to schedule):** render the assignee
cell as a component like the status chip, or escape via `textContent`. Not actioned here.

### 7.3 Other security notes

- **No auth/authz change.** No endpoint, guard, role check or token handling is touched.
- **No new logging**, so no risk of logging sensitive data.
- **No secrets** in any document produced by this work item; live credentials stay in the
  gitignored `CLAUDE.md` / `env` and are referenced, never copied.
- **Dashboard config via REST** is performed with the tenant-admin JWT over **plain HTTP on a
  VPN-only host** (no TLS on :8080 — standing posture per the overlay). The token is
  short-lived and the host is not internet-reachable; no new exposure is created, but the backup
  JSON (AC-38) may contain tenant entity names and must be stored under
  `.claude/team/artifacts/`, not committed to a public remote.

---

## 8. Accessibility

- **Status never colour-alone (AC-16/18, US-3).** Every chip is dot + **text label**. The dot is
  a real element in the component template; the label is the translated text. Removing colour
  leaves the label. `tb-status-chip` gets no `aria-hidden` on the label, and the decorative dot
  is marked `aria-hidden="true"`.
- **Always-visible search (AC-9).** A real `<input type="search">` with a non-empty accessible
  name from the existing `translations.search` key. Reachable in normal tab order; no
  click-to-reveal (which was itself an accessibility problem). **Deviation:** the canvas pill
  shape cannot be achieved through `mat-form-field` without fighting its internal layout, so the
  input is bare rather than `matInput`-wrapped. This forgoes Material's `aria-describedby` hint
  plumbing — acceptable here because a search box has no validation messages or hints to
  describe (reviewer finding L-2, accepted as a recorded trade-off). The accessible name comes
  from `aria-label`, not the placeholder, so it survives a filled field. The decorative magnifier
  is `aria-hidden="true"`, and WebKit's native clear affordance is suppressed so the themed clear
  button is the only such control.
- **Pager chips (AC-21/22).** Rendered as `<button>` elements, not styled spans, so they are
  focusable and Enter/Space-activatable for free. Each carries `aria-label` from the existing
  `paginator.*` keys; the current page uses `aria-current="page"`. Disabled first/prev use the
  native `disabled` attribute (not just the disabled colour token), so they are correctly skipped
  by AT and by tab order. The ellipsis is a non-interactive `<span aria-hidden="true">`.
- **Filter pill clear (AC-12).** A real `<button>` with `aria-label` from `action.clear`, inside
  the injected header component's surface; 28px visual size retains a ≥24px hit target.
- **Selection bar dismiss (AC-15).** `<button>` with `aria-label` from `action.close`.
- **Focus visibility.** All new controls inherit the existing `--aq-focus` token; the plan adds a
  `:focus-visible` outline rule in the anatomy block so chips and the search field show focus in
  both themes (Material's default focus ring is suppressed by the pill restyling, so this is a
  real regression risk and is called out as its own verification step).
- **Contrast — measured, and the original assumption was wrong (finding H-1).** The design
  assumed that using the full-strength semantic token on an 18% tint of itself retained AA
  "because the background moves only slightly". Measurement disproved this in **both** themes:
  light `--aq-warning` reached only 3.70:1 and light `--aq-info` 4.35:1; dark `--aq-error` 3.99:1
  and dark neutral 4.32:1 — against a 4.5:1 requirement (the label is 12px/600, which is *not*
  large text, so the 3:1 large-text allowance does not apply).

  Two compounding factors the original note missed: (a) the chip background is the tint
  *composited over the row*, not the flat surface; (b) the row `:hover` and `.selected` overlays
  are applied to `.mat-mdc-cell` with `!important`, so they composite **underneath** the chip —
  every tone must therefore clear 4.5:1 in three row states, not one.

  **Resolution:** a dedicated label token per tone, `--aq-{success,warning,error,info,neutral}-chip-fg`,
  defined beside the tints in both theme blocks. These are deliberately *separate* from the shared
  `--aq-success`/`--aq-warning`/... tokens, which carry their own contrast budgets against page
  backgrounds and must not be dragged darker to satisfy the chip. After the change all 30
  combinations (5 tones × 2 themes × 3 row states) pass, worst case 4.72:1 (light neutral,
  selected) and 4.79:1 (dark neutral, selected). No waiver is required.

  The calculator is committed at
  `.claude/team/artifacts/dashboard-and-grid-design-fidelity/contrast-check.py`
  (`python … before` reproduces the failing baseline, `… after` the passing values), so the
  numbers are reproducible rather than asserted.
- **ARIA only where semantic HTML is insufficient** — used for `aria-current`, `aria-label` on
  icon-only buttons, and `aria-hidden` on decorative dots; nowhere as a substitute for a real
  control.

---

## 9. Criteria → approach map

`Layer` is the load-bearing column. **Legend:** T=token, S=stylesheet, H=template, X=TypeScript,
C=server config, i=i18n.

| AC | Layer | File / mechanism |
|---|---|---|
| AC-1 | S | `styles.scss` anatomy: `.tb-entity-table-content` 1px `--aq-border` + `--aq-radius-lg`. Already present; D1 keeps it. |
| AC-2 | S | anatomy: `.mat-mdc-header-row{height:40px}`, `.mat-mdc-header-cell` bg `--aq-surface-2` + 1px bottom `--aq-border`. Present. |
| AC-3 | S | anatomy: header-cell 11px/500/.06em/uppercase. Present. |
| AC-4 | S | anatomy: `.mat-mdc-row{height:48px}`. Present. |
| AC-5 | S | anatomy: cell `border-right` `--aq-border-subtle`, `&:last-of-type{border-right:0}`. Present. |
| AC-6 | S | anatomy: `.mat-mdc-row:hover .mat-mdc-cell{background:var(--aq-hover)}`. Present. |
| AC-7 | S | anatomy: `:has(.mat-mdc-checkbox-checked)` → `--aq-selected`; accent checkbox via `--mdc-checkbox-selected-*` in token blocks. |
| AC-8 | H+X | New count badge span in toolbar after title, bound to `dataSource.total()`; styled in anatomy. |
| AC-9 | H+S | Move search input into the single toolbar, `@if (searchEnabled)`; 260×36, 10px radius, `--aq-surface-2` in anatomy. |
| AC-10 | X | Existing `textSearch` control → `pageLink.textSearch`; badge reads `dataSource.total()` so it updates for free. |
| AC-11 | S | Injected header component (`tb-anchor #entityTableHeader`) restyled: existing `mat-mdc-form-field` → 34px outlined pill; `.mdc-floating-label::after{content:':'}` gives `Label: value`. Extends the rule already at `styles.scss:1839`. |
| AC-12 | S(+H) | Style the existing clear control in the injected filter; add `aria-label`. No new functionality (D5). |
| AC-13 | S | anatomy: `mat-toolbar.mat-mdc-table-toolbar.mat-primary` → `--aq-accent-container` / `--aq-on-accent-container`, 40px. Present. |
| AC-14 | H | Existing `translations.selectedEntities` ICU key already renders "1 device selected" (`:199`); add dismiss button. |
| AC-15 | H+X | Dismiss calls `dataSource.selection.clear()`. |
| AC-16 | H+X | **New** `tb-status-chip` component + `@case ('statusChip')`; `devices-table-config.resolver.ts` returns `{label, tone}`. |
| AC-17 | T+X | Colours from `--aq-success`/`--aq-error` + new `*-tint` tokens; hardcoded hex/rgba deleted from resolver → grep passes. |
| AC-18 | T+X | Same chip for severity; `--tb-alarm-severity-*` remapped in token blocks (§5.3); replaces colour-only text at `alarm-table-config.ts:126-131`. |
| AC-19 | S | anatomy: `.mat-mdc-cell .mat-mdc-icon-button` 32×32, `--aq-radius-sm`, `--aq-hover` on hover. Present. |
| AC-20 | X+i | `CustomPaginatorIntl.getRangeLabel` → new `paginator.showing-range` key; `<b>` emphasis in template. |
| AC-21 | H+X+S | New windowed chip strip beside a chrome-suppressed `mat-paginator` (§4.3 Option B); active chip `--aq-accent-container`. |
| AC-22 | X | Chip click → `paginator.page`/existing page subscription; range label follows. |
| AC-23 | S | anatomy: rows-per-page select → 30px, 8px radius, outlined. Present at `styles.scss:1858`. |
| AC-24 | **C** (+S) | Title/context/time-window pill. Title styleable in code (`.tb-dashboard-title h3`); **the context line does not exist in the DOM** → dashboard config (markdown widget or `dashboardCss`). |
| AC-25 | **C** | KPI tile label/value/context = `cards.value_card` widget settings. |
| AC-26 | **C** | Error-tinted outline on the Misaligned tile = that widget's background/border settings. |
| AC-27 | **C** | Segmented bar replaces the current single progress-bar widget — widget type/settings change. |
| AC-28 | **C** | Legend with counts = widget config/datasource labels. |
| AC-29 | **C** | Chart grid/axis, 2px series, dashed labelled threshold = ECharts widget settings (threshold line + label). |
| AC-30 | **C** | Legend chips + range pills = widget legend settings + timewindow quick-ranges. |
| AC-31 | S | Dashboard alarms table is the same shared anatomy (`.tb-widget .mat-mdc-header-cell` already present) + AC-18 chip. Code, not config. |
| AC-32 | S | D7 rescope to `.tb-default, .tb-dark` → satisfies the grep. Expected visual no-op (§3). |
| AC-33 | T | All new colour inside token blocks; chip/pager/search use `var()` only. Enforced by a grep verification step. |
| AC-34 | — | `cd ui-ngx && yarn lint` |
| AC-35 | — | `mvn install -pl application -am -Dlicense.skip=true -Dskip.installyarn=true`; new files carry the Apache header. |
| AC-36 | — | Regression sweep, both themes, per §10 risk register. |
| AC-37 | — | Functional sweep on Devices/Assets/Alarms. |
| AC-38 | **C** | `GET /api/dashboard/{id}` → backup JSON in artifacts **before** any config change; restore command in §11. |
| AC-39 | — | Deploy per HANDOFF §4.2; verify served `main-*.js` (component styles ship in JS chunks, not `styles-*.css`). |
| AC-40 | — | Screenshots to `.claude/team/artifacts/dashboard-and-grid-design-fidelity/`. |
| AC-41 | **human-judged** | Human sign-off at G4 viewing the live server. **No agent check is invented for this criterion.** |

### 9.1 Code vs server-config split

- **Code (`ui-ngx`), 27 criteria:** AC-1…AC-23, AC-31, AC-32, AC-33, plus AC-34/35 gates.
- **Server config (REST on the demo host), 7 criteria:** **AC-24 (context line), AC-25, AC-26,
  AC-27, AC-28, AC-29, AC-30.**
- **Mixed:** AC-24 (title styling is code; context line is config).
- **Process:** AC-38, AC-39, AC-40. **Human-only:** AC-41.

The dashboard is a live 19-widget config (HANDOFF §6.4) that exists **only as tenant data in
PostgreSQL on the server, not in git**. Its fleet-health widget is currently a plain progress bar
and the KPI tiles are `cards.value_card` widgets — no amount of `ui-ngx` code turns a progress-bar
widget into a segmented bar with a legend. This is why AC-27/28 are config, and it is the second
reachability trap in this work item after the CSS-only one.

---

## 10. Risk register

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Template edit breaks one of the 10+ non-device tables (search/pager/selection) | **High** | High | Every new element gated by an existing config flag (`searchEnabled`, `displayPagination`, `selectionEnabled`); explicit regression sweep over audit-log, api-keys, event, calculated-fields, alarm-rules, edge-downlink tables |
| R2 | Pager rework breaks responsive `hidePageSize` / deep-link page params | Medium | High | `MatPaginator` retained as state owner (§4.3 B); `ResizeObserver` untouched; verify at narrow width and via `?page=1` URL |
| R3 | `color-mix` copied from canvas → chips lose background on Chrome 107-110 / Safari 16.0-16.1 | Medium | High | Paired tint tokens (§5.2); grep-verify no `color-mix` enters `ui-ngx` |
| R4 | Retiring `textSearchMode` as a visibility gate breaks deep-linked `textSearch` param | Medium | Medium | Field and semantics preserved (§2.4); test a `?textSearch=` deep link |
| R5 | Pill restyling suppresses Material focus ring → keyboard users lose focus visibility | Medium | Medium | Explicit `:focus-visible` rule using `--aq-focus`; keyboard tab-through is its own verification step |
| R6 | Dashboard config change breaks widgets (`realtimeType`, partial `timewindow`, `settings:{}`) | **High** | High | HANDOFF §10.1 rules: build from `GET /api/widgetType?fqn=system.<fqn>` `defaultConfig`, override only `datasources`/`title`; backup first (AC-38) |
| R7 | D7 believed to be the dark-mode fix; real dark gaps missed | Medium | Medium | §3 corrects the diagnosis; D7 labelled expected no-op; dark asserted separately for every new element |
| R8 | Severity remap (`--tb-alarm-severity-*`) changes colours app-wide beyond the tables | Medium | Low | Intended and token-scoped; sweep alarm widgets/details for regression |
| R9 | Merge cost against upstream rises | Medium | Medium | Additive, clearly-marked blocks; search change is a net line reduction; ADR 0001 records the trade-off |
| R10 | Only `en_US` gets the new key; other locales show the raw key | Low | Low | ngx-translate falls back to en_US (repo convention); demo runs in English |
| R11 | Component styles ship in JS chunks → deploy "verified" by checking `styles-*.css` only | Medium | Medium | Verify `public/main-*.js` too (HANDOFF §8.6, AC-39) |

### 10.1 Rollback

- **Code:** all changes are on a feature branch off `feature/airlinq-shell-theme-c`; agents never
  commit (commit policy `manual`). Back out = discard the branch, or revert per-task commits —
  tasks are ordered so each is independently revertible. The two riskiest template edits (pager
  strip, search relocation) are self-contained blocks that can be reverted without touching the
  token or stylesheet work.
- **Deployment:** previous RPM retained as `/tmp/thingsboard.prev.rpm` and a tar backup of
  `/usr/share/thingsboard` + `/etc/thingsboard` per HANDOFF §4.2; `rpm -Uvh --force` the previous
  RPM to roll back.
- **Dashboard config:** restore from the AC-38 backup (command in §11).

---

## 11. Rollout

1. Token + stylesheet work first (lowest risk, immediately visible, no DOM change).
2. Then TS/template work, one concern per task, each leaving the app buildable and lint-clean.
3. Build + lint gates (AC-34/35) on every task.
4. Human approval, then deploy per HANDOFF §4.2, verify `/login` 200 within 120s and that the
   served `main-*.js` / `styles-*.css` carry the change (AC-39).
5. Dashboard config changes **last**, separately human-approved, backup first.

**Feature flags:** none introduced. This is presentation-only, the demo is a single-tenant
air-gapped host, and a flag would double the QA surface across both themes. Rollback is by
revert/redeploy (§10.1), which is adequate here.

**AC-38 backup and restore.** Before any config change:

```bash
# Backup (run from a host with VPN access; JWT from POST /api/auth/login)
curl -s -H "X-Authorization: Bearer $JWT" \
  http://10.221.89.67:8080/api/dashboard/44076f90-a5f3-11f1-8cd8-d5f3ffee79db \
  -o .claude/team/artifacts/dashboard-and-grid-design-fidelity/container-operations-backup-$(date +%Y%m%d-%H%M%S).json
```

```bash
# Documented restore command (AC-38)
curl -s -X POST -H "X-Authorization: Bearer $JWT" -H "Content-Type: application/json" \
  http://10.221.89.67:8080/api/dashboard \
  -d @.claude/team/artifacts/dashboard-and-grid-design-fidelity/container-operations-backup-<stamp>.json
```

`POST /api/dashboard` with a body carrying the original `id` performs an update, restoring the
saved state. Credentials are **not** recorded here — `$JWT` is obtained at run time from the
login endpoint using the tenant-admin account in the gitignored `CLAUDE.md`.

---

## 12. Out of scope (restated)

Per requirement §4 and HANDOFF §8.3: no data/telemetry/simulator change; no backend endpoint or
schema change; no dependency or toolchain version change; no upstream-wide refactor; nav rail not
re-implemented (regression-checked only); brand-mark hex not tokenised (D4); "Add filter" dashed
pill and column/density button are decorative and **not** implemented (D5); deferred cosmetics
(dark map tiles, gauge bezels, `dataZoom` slider, pie/doughnut canvas labels) stay deferred; the
§7.2 XSS finding is reported, not fixed.

---

## 13. Open items for the human at G2

1. **AC-27/28 need a widget decision.** A segmented bar with a legend is not a stock ThingsBoard
   widget type. Options: (a) reuse the existing custom-widget mechanism that already ships
   `tenant.airlinq.container_corner_state` (HANDOFF §6.5) and add a small segmented-bar widget;
   (b) approximate with a stacked horizontal bar chart widget. (a) matches the canvas; (b) is
   cheaper and uses only stock types. **Recommend (a).** Needs a call before the config task runs.
2. **Confirm the config tasks are executed by the human**, not by an agent — they mutate live
   tenant data on the demo server. The plan marks them human-executed after G2.
3. **Note the §7.2 HIGH XSS finding** and decide whether to raise a separate work item. It is not
   fixed here.
