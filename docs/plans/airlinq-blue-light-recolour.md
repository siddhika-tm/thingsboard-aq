# Airlinq Blue light-theme recolour — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recolour the Angular UI's **light** theme to the Airlinq Blue product palette (navy chrome, `#2067ff` primary, gradient active nav row, product surfaces) across the app shell, login and the reachable part of the six auth pages, while the dark theme renders byte-identically.

**Architecture:** Colour flows through the `--aq-*` custom-property layer in `ui-ngx/src/styles.scss`. 24 existing light token values are repointed; 14 new token pairs are added to **both** theme blocks with dark values copied from today's resolved values so dark is a no-op. Because the light theme has **no** rail/toolbar chrome rules today (only the dark block does), nine new rules are added in a **new `.tb-default:not(.tb-dark)` block** placed between `styles.scss`:1800 and :1814 — `:not(.tb-dark)` makes them structurally inert in dark. Two rules that could not win the cascade are replaced by token substitutions inside `side-menu.component.scss`.

**Tech Stack:** SCSS (`ui-ngx/src/styles.scss` + Angular component `.scss`), Angular 20 view encapsulation, no new dependency, no `.ts`, no `.html`.

**Design doc:** `docs/design/airlinq-blue-light-recolour.md` — read §1 (token table), §2.3 (specificity table) and §3 before starting.
**Requirement:** `docs/requirements/airlinq-blue-light-recolour.md`
**ADR:** `docs/adr/0004-theme-scoped-chrome-rules-and-chrome-ink-tokens.md`

---

## Global Constraints

Every task's requirements implicitly include this section. Values are copied verbatim from the requirement.

- **T1 — dark is frozen.** No line inside `ui-ngx/src/styles.scss`:1620-1800 (the dark-only rule block) may be added, removed or modified. No line inside :1502-1555 (the dark token block) except the **addition** of new token definitions required by T3 (subject to decision R-B). Dark must be *proven* unchanged, not asserted.
- **T2 — no `color-mix()`** in built CSS (browserslist floor Chrome 107 / FF 104 / Safari 16). Use pre-mixed `rgba()`.
- **T3 — every new colour token is defined in BOTH theme blocks.** The six pre-existing shape tokens (`--aq-gap`, `--aq-radius-sm/-md/-lg`, `--aq-rail-w`, `--aq-rail-w-open`) are whitelisted as light-only.
- **T4 — specificity discipline.** Match or exceed selector depth. **Add no new `!important`** — zero added occurrences in the diff.
- **T5 — charts keep direct labels and legend chips.** (No chart work in this plan; see design §5.)
- **No geometry.** No change to spacing, radii, font-size, font-weight, height, width, padding or margin.
- **No `.html` template edits. No `.ts` edits at all** (design §5 proves the only candidate `.ts` edit is not dark-neutral).
- **No `color-mix()`, no new dependency, no schema change.**
- **Agents never commit or push.** Commit policy is `manual`; the human reviews and commits. Where a step below says "checkpoint", it means *stop and let the human inspect*, not `git commit`.
- **Verify on the rendered page.** `getComputedStyle` or the painted SVG/DOM — never by reading the stylesheet. A rule can be present, correct, dual-scoped and `!important` and still never apply (MEMORY 17, 18, 27, 28). Prove any specificity diagnosis by **injection**.
- **Build:** `cd ui-ngx && yarn build` or `mvn install -pl ui-ngx -DskipTests -Dlicense.skip=true -Dskip.installyarn=true`
- **Lint:** `cd ui-ngx && NODE_OPTIONS=--max-old-space-size=8192 yarn lint` — gate on **delta vs the task-1 baseline only** (pristine baseline is 569 problems / 462 errors / 107 warnings).
- **Toolchain:** the portable JDK 25 + Maven at `d:/tmp/tools` is NOT on the default PATH; export `JAVA_HOME`/`PATH` per the overlay before concluding a tool is missing.

### Blocking decisions

Tasks 2 and 7 must not start until the human rules on **R-E** (gradient option; plan assumes **G2**) and **R-D** (reduced AC-30). R-A/R-B/R-C/R-F have documented defaults the plan already follows; confirm at G2 approval. See design §10.

---

## File Structure

| File | Responsibility in this change | Lines touched |
|---|---|---|
| `ui-ngx/src/styles.scss` | Light token values (:1428-1499); new token definitions in both blocks (:1428-1499, :1502-1555); one edited existing rule (:1613); the **new** `.tb-default:not(.tb-dark)` chrome + sweep block inserted after :1800 | ~24 edits + ~28 additions + 1 edit + ~1 new block |
| `ui-ngx/src/app/modules/home/menu/side-menu.component.scss` | Two token substitutions so rail ink resolves to chrome ink without a cascade fight | :111, :133 |
| `ui-ngx/src/app/modules/login/pages/login/login.component.scss` | Login card header band, brand/product/strip ink, focus + error rings, error text, link | :53, :66, :67, :75, :127, :132, :167, :195 |
| `ui-ngx/src/app/modules/login/pages/login/password.component.scss` | Auth page canvas, light-only | :22 |
| `ui-ngx/src/app/modules/login/pages/login/link-expired.component.scss` | Auth page canvas, light-only | :22 |
| `ui-ngx/src/app/modules/login/pages/login/two-factor-auth-login.component.scss` | Auth page canvas, light-only | :23 |
| `ui-ngx/src/app/modules/login/pages/login/force-two-factor-auth-login.component.scss` | Auth page canvas, light-only | :25 |
| `.claude/team/artifacts/airlinq-blue-light-recolour/` (new, gitignored) | Baseline dumps, screenshots, sweep script, evidence | new |

**Files explicitly NOT touched** (assert in task 10): any `.html`, any `.ts`, `material.models.ts`, `utils.service.ts`, `chart.models.ts`, `menu-link.component.scss`, `user-menu.component.scss` (unless task 4 step 3 proves N12 insufficient), `home.component.scss`, `styles.scss`:1620-1800.

---

## Task 1: Capture the before-baseline

Nothing else can be verified without this. Do it first, change no source.

**Files:**
- Create: `.claude/team/artifacts/airlinq-blue-light-recolour/baseline/` (gitignored)
- Create: `.claude/team/artifacts/airlinq-blue-light-recolour/contrast-sweep.py`

**Steps:**
- [ ] Confirm the working tree is clean apart from `docs/`; record `git rev-parse HEAD`.
- [ ] Record the lint baseline: `cd ui-ngx && NODE_OPTIONS=--max-old-space-size=8192 yarn lint > ../.claude/team/artifacts/airlinq-blue-light-recolour/baseline/lint-before.txt 2>&1`. Note the problems/errors/warnings triple.
- [ ] Record the build baseline: run the UI build, save the log, confirm exit 0.
- [ ] Copy `.claude/team/artifacts/dashboard-and-grid-design-fidelity/contrast-check.py` to `contrast-sweep.py` and extend it to: (a) accept a list of `(selector, property)` sample points, (b) read computed styles from a rendered page, (c) emit a stable-sorted `fg,bg,ratio,threshold,pass` CSV so before/after diffs are mechanical. **Read credentials from the gitignored `CLAUDE.md` / `env` at runtime — never embed them in the script** (MEMORY line 24).
- [ ] Against the running app, for **both** themes on login, home dashboard, Devices, Alarms — dump every `--aq-*` computed value on `<body>` to `baseline/tokens-<theme>-<route>.json`. This is the AC-3 artefact.
- [ ] Capture fixed-viewport screenshots of all four routes in **both** themes, plus the six auth pages in light, to `baseline/`. This is the AC-4 / AC-25 artefact.
- [ ] Run `contrast-sweep.py` over the Q4 route set (four routes × both themes + six auth pages in light) → `baseline/contrast-before.csv`. This is the AC-18 artefact.

**Verification:** `baseline/` contains lint-before, build log, 8 token dumps, ≥ 14 screenshots and `contrast-before.csv`; the token dumps for dark are non-empty and contain `--aq-sidebar: rgb(23, 28, 36)`.

**Satisfies:** prerequisite for AC-3, AC-4, AC-18, AC-19, AC-20, AC-25.

---

## Task 2: Token layer — repoint light values and add the 14 new pairs

**Files:**
- Modify: `ui-ngx/src/styles.scss`:1428-1499 (light token block)
- Modify: `ui-ngx/src/styles.scss`:1502-1555 (dark token block — **additions only**)

**Steps:**
- [ ] Apply the 24 light value edits from design §1.1 exactly. Each is a value-only change on an existing line; do not reorder, rename or add comments that shift line numbers unnecessarily.
- [ ] Do **not** change `--aq-text-3` (:1459), `--aq-warning` (:1471), any `--aq-chart-*` (:1500-1506), or any of the six shape tokens. Design §1.1 records why.
- [ ] Update the trailing ratio comments on `--aq-success-chip-fg` / `--aq-warning-chip-fg` / `--aq-error-chip-fg` (:1497-1499) to the newly measured values from design §4.3 — a stale contrast comment is worse than none.
- [ ] Add the 14 new **light** definitions from design §1.2 to the light block, grouped after `--aq-on-accent` with a comment naming the design doc section.
- [ ] Add the 14 new **dark** definitions to the dark block, using the dark values in design §1.2 **verbatim**. For each, keep the inline comment stating which existing token's resolved value it copies (e.g. `/* = dark --aq-text, so dark is a no-op */`) — this is the AC-3 audit trail.
- [ ] `--aq-nav-active-grad` light value: use the **G2** three-stop value `linear-gradient(to right, #7641f7 0%, #5a54f4 40%, #18dbf2 100%)`. If the human chose G1, use `linear-gradient(to right, #7641f7 0%, #18dbf2 100%)`; if G3, delete this token pair and skip the gradient in task 5. Dark value is `none` in all cases.
- [ ] Grep the file for `color-mix(` and confirm the only match is the pre-existing comment at :1470.

**Verification:**
- [ ] Build succeeds (no SCSS error).
- [ ] `grep -c -- '--aq-chrome-ink:' styles.scss` returns **2** (one per block). Repeat for all 14 new token names — each must return 2. This is the mechanical AC-22 check.
- [ ] `git diff -U0 ui-ngx/src/styles.scss | grep '^+' | grep -c '!important'` returns **0**.
- [ ] `git diff` shows **no** line removed or modified in :1502-1555 — only additions.
- [ ] Re-dump the dark `--aq-*` values on all four routes and diff against `baseline/tokens-dark-*.json`. **The 14 new names appear; every pre-existing name's value is unchanged.** Any pre-existing value that moved is a bug — fix before proceeding.

**Satisfies:** AC-9, AC-12, AC-14 (fills + label colours), AC-13 (border/fill half), AC-17, AC-21, AC-22, AC-23; prerequisite for AC-6, AC-7. Contributes to AC-1, AC-3.

---

## Task 3: The navy chrome rule block (rail + toolbar ink)

This is the largest and highest-risk task. Do not fold anything else into it.

**Files:**
- Modify: `ui-ngx/src/styles.scss`:1613 (one existing declaration)
- Modify: `ui-ngx/src/styles.scss` — insert a new block **after** the dark block's closing brace at :1800 and **before** the anatomy block comment at :1802-1813

**Interfaces consumed:** `--aq-chrome-ink`, `--aq-chrome-ink-2`, `--aq-chrome-ink-3`, `--aq-chrome-ink-disabled`, `--aq-chrome-divider` from task 2.

**Steps:**
- [ ] Edit `styles.scss`:1613 `.tb-primary-toolbar .tb-breadcrumb { color: var(--aq-text); }` → `var(--aq-chrome-ink)`. Add a one-line comment noting the dark value is identical to dark `--aq-text`, so dark is unaffected.
- [ ] Insert the new block with a header comment stating: (a) it is light-only by **selector**, not by value; (b) `.tb-default` alone would also match in dark (MEMORY 8), hence `:not(.tb-dark)`; (c) it exists because the light theme has no chrome rules and :1620-1800 is dark-only; (d) a pointer to ADR 0004 and design §3.1.
- [ ] Add rules **N1-N7** exactly as specified in design §2.3, with the ink mapping from §3.2:
  - N1 toolbar background `var(--aq-header)` + colour `var(--aq-chrome-ink)`
  - N2 breadcrumb / `.mat-toolbar-tools` / `h1` → `var(--aq-chrome-ink)`
  - N3 toolbar icon glyphs → `var(--aq-chrome-ink-2)`; hover → `var(--aq-chrome-ink)`
  - N4 toolbar disabled glyph → `var(--aq-chrome-ink-disabled)`
  - N5 breadcrumb parent/`.tb-inactive` → `var(--aq-chrome-ink-2)`; `.state-divider` → `var(--aq-chrome-ink-3)`
  - N6 breadcrumb `.tb-active` / `a:last-child` / `.state-entry` → `var(--aq-chrome-ink)`
  - N7 `.tb-site-sidenav` `--mat-button-text-label-text-color: var(--aq-chrome-ink-2)` and `.tb-side-menu-divider, mat-divider { border-color: var(--aq-chrome-divider) }`
- [ ] Do **not** add N8 or N9 — design §3.2 proves they lose the cascade. Rail label and icon ink is handled in task 4.
- [ ] Do **not** set `background` in N7 (it would lose to `home.component.scss`:126 and is unnecessary — the token carries navy).
- [ ] Add **no** `!important` anywhere in the block.

**Verification:**
- [ ] Build succeeds.
- [ ] **Light theme, rendered page:** `getComputedStyle` on `.tb-primary-toolbar` → `background-color: rgb(28, 37, 69)` (AC-7). On `mat-sidenav.tb-site-sidenav` → `background-color: rgb(10, 20, 53)` (AC-6).
- [ ] **Light theme:** sample every rail and toolbar text node listed in design §4.1-§4.2 and compute each ratio against its own computed background. All must be ≥ 4.5:1 (≥ 3:1 for the non-text/disabled rows marked so). Rail labels and icons will still FAIL at this point — that is expected and is fixed in task 4. Record which nodes fail so task 4 has a target list.
- [ ] **Dark theme:** re-dump computed styles for every selector in the new block and diff against baseline. **Zero differences.** If any differ, `:not(.tb-dark)` is not doing its job — stop and diagnose by injection.
- [ ] `git diff` shows no line in :1620-1800 changed (AC-2).
- [ ] Added-`!important` count is 0.

**Satisfies:** AC-6, AC-7, AC-2, AC-23; most of AC-8.

---

## Task 4: Rail label / icon ink and the `--aq-accent-container` consumer audit

**Files:**
- Modify: `ui-ngx/src/app/modules/home/menu/side-menu.component.scss`:111, :133

**Interfaces consumed:** `--aq-chrome-ink-2`, `--aq-chrome-ink-3` from task 2.

**Steps:**
- [ ] Before editing, **prove the cascade claim by injection**: in the light theme, inject `.tb-default:not(.tb-dark) .tb-site-sidenav a.mat-mdc-button { --mat-button-text-label-text-color: red; }` and confirm the label does **not** turn red — demonstrating that a global rule at (0,5,1) loses to `side-menu.component.scss`:111. Record the result. If it *does* turn red, the design's specificity analysis is wrong: **stop and escalate to the Technical Architect** (do not silently redesign).
- [ ] `side-menu.component.scss`:111 `--mat-button-text-label-text-color: var(--aq-text-2)` → `var(--aq-chrome-ink-2)`. Add a comment: chrome ink, because the rail is navy in light; dark value is identical to `--aq-text-2` so dark is unchanged.
- [ ] `side-menu.component.scss`:133 `color: var(--aq-text-3)` → `var(--aq-chrome-ink-3)`, same comment.
- [ ] Leave :120-124 (`.tb-active` ink) **unchanged** — it already reads `--aq-on-accent-container`, which token row 9 flips to `#ffffff`.
- [ ] Leave `menu-link.component.scss`:48-50 **unchanged** — design §4.1 declines the canvas's red badge on measured AA grounds (4.15:1); keeping `--aq-accent-container`/`--aq-on-accent-container` gives 4.72:1.
- [ ] **Audit all six `--aq-accent-container` consumers** on the rendered light page and record each one's computed fg/bg and ratio: the nav pill (`side-menu.component.scss`:120), the table selection toolbar (`styles.scss`:1836), the pager active chip (`styles.scss`:2023), the alarm badge (`menu-link.component.scss`:48), the user avatar and the user-menu active item (`user-menu.component.scss`:155). All must be ≥ 4.5:1 for text.
- [ ] Check `.tb-user-authority` / user name ink in the light rail. If N12 from task 3 did not win, record the competing selector and its specificity and **escalate** rather than adding `!important`.

**Verification:**
- [ ] Light theme: every rail node in design §4.1 now meets its floor, measured on the rendered page. The task-3 failure list is empty.
- [ ] Dark theme: computed label colour on a rail row is `rgb(174, 184, 197)` (dark `--aq-text-2`) and icon colour `rgb(136, 146, 160)` (dark `--aq-text-3`) — identical to baseline.
- [ ] All six `--aq-accent-container` consumers recorded with ratios; none below its floor.
- [ ] No `!important` added; no `.html`/`.ts` touched.

**Satisfies:** AC-8 (completes it), AC-14, AC-18 (rail portion).

---

## Task 5: The gradient on the active nav row only

**Files:**
- Modify: `ui-ngx/src/styles.scss` — add rules **N10** and **N11** to the block created in task 3

**Interfaces consumed:** `--aq-nav-active-grad`, `--aq-hover`, `--aq-chrome-ink` from task 2.

**Blocked on:** human decision **R-E**. If G3, skip N10's gradient and use `background-color: var(--aq-accent-container)` (i.e. no change needed) — then only N11 is added.

**Steps:**
- [ ] Add **N10** exactly as in design §3.3, with **both** declarations:
      `background-color: transparent;` **and** `background-image: var(--aq-nav-active-grad);`
      Selector: `.tb-default:not(.tb-dark) .tb-site-sidenav .tb-side-menu a.mat-mdc-button.mat-mdc-button-base.tb-active` — (0,7,0), beating `side-menu.component.scss`:119 at (0,6,0). **No `!important`.**
- [ ] Add a comment explaining why `background-color: transparent` is required: a gradient is a `background-image` and does not override `background-color`; without it the old accent colour stays underneath and the element's computed `background-color` would still read as the old value, which AC-11's checks sample.
- [ ] Add **N11** (hover, `:not(.tb-active)`): `background-color: var(--aq-hover)`, label `#ffffff` via `--mat-button-text-label-text-color`, icon `var(--aq-chrome-ink)`. **Must not** set `background-image`.
- [ ] Confirm `--aq-nav-active-grad` has **exactly one** consumer: `grep -n -- '--aq-nav-active-grad' -r ui-ngx/src` returns 3 lines (light def, dark def, N10).

**Verification:**
- [ ] Light theme, active nav row on the rendered page: computed `background-image` is the linear gradient **and** computed `background-color` is `rgba(0, 0, 0, 0)`. Label computed colour is `rgb(255, 255, 255)` (AC-10).
- [ ] Light theme, AC-11 sibling checks — computed `background-image` is `none` on: a **hovered non-active** nav row, `mat-toolbar.mat-primary` (table selection toolbar), `.tb-entity-table-pager-chip.tb-active`, and the user-menu active item.
- [ ] Light theme, **label readability**: sample the label's leftmost and rightmost painted pixel positions, compute white's contrast against the gradient colour at each, and confirm the worst case ≥ 4.5:1 (expected ≈ 4.52 under G2). If G1 was chosen, record the measured failure as the human-accepted AC-18 exception with exact ratios.
- [ ] Dark theme: active pill computed `background-color` is `rgb(14, 90, 102)` and `background-image` is `none` — identical to baseline.
- [ ] Added-`!important` count still 0.

**Satisfies:** AC-10, AC-11, AC-23; the active-row portion of AC-8 and AC-18.

---

## Task 6: Login card

**Files:**
- Modify: `ui-ngx/src/app/modules/login/pages/login/login.component.scss`:53, 66, 67, 75, 127, 132, 167, 195

**Interfaces consumed:** `--aq-login-head`, `--aq-login-head-ink`, `--aq-login-head-ink-2`, `--aq-login-head-ink-3`, `--aq-focus-ring`, `--aq-error-ring`, `--aq-error-text`, `--aq-link` from task 2.

**Steps:**
- [ ] :53 `.aq-head { background: var(--aq-surface-2) }` → `var(--aq-login-head)`.
- [ ] :66 `.aq-brand` colour → `var(--aq-login-head-ink)`.
- [ ] :67 `.aq-prod` colour → `var(--aq-login-head-ink-2)`.
- [ ] :75 `.aq-strip` colour → `var(--aq-login-head-ink-3)`.
- [ ] :127 `box-shadow: 0 0 0 3px rgba(11, 107, 120, .13)` → `0 0 0 3px var(--aq-focus-ring)`. Keep the geometry (`0 0 0 3px`) byte-identical.
- [ ] :132 `box-shadow: 0 0 0 3px rgba(163, 24, 42, .13)` → `0 0 0 3px var(--aq-error-ring)`.
- [ ] :167 `.aq-error { color: var(--aq-error) }` → `var(--aq-error-text)`.
- [ ] :195 `.aq-forgot a { color: var(--aq-accent) }` → `var(--aq-link)`. Per **R-C** this resolves to `#2067ff`, **not** the canvas's `#428bca` (3.63:1). If the human overruled R-C, change `--aq-link`'s light value in task 2 instead of hardcoding here.
- [ ] Leave :177 `color: #fff` **unchanged** (correct in both themes) and :176 `background: var(--aq-accent)` unchanged (token row 14 gives the flat blue; D3 needs no `background-image`, and none is declared).
- [ ] Change nothing else in the file — no geometry, no radii, no font.

**Verification:**
- [ ] Light theme login, rendered page: `.aq-head` `background-color` = `rgb(28, 37, 69)`; `.aq-brand` colour = `rgb(255, 255, 255)`; `.aq-prod` = `rgb(219, 228, 245)`; `.aq-submit` `background-color` = `rgb(32, 103, 255)` with `background-image: none`; `.aq-forgot a` = `rgb(32, 103, 255)` (AC-15).
- [ ] Light theme, invalid credentials state: `.aq-error` colour = `rgb(194, 51, 51)`; an invalid input's `border-color` = `rgb(220, 72, 72)` (AC-13).
- [ ] Light theme, focused input: computed `box-shadow` contains `rgba(32, 103, 255, 0.16)`; focused invalid input contains `rgba(220, 72, 72, 0.13)`.
- [ ] **Dark theme login:** computed values for all eight changed declarations are byte-identical to baseline — in particular the focus ring is still `rgba(11, 107, 120, 0.13)` and the error ring `rgba(163, 24, 42, 0.13)` (design §7.1 reading (i)).
- [ ] Dark-theme login screenshot is pixel-identical to baseline.

**Satisfies:** AC-13, AC-15, AC-3, AC-4 (login route).

---

## Task 7: The reachable part of the six auth pages

**Blocked on:** human decision **R-D**. If the human chose B7 (leave them alone) or widened scope to permit `.html` edits, skip or re-plan this task.

**Files:**
- Modify: `ui-ngx/src/app/modules/login/pages/login/password.component.scss`:22
- Modify: `ui-ngx/src/app/modules/login/pages/login/link-expired.component.scss`:22
- Modify: `ui-ngx/src/app/modules/login/pages/login/two-factor-auth-login.component.scss`:23
- Modify: `ui-ngx/src/app/modules/login/pages/login/force-two-factor-auth-login.component.scss`:25

**Steps:**
- [ ] Read design §7.2 first. These six pages hardcode `tb-dark` on their own root div, so any token referenced *inside* resolves to its **dark** value. Only the root element's own `background-color` is reachable.
- [ ] In each of the four files, keep the existing `background-color: #eee` as the base declaration and add a light-only override using `:host-context(body:not(.tb-dark))` on the same class, setting `background-color: var(--aq-bg)`. Do **not** simply replace `#eee` — that would change dark from `#eee` to `#0a0d12` and breach T1.
- [ ] Add a comment in each file naming design §7.2 / R9 and stating why the rest of the page cannot be recoloured (`tb-dark` hardcoded in the template, `.html` edits out of scope).
- [ ] Leave every `rgba(255, 255, 255, 0.8)` value **untouched** (`two-factor-auth-login.component.scss`:62, 80, 88, 90; `force-two-factor-auth-login.component.scss`:99, 104, 111, 113) — they are correct for a permanently-dark context.
- [ ] Change no geometry (`width: 450px !important` etc. stay exactly as-is — note these are **pre-existing** `!important`s, not added ones).

**Verification:**
- [ ] Light theme, each of the six routes: root element computed `background-color` = `rgb(238, 241, 247)`.
- [ ] Dark theme, each of the six routes: root element computed `background-color` = `rgb(238, 238, 238)` — byte-identical to baseline (`#eee`).
- [ ] Screenshots of all six light auth pages captured for the report.
- [ ] Added-`!important` count still 0 across the whole diff.

**Satisfies:** the reachable portion of AC-30. Record the unreachable portion (card header band, primary button, input borders, error text) as deferred, with R9 as the reason.

---

## Task 8: The bounded legacy sweep

**Files:**
- Modify: `ui-ngx/src/styles.scss` — add 7 light-only duplicate selectors to the block created in task 3

**Steps:**
- [ ] For each of L1-L7 in design §6.1, add a rule to the `.tb-default:not(.tb-dark)` block that **duplicates the original selector at equal-or-greater depth** and re-points only the colour. **Leave every original declaration in place** — that is what keeps dark byte-identical and makes AC-29 provable.
  - L1 `body` → the light-only form needs `body.tb-default:not(.tb-dark)` (a `body` descendant selector cannot reach `body` itself). Verify this actually applies before moving on.
  - L2 anchors → `color: var(--aq-link)`; L3 → `border-bottom-color: var(--aq-border)`; L4 hover/focus → `border-bottom-color: var(--aq-link)`. All three must include the original `:not(.mat-mdc-button-base, .mdc-tab)` so no button is caught.
  - L5 `.tb-error-message` → `var(--aq-error-text)`
  - L6 `.mat-mdc-row.mat-mdc-selected:not(.tb-current-entity)` → `background-color: var(--aq-selected)`
  - L7 → re-declare with the fallback changed: `background-color: var(--tb-hover-color, var(--aq-hover))`
- [ ] Add **no** `!important`. Where a duplicate ties on specificity, add one more class from the original's own ancestor chain rather than escalating.
- [ ] Record the 67 deferred literals from design §6.2 in the follow-up requirement stub (task 11).

**Verification:**
- [ ] Light theme: each of the 7 elements' computed value is the new token value, measured on the rendered page on a route where it is actually visible (login for L1/L2/L5, Devices for L6/L7, Alarms for L2/L6).
- [ ] **Dark theme: each of the 7 elements' computed value is byte-identical to baseline.** This is the AC-29 proof. If any differs, the duplicate selector is matching in dark — stop and diagnose.
- [ ] Contrast re-check on the 7 changed pairs; none below its floor.

**Satisfies:** AC-29.

---

## Task 9: Full verification sweep

**Files:** none modified — evidence only, into `.claude/team/artifacts/airlinq-blue-light-recolour/after/`

**Steps:**
- [ ] Re-run the build. Confirm exit 0, no new SCSS/TS error vs `baseline/` (AC-19).
- [ ] Re-run lint. Compare the problems/errors/warnings triple with `baseline/lint-before.txt`. **Delta must be zero** (AC-20).
- [ ] Grep the **built** CSS bundle for `color-mix(` → zero matches (AC-21).
- [ ] `git diff -U0 | grep '^+' | grep -c '!important'` → **0** (AC-23).
- [ ] `git diff --name-only` → no `.html`, no `.ts` (AC-24, AC-27). Assert `material.models.ts`, `utils.service.ts` and every `chart*.models.ts` are absent (AC-5, AC-27).
- [ ] `git diff -U0 ui-ngx/src/styles.scss` → no line in :1502-1555 removed or modified (additions only, per R-B); **no line at all** in :1620-1800 (AC-1, AC-2).
- [ ] Token name-set comparison between the two blocks; every colour token in one is in the other, with only the six whitelisted shape tokens light-only (AC-22).
- [ ] Re-dump every `--aq-*` on `<body>` in **dark** on all four routes; diff against baseline. Only the 14 new names may appear; every pre-existing value unchanged (AC-3).
- [ ] Re-capture dark screenshots on all four routes; pixel-diff against baseline. Zero differing pixels, or every differing pixel explained and listed for human acceptance (AC-4).
- [ ] Capture light screenshots on all four routes (AC-25).
- [ ] Re-run `contrast-sweep.py` over the full Q4 set → `after/contrast-after.csv`. Diff against `contrast-before.csv`: **no pair that was ≥ 4.5:1 (or ≥ 3:1 for large/non-text) before and is below that threshold after.** Pairs already failing before are recorded, not blocking. Any newly-failing pair is a **blocking finding** (AC-18).
- [ ] Re-verify AC-6 through AC-15 and AC-17 on the rendered page, in one pass, and record each measured value beside its expected value.

**Verification:** every criterion above has a recorded pass/fail with the measured value. Any fail is escalated to the Technical Architect, not worked around.

**Satisfies:** AC-1 … AC-5, AC-18 … AC-25, AC-27.

---

## Task 10: ADR, follow-up requirement stub, and handover

**Files:**
- Create: `docs/adr/0004-theme-scoped-chrome-rules-and-chrome-ink-tokens.md` (drafted at G2; confirm status)
- Create: `docs/requirements/airlinq-blue-charts-and-legacy-literals.md` (follow-up stub)

**Steps:**
- [ ] Confirm ADR 0004's *Consequences* section matches what was actually built (selector forms, token names, the N8/N9 substitution).
- [ ] Write the follow-up requirement stub carrying, verbatim: the theme-aware chart series palette + the eight named aliases + the saved-dashboard migration question (design §5); the 67 deferred legacy literals (design §6.2); the unreachable part of AC-30 and the `tb-dark`-in-template finding R9 (design §7.2); the dark focus-ring bug at `login.component.scss`:127/132 (design §7.1).
- [ ] Assemble the G3 evidence pack: before/after token dumps, before/after contrast CSVs, screenshot pairs, lint/build deltas, the specificity injection proof from task 4.
- [ ] Hand over to the Code Reviewer with the design doc path, this plan path, and the explicit list of things the reviewer must **prove** rather than read: dark unchanged (AC-3/AC-4), no dark leak from the `:not(.tb-dark)` block, no added `!important`, no `.ts`/`.html`.

**Verification:** both documents exist; the evidence pack contains every artefact named in tasks 1 and 9.

---

## Test plan

Derived from the acceptance criteria, at the lowest level that can carry each one. There are no unit-testable units here — this is a CSS/computed-style change, so the pyramid is inverted by nature and every check is a rendered-page assertion.

| Level | What | Criteria | How |
|---|---|---|---|
| **Static / diff** | Line-range, `!important`, `color-mix`, file-set, token name-set assertions | AC-1, AC-2, AC-5, AC-21, AC-22, AC-23, AC-24, AC-27 | `git diff` + `grep`, scripted, in task 9 |
| **Build / lint** | Green build, zero lint delta | AC-19, AC-20 | task 1 baseline vs task 9 re-run |
| **Computed style, light** | Every token value and every new rule's effect at the element that owns it | AC-6, AC-7, AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-17, AC-30 | `getComputedStyle` on the rendered page, dev-server build (MEMORY 21: the deployed bundle strips `window.ng`) |
| **Computed style, dark** | Byte-identical to baseline | AC-3, AC-29 | token dump diff + per-element diff |
| **Contrast** | Every rail/toolbar text node; full-route sweep before/after | AC-8, AC-18 | `contrast-sweep.py`, extending the existing tool |
| **Visual** | Pixel-diff dark; light screenshots attached | AC-4, AC-25 | fixed-viewport capture, both themes, four routes + six auth pages |
| **Human** | "Reads as the same brand family" | AC-26 | human sign-off after deploy — no agent invents a check |

**Route set (Q4):** login, home dashboard, Devices, Alarms — both themes; plus the six auth pages in light.

**Known-fragile checks, and how to keep them honest:**
- Never assert a rule "applies" from the stylesheet. Assert `getComputedStyle`; diagnose by **injection** (MEMORY 17).
- Chart criteria, if any arise, are read from the **painted SVG**, not the config (MEMORY 21). None are in scope here.
- Run against a **dev-server** build so `window.ng` is available; the deployed bundle strips it.

---

## Rollout and rollback

- **Rollout:** a single UI change with no server, schema or config component. It ships with the next `ui-ngx` build; nothing is feature-flagged because CSS custom properties cannot be gated without a runtime toggle, and adding one would be new structure (out of scope).
- **Rollback:** `git revert` of the commit restores the previous light theme exactly. There is no data migration, no persisted state and no stored config touched — which is precisely why the chart work was deferred (design §5: those values *are* persisted).
- **Blast radius if wrong:** light theme only, cosmetic. The one non-cosmetic failure mode is illegible ink on navy chrome (AC-8), which tasks 3-5 verify per text node before the change reaches the human.
