# 2026-09-08 — G3 FINAL, airlinq-blue-light-recolour (tester)

Outcome: **G3 PASS**, zero findings. 33 AC adjudicated (28 met, 3 blocked/withdrawn,
1 human-judged, 1 met-by-static-equivalence).

## What worked and should be reused

- **Serve the pristine HEAD alongside the worktree and diff mechanically.** A second
  `git worktree add HEAD --detach` on port 4300, with `node_modules` supplied by a
  Windows **junction** (`New-Item -ItemType Junction`) instead of a 5-minute
  `yarn install`, turned three "is this pre-existing?" judgement calls into
  measurements. It converted AC-3 from a structural argument into a hard result: all
  **49** pre-existing dark tokens byte-identical, 0 changed, 0 removed, exactly 14
  pure additions. Do this whenever an AC says "compared before and after".
  **Remove the junction with `(Get-Item $j -Force).Delete()` BEFORE
  `git worktree remove`** — removing the worktree with a live junction inside it can
  take the real `node_modules` with it.

- **A contrast-sweep key must not embed the resolved backdrop.** My v1 sweepdiff keyed
  on `element|colour|backdrop`, so a deliberate 1-unit surface change
  (`--aq-surface` `#f6f8fa` -> `#f7f8fa`) made all 25 pre-existing failures report as
  simultaneously "new" and "resolved". Key on **element identity only**
  (tag + classes + text) and compare the **ratio**. Same family as the older
  "tolerate pure line shifts" lesson.

- **Two different wrong answers came from the same sweep, and pixel decode settled
  both.** On `/home` the ancestor-walking `bgOf()` reported 8 header inks at
  1.10-1.75:1 against `rgb(238,238,238)`. The walk is **18 levels of
  `rgba(0,0,0,0)`** before it hits `div.tb-dashboard-page`; it never sees the navy,
  because the navy lives on `div.mat-fab-toolbar-background` — a **z-index 21
  SIBLING** of `mat-fab-toolbar-content`, not an ancestor. `elementFromPoint` at the
  same y returns that div. PNG decode gave the truth: 7.38-14.00:1. Never let a
  computed-style backdrop stand alone where a positioned sibling paints.

## Traps that produced false findings this run (all cleared before reporting)

- **A container with no direct text nodes is not an ink.** `.tb-user-info` read
  `rgb(82,92,110)` = 2.68:1 on the rail, and `section.tb-timewindow` read the same on
  the navy. Both have **zero** `nodeType===3` children — the value is inherited and
  paints nothing; the real glyphs are child spans at 14.11/8.87 and 9.30/7.38. Assert
  a direct non-empty text node before measuring any element.
- **A per-column "modal vs most-distant" sweep collapses inside glyphs.** For AC-10's
  "every point along the label's span" I first got a bogus 1.14:1 because in a narrow
  text column the modal colour is itself an antialiased glyph edge. Correct method:
  take the column's **darkest** pixel as the backdrop and compare against the known
  ink (white). Result 0/39 columns below 4.5, worst 4.72 at the right end.
- **`grep -c '!important'` over added lines is not the AC-23 measurement.** 27 added
  lines contain the string; 0 are declarations (26 markdown/SCSS comment prose, 1 a
  *quotation* of the pre-existing rule the fix must not fight). Classify by position
  in a declaration, then read the context of every survivor.
- **Auth-page error styling has two independent paths.** A wrong *password* returns a
  server error and surfaces as a **snackbar** (Material maroon, untouched by the
  diff), leaving inputs `ng-valid`, so `.aq-error`/`.aq-invalid` never render. AC-13
  lives on the **client-side** path — clear the field and dispatch `input`+`blur`.
  Then it shows `#c23333` text / `#dc4848` border, exactly D4's split.
- **A `<a>` picking up a new link token can look like a regression and be an
  improvement.** The leaflet zoom "+" moved `#bbbbbb` -> `#2067ff`, i.e. 1.75 ->
  4.29:1 on a pair that was already failing; it is a 22px **disabled** control
  (non-text, threshold 3.0). Check `.leaflet-disabled` / font-size before judging.

## Environment notes

- **`python3` in this Bash cannot see `/d/tmp/...`** even when `ls` can — it needs
  Windows-style `D:/tmp/...`. Cost two failed script runs.
- **Write is sandboxed to the repo**: `d:\tmp` and the scratchpad are both refused, so
  test scripts must live under `.claude/team/artifacts/<run>/` (untracked — 0 tracked
  files, diff stays clean).
- **Heredocs mangle backslashes**: `replace('\\','/')` inside `python3 - <<'PYEOF'`
  became a syntax error twice. Put any script containing a backslash in a **file**.
- Playwright `browser_evaluate` with `filename:` writes to the **repo root**, not the
  artifacts dir — `mv` it immediately or it dirties `git status`.
- `localStorage['tb-theme']` written *before* login is overwritten during bootstrap;
  the body class is applied at bootstrap, so set the theme then **reload**.
- The `--user-data-dir` origin is per-port: authenticating on :4200 does **not**
  authenticate :4300. Log in on each.

## Reaching a branch honestly

D-NEW2 leg (b) needed a mobile `<mat-select>`, i.e. a breadcrumb with 2+ entries. The
Developer had synthesised it via `window.ng`; the Reviewer ruled that adequate for the
styling claim but not for sign-off. **No dashboard state authoring was needed** — the
demo tenant already ships multi-state dashboards ("Thermostats" 3 states,
"Firmware"/"Software" 6 each; enumerate with `GET /api/tenant/dashboards` then
`GET /api/dashboard/<id>` and read `configuration.states`). Clicking the widget's own
state-navigation action drilled in, the URL gained a two-entry `state=` stack,
`stateObject.length` became 2, the `<h1>` disappeared and the `<mat-select>` rendered
through the real init path. `window.ng` was then used for **observation only**.
Lesson: before accepting a synthesised branch, look for real data that already
reaches it.

**Team-learning candidate:** a `stateObject` is the breadcrumb **stack**, not the
dashboard's state **count** — a 3-state dashboard still renders the `<h1>` branch
until you drill into a child state.
