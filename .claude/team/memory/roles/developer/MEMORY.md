# Role memory — developer

Role-private learnings index. One line per learning, newest first; prune entries that stopped being true. Team-relevant items go to the sign-off as `**Team-learning candidate:**` for Jarvis to promote.

- 2026-09-07 airlinq-blue-light-recolour (G3 round 3): a rule must live in the stylesheet of the component that OWNS the element. Read `_nghost`/`_ngcontent` off the REAL element to find the owner - the rail has FOUR owners (`tb-menu-link` for the nav anchor, `tb-menu-toggle` for the section tile, `home.component` for the wordmark, `tb-side-menu` for the section header). A G3 BLOCKER shipped because the fix sat in `side-menu.component.scss`. And `:host-context()` is mandatory for an ANCESTOR class: `.tb-site-sidenav a` inside `:host ::ng-deep` compiles to `[_nghost-x] .tb-site-sidenav a` and matches nothing.
- 2026-09-07 (G3 round 3): the rule that actually painted the unreadable rail label was MATERIAL'S OWN, not any project rule: `.mat-toolbar .mat-mdc-button-base.mat-mdc-button-base.mat-unthemed { --mat-button-text-label-text-color: var(--mat-toolbar-container-text-color) }` at (0,4,0). The rail `<ul>` lives inside `mat-toolbar.tb-side-menu-toolbar`, so it reaches every nav anchor and beats `side-menu.component.scss`'s (0,3,1). Find the winner by fetching the COMPILED `styles.css` over HTTP and regexing for the property - `document.styleSheets`/`<style>` scans miss `<link>`ed sheets and returned zero hits for a rule that was demonstrably winning.
- 2026-09-07 (G3 round 3): when a token override 'does not work', check whether the ELEMENT re-declares it. Two separate defects this round were the same shape: (a) the auth root div carries `tb-dark`, a BARE class selector, so `var(--aq-bg)` on it resolves DARK even under a `body:not(.tb-dark)` rule - fix is a differently-named token absent from the dark block; (b) Material emits `.tb-default .mat-mdc-unelevated-button.mat-primary { --mat-button-filled-container-color: #0b6b78 }` at (0,3,0) ON the button, so a `.tb-default:not(.tb-dark)` ancestor declaration at (0,2,0) inherited down to the button's PARENT and was then overridden. Walk the ancestor chain printing the property at each level - the level where it flips is the culprit.
- 2026-09-07 (G3 round 3): getComputedStyle can be RIGHT and the pixel still WRONG because a sibling paints over it. `.mat-fab-toolbar-content` computed `rgb(28,37,69)` and every assertion passed, but the screenshot showed white: `document.elementFromPoint` at the band centre returns `div.mat-fab-toolbar-background`, `position:absolute; z-index:21`, painting white ON TOP. This is a THIRD painted-vs-declared failure mode alongside `opacity` and gradients. Always pair a background claim with `elementFromPoint` + a screenshot.
- 2026-09-07 (G3 round 3): a pre-existing `!important` can make a fix unreachable without any specificity being at fault. `mat-fab-toolbar .mat-toolbar.mat-toolbar-single-row { background-color: transparent !important }` blocked the dashboard header - solved by painting an ANCESTOR that is geometrically identical (both 1326x56 at y=8) and carries no `!important`. For F3 no such escape existed (`.tb-dark { background-color: var(--aq-bg) !important }` matches the target element itself, inside the frozen dark block) and the correct answer was a clean STOP.
- 2026-09-07 (G3 round 3): a custom-property override at (0,5,1) silently stole the ACTIVE nav row's white label, dropping its contrast over the gradient from 4.67 to 2.92:1. Any rule that sets `--mat-button-text-label-text-color` on rail anchors needs `:not(.tb-active)`. Re-measure the gradient worst-case after ANY nav-ink change - the regression was invisible on the inactive rows I was actually fixing.
- 2026-09-07 (G3 round 3): hash convention for the dark-unchanged proof - read as BYTES, decode utf-8, **normalise CRLF->LF** (git gives LF, the worktree has CRLF; skipping this makes every hash differ and look like a content change), brace-scan for `.tb-dark {`, sha256 over lines joined by `
` with NO trailing newline. That reproduces `788af402...` for the frozen dark RULE block.
- 2026-09-07 (G3 round 3): python heredoc patching of `.scss` here is fragile twice over - files are MIXED EOL (`styles.scss` CRLF, `home.component.scss` LF) so match strings need per-file `nl` substitution, and em-dashes in existing comments break literal matching through the shell. Prefer LINE-INDEX replacement located by `grep -n`, and assert on the surrounding lines.


- 2026-09-06 left-menu-and-favicon (consolidated fix): `@ViewChild('ref')` on an `<a mat-button>` resolves to the **MatButton DIRECTIVE INSTANCE**, not an ElementRef - `.nativeElement` is `undefined`, so every `event.target !== this.ref?.nativeElement` guard silently returns early and the feature does nothing while building, linting and grepping clean. Use `@ViewChild('ref', { read: ElementRef })` whenever the ref sits on an element that also carries an exportable directive. This is what made Enter/Space dead on the rail flyout.
- 2026-09-06 left-menu-and-favicon: a declared `height: 16px` can compute to 24px when a HIGHER-SPECIFICITY rule in a DIFFERENT component adds `padding: 12px 0` and `box-sizing: border-box` is in force. `CSS.getMatchedStylesForNode` lists every matched rule in cascade order and is the only reliable way to find the winner - reading either stylesheet alone shows a "correct" rule. The fix belonged in the higher-specificity file (`side-menu.component.scss`), not in the file that declared the size.
- 2026-09-06 left-menu-and-favicon: headless Chrome defaults to a ~758px viewport, so `tb-desktop` never applies and the whole rail measures 0 - every criterion reads as a failure. ALWAYS `Emulation.setDeviceMetricsOverride` to >=1280 before measuring this shell. Likewise `:hover` cannot be forced from JS; use `CSS.forcePseudoState` with `['hover']` / `['focus','focus-visible']` and read `CSS.getComputedStyleForNode`.
- 2026-09-06 left-menu-and-favicon: enumerating `document.styleSheets` from `Runtime.evaluate` silently skips `<link>`ed sheets, so a present rule reads as absent. Fetch the compiled `styles.css` over HTTP and grep it instead (and use Python, not `tr | grep -o`, which backtracks catastrophically on a 630 KB single line).
- 2026-09-06 left-menu-and-favicon: prove a menu reshape with an EXECUTED before/after snapshot, not by reading the model - stub the 3 path-aliased imports, compile both `menu.models.ts` versions with the repo's own `tsc`, and diff the JSON. Also resolve container routes before declaring a pageset regression: `/alarms` and `/notification` only `redirectTo` their first child, so "LOST" entries that redirect into surviving pages are not lost destinations.
- 2026-09-06 left-menu-and-favicon: `yarn lint` OOMs at exit 134 even with `NODE_OPTIONS=--max-old-space-size=8192` because NODE_OPTIONS is not inherited by the eslint child. Run `node --max-old-space-size=12288 node_modules/@angular/cli/bin/ng.js lint` directly.

- 2026-09-06 left-menu-and-favicon (review iter 1): a lint DELTA that stays flat can still hide a NEW error - consolidating two Escape paths onto one bare `(keydown)` on a `<div role="menu">` tripped `@angular-eslint/template/interactive-supports-focus` at a NEW line while an equal-and-opposite fix removed one elsewhere, so the total read 568 both times. Diff the per-FILE:LINE findings against the baseline, never just the problem count. Fix is `tabindex="-1"` on the container (correct for `role="menu"` anyway); final delta -2.
- 2026-09-06 left-menu-and-favicon (review iter 1): when a reshape flattens a structure a SECOND consumer derives its own grouping from, do not reconstruct that grouping from the flattened form - keep a pre-reshape reference map. Here `buildUserHome` rebuilt Home cards by walking `section` headings in the flattened menu and silently re-grouped them (11 cards vs 9). Fix: a `homeMenuMap` holding the original `defaultUserMenuMap` verbatim + `buildUserHome(authState)` running the SAME `referenceToMenuSection`/`menuSectionToHomeSection` pipeline, so the auth filters still apply identically.
- 2026-09-06 left-menu-and-favicon (review iter 1): prove a "renders exactly as before" claim by COMPILING both revisions side by side, not by reading the diff. `git show HEAD:<file>` + the working copy, each with its app-alias imports sed-stubbed, both imported into one `ts-node` harness (`node_modules/.bin/ts-node --skip-project --compiler-options '{"module":"commonjs",...}'`) renders before/after and asserts an empty diff per authority. Sweep every input the filters read (here authority x `edgesSupportEnabled`), not just the obvious one.

- 2026-09-05 dashboard-grid-design-fidelity (task-10 r3): a compiled GLOBAL rule can be the `!important` that kills an inline style - here `.tb-default .tb-widget { border: 0 !important }` in `styles-*.css` (0,2,0), NOT the dashboardCss rule everyone suspected. `dashboardCss` is namespaced `.tb-default .tb-dashboard-page-css-<guid> .tb-widget` (0,3,0), so it CAN out-specify the global sheet - that is the escape hatch when a widget's `config.widgetStyle` refuses to render. Enumerate `document.styleSheets` and filter by `el.matches(rule.selectorText)` to find the real winner instead of guessing.
- 2026-09-05 dashboard-grid-design-fidelity (task-10 r3): to target ONE widget from dashboardCss with no `data-widget-id`, use an INERT MARKER in `config.widgetStyle` (`border-style: solid`) plus the attribute selector `.tb-widget[style*="border-style: solid"]`, and render every visible property from dashboardCss. The marker travels with the widget, so it survives `mobileOrder` grid reflow that breaks any nth-child/position selector. Assert the marker's uniqueness IN THE TRANSFORM so a future widget growing a widgetStyle fails the dry run rather than silently stealing the style.
- 2026-09-05 dashboard-grid-design-fidelity (task-10 r3): `.tb-timewindow` is NOT unique - it matches 6 elements (a responsive toolbar PAIR, one `display:none` per breakpoint, plus one inside each timewindow-bearing widget). Scope header-only chrome to `mat-toolbar .tb-timewindow`, which keeps both responsive twins and excludes all in-widget controls. Always count matches in the browser before styling a `.tb-*` class.
- 2026-09-05 dashboard-grid-design-fidelity (task-10 r3): do NOT simulate dark mode by removing `tb-default` from `<body>` - that also unscopes every `dashboardCss` rule (they are namespaced under `.tb-default`), so ALL custom styling vanishes at once and reads as a false regression. Dark mode only ADDS `tb-dark`; test with `classList.add('tb-dark')` alone.
- 2026-09-05 dashboard-grid-design-fidelity (test iter 2): a component-scoped `.scss` is NOT in the global `styles-*.css` bundle, so a static HTML fixture + global stylesheet CANNOT verify it (no `_ngcontent-%COMP%` attribute -> zero styling, looks like a bug but is not). Verify component styling by reading the COMPILED Ivy chunk instead: `grep -o '.tb-status-chip\[_ngcontent[^{]*{[^}]*}'` proves the CSS, and grepping the template fn (`isSeverityColumn(a)?2:3`, `"tb-status-chip"`, `c("innerHTML"`) proves which BRANCH renders what. This verifies a widget with no backend and no dev server.
- 2026-09-05 dashboard-grid-design-fidelity (test iter 2): to de-risk an `[innerHTML]`/`bypassSecurityTrustHtml` cell, render a real component in an `@if` branch beside it - the sanitizer path stays for every OTHER column and user `cellContentFunction`s keep working, while the hardened cell bypasses it entirely. Make the data fn a CLOSED SET (return null unless the raw value is a key of a fixed Map) so no entity-derived string can reach markup. The widget's `cellContentCache` is indexed `row*cols+col`, so a skipped column just leaves its slot `undefined` - no index drift, no invalidation change needed.
- 2026-09-05 dashboard-grid-design-fidelity (test iter 2): `StatusChipComponent` had to move from `HomeComponentsModule` to `SharedHomeComponentsModule` for the widget module to resolve the selector (a component declares in exactly ONE NgModule). `HomeComponentsModule` already imports SharedHome, so re-exporting SharedHome there keeps all ~46 existing consumers working with a 1-line change and no cycle.
- 2026-09-05 dashboard-grid-design-fidelity (review iter 1): a chip/pill's contrast must be measured against the COMPOSITE it actually sits on — an alpha tint over the row background, and the row's `:hover`/`.selected` overlays composite UNDER the chip, so each tone needs checking in 3 row states x 2 themes (30 combinations). Full-strength semantic tokens on their own 18% tint fail 4.5:1 in both themes; the fix is dedicated `--aq-*-chip-fg` label tokens, NOT changing the shared semantic tokens (which carry other contrast budgets). Calculator kept at `.claude/team/artifacts/dashboard-and-grid-design-fidelity/contrast-check.py`.
- 2026-09-05 dashboard-grid-design-fidelity (review iter 1): do NOT define `--tb-alarm-severity-*` to alias the `--aq-*` family — those tokens were deliberately undefined so ~5 consumers fall through to DISTINCT per-severity fallbacks in `alarm.models.ts`; aliasing MAJOR/MINOR/WARNING to one colour destroys severity differentiation where no text label accompanies the colour.
- 2026-09-05 dashboard-grid-design-fidelity: build/lint toolchain traps (yarn not on PATH — use `ui-ngx/target/node`; `yarn lint` needs `NODE_OPTIONS=--max-old-space-size=8192` or it OOMs at exit 134), repo baselines already red (lint 462 errors, `license:check` 7 untracked files, `netty-mqtt` needs Docker), the 5-edit checklist for adding an entity-table column type (the 5th, the `entityColumns` instanceof filter, fails only at runtime), and why a string `[class]` binding would have broken the status chip. → `learnings/2026-09-05-dashboard-grid-design-fidelity.md`
- `Team-learning candidate:` A background CSS colour is only trustworthy if you read the PAINTED PIXEL. When the surface is a z-index SIBLING layer rather than an ancestor - the /home dashboard header's navy lives on `div.mat-fab-toolbar-background` (`position:absolute; z-index:21`) - an ancestor-walking `bgOf()` returns the wrong backdrop (`#eeeeee`) for every ink on that surface. In this round that produced 8 FALSE failures and nearly masked 2 real ones (a 1.33:1 illegible dashboard title and a 3.30:1 timewindow label). Decode the screenshot instead: glyph-core pixel inside the text rect, modal pixel of a ring just outside it. Harness: `.claude/team/artifacts/2026-09-07-g3-round2-fix/pixel-decode.py`. This is the same defect family as the `opacity` note - `getComputedStyle` agrees with the stylesheet and therefore cannot see either.
- `Team-learning candidate:` When the declaration you need to beat is `!important` and you may not add one, override the TOKEN it reads instead of fighting the declaration. `.tb-default { .tb-timewindow-label { color: var(--aq-text-3) !important } }` (a shared, pre-existing rule) could not be beaten by any non-important rule at any specificity, and narrowing it would have hit every in-widget timewindow. Re-pointing `--aq-text-3` on the header scope alone let the `!important` rule keep winning while resolving to the right colour. Requirement: enumerate every consumer of that token reachable inside the scope first (16 in styles.scss; only 1 reachable here - verified on the real route that `.mat-mdc-header-cell` still read `#525c6e`). Dark safety is structural: `:not(.tb-dark)` means the override cannot match, proven by reading the token inside the scope in dark and getting the same value as `<body>`.
- `Team-learning candidate:` "Out of scope" is a decision with an EXPIRY DATE tied to the surface, not to the class. `.state-entry`/`.state-divider` were correctly dropped at G2.5 round 1 as belonging to a different component - and correctly, because nothing had made that surface navy. Changing the surface (F2's navy header) silently pulled them back INTO scope and turned a documented non-issue into a BLOCKER. Whenever a change repaints a surface, re-enumerate every ink on it from the DOM rather than trusting the earlier scope ruling.
- `Team-learning candidate:` Angular's dev server can serve a STALE bundle after a Python/`sed` file rewrite - the watcher may not see the mtime change, and the log then shows a "Rebuilding..." that never completes or no rebuild at all. A computed-style assertion against that stale page reads as "my fix does not work" and invites a wrong second fix. Always confirm the rule reached the browser before diagnosing the cascade: `curl -s http://127.0.0.1:4200/styles.css | grep -c '<your-selector>'`, or interrogate `document.styleSheets` for rules matching the element (an empty match list means the rule is ABSENT, not out-specified). `touch` the source to force the rebuild.
- `Team-learning candidate:` Distinguish "deletion relative to the working state" from "deletion relative to HEAD" before declaring an additions-only invariant broken. F5 removed a dark-token line, which looked like the first deletion in a round that had been additions-only - but `git show HEAD:<file> | grep -c <token>` returned 0: the token had been added earlier in the same uncommitted diff, so against HEAD (which is what the acceptance criteria measure) the block was still purely additive. Report both framings; only the HEAD-relative one is the gate.

## D-NEW2 (2026-09-08) — a fix can be correct AND leave half its element uncovered
- `Team-learning candidate:` **An `@if`/`@else` template branch is a SEPARATE surface that a
  desktop-only verification pass structurally cannot see.** `entity-state-controller.component.html`
  renders two mutually exclusive branches on `isMobile` (`:19` / `:32`); BLOCKER-1 fixed the desktop
  `.state-entry` spans and the mobile `<h1>` (`:43`) plus `<mat-select>` (`:34`) kept the identical
  defect — inheriting `.entity-state-controller { color: rgba(0,0,0,0.76) }` for 1.33:1 on the navy.
  At 1920 width both mobile elements simply DO NOT EXIST in the DOM, so every computed-style query,
  screenshot and pixel decode reported the surface clean. **Grep the template for `@else` / `@if`
  on a viewport/mode flag before declaring an element covered, and verify at each branch's viewport.**
- `Team-learning candidate:` **A geometry-only component rule is an invisible inheritance hole.**
  The `h1` rule at `entity-state-controller.component.scss:59-66` sets six properties, none of them
  `color` — so the element is painted by an ANCESTOR's colour and a grep for `color` in the component
  finds nothing at the h1. The competing declaration is two levels up at `.scss:20`. When an element
  paints wrong but declares no colour, look UP, not at its own rule.
- `Team-learning candidate:` **"Same-looking scope" is not the same scope — verify by brace-matching
  the template, not by reading the selector.** The diff already carried `.tb-primary-toolbar h1`
  (`styles.scss:1960`) and it looked like it should cover this h1. It cannot:
  `mat-toolbar.tb-primary-toolbar` OPENS at `home.component.html:63` and CLOSES at `:106`, while the
  `<router-outlet>` rendering `section.tb-dashboard-toolbar` is at `:114` inside a SIBLING
  `div.tb-main-content`. Two toolbars on one page, two disjoint scopes. This is the second time on
  this surface that a plausible-looking selector reached nothing.
- Third instance of the custom-property trap (after MAJOR-2 and `.default-state-controller`): the
  mobile `mat-select` is painted via `--mat-select-enabled-trigger-text-color` (`.scss:75`), so a
  `color` rule is inert. Set the property. Also: the pre-existing select rule was scoped to
  `.mat-mdc-select.default-state-controller` and this select carries no such class — **a class in a
  selector is a filter, and a sibling component's element will not carry another component's class.**
- Method that worked: `Element.matches(selector)` in-browser is the cheapest proof that (a) a new
  rule reaches its target in light and (b) it CANNOT reach it in dark (`:not(.tb-dark)` → `false`).
  Pair it with physically `deleteRule()`-ing the new rules from the CSSOM and re-reading
  `getComputedStyle` — if the dark value is byte-identical with and without them, dark-neutrality is
  proven by construction rather than by argument. No `git stash` on a frozen tree: reconstruct the
  pre-change file into a TEMP path and `git diff --no-index` for a delta.

## D-NEW3 (2026-09-08) — narrowing a frozen rule, and how to prove dark unchanged without a hash
- `Team-learning candidate:` **Before treating an `!important` rule as the blocker, check whether
  it is even the cascade WINNER on the element you care about.** The bare
  `.tb-dark { background-color: var(--aq-bg) !important }` (`styles.scss:1737`) looked like the
  thing painting the auth root div, and the G3 class-toggle experiment appeared to confirm it.
  But the sibling rule one line below, `.tb-dark .mat-app-background { … !important }` (:1738),
  ALSO matches that div — every auth root div carries `mat-app-background` **and** `tb-dark` on
  the same element — at **(0,2,0)** vs **(0,1,0)**, same `!important`. So in DARK the self-match
  was already being outranked and was redundant; removing it is a provable dark no-op. Enumerate
  every matching declaration per ELEMENT (`el.matches(r.selectorText)` over the CSSOM) before
  concluding which rule owns a pixel — the toggle experiment proves a class MATTERS, not WHICH
  rule won.
- `Team-learning candidate:` **Dart Sass rejects a suffix `&`.** `body& { … }` fails with
  *"&" may only used at the beginning of a compound selector*. To prepend an element to the
  parent selector use `@at-root body#{&} { … }`. This costs a build cycle if you assume the
  intuitive spelling compiles — and the failure is a hard build error, not a silent no-op.
- `Team-learning candidate:` **The strongest "nothing else regressed" proof for a narrowed
  selector is the MATCH-SET DIFFERENCE, not a screenshot sweep.** The set of elements that can
  possibly change is exactly `el.matches(OLD) && !el.matches(NEW)`. Evaluating that one
  predicate over `document.querySelectorAll('*')` per route returned **0 elements on 11
  authenticated routes** and exactly 1 on each auth route — an exhaustive result over the live
  DOM that no finite set of screenshots could establish.
- `Team-learning candidate:` **A pixel-identity claim needs its own NOISE FLOOR measured first,
  on the same route, same server.** `/home` compared against ITSELF differed by 3.8% (animating
  widgets + streaming telemetry), so it cannot host a pixel-identity target at all;
  `/entities/devices` compared against itself was byte-identical, making it a valid target. Two
  further confounds bit on the valid route: (1) **`:hover` follows the mouse across a
  navigation** — a 47px band at y618 was one table row hovered in one capture only, 74,141
  pixels of pure artefact; park the pointer identically on both servers and assert
  `[...rows].filter(r=>r.matches(':hover')).length === 0` before shooting. (2) A
  `transition: all` element carrying LIVE data (`.tb-menu-badge`, the alarm count) is
  mid-transition at capture time; its 34 anti-aliased pixels are noise. Report the excluded box
  and the count outside it (**0 / 2,073,479**) rather than a bare percentage.
- `Team-learning candidate:` **When the frozen-block hash necessarily changes, publish BOTH
  digests plus the one-line block diff, and say plainly which proof replaced it.** A hash is a
  cheap proxy for "unchanged"; once one authorised line lands inside the block the proxy is gone
  and only rendering can carry the claim. Build the comparison server so the two trees differ by
  EXACTLY the one line (copy every other modified file across, then `diff -r` to prove it) —
  otherwise a pixel diff is measuring the whole work item, not the change under review. Also
  keep the token-block additivity check separate: it was untouched and stayed additive (43/43
  HEAD declarations byte-identical, 13 added, 0 removed).
- Process note: STOPPING at F3 rather than adding an `!important` or hacking the block is what
  produced the authorisation to fix it properly one round later. The blocked AC carried the
  recommended one-line fix in writing, so executing it at G4 took minutes. **A well-documented
  STOP is a deliverable.**
- `Team-learning candidate:` **Recompute a published digest from the FILE at the end, never copy
  it forward from an earlier report in the same session.** I published `dbdb0870…` for the D-NEW3
  block, but that was the digest of an intermediate `body&` spelling that **does not even
  compile**; the shipped `@at-root body#{&}` form is `ed306ea2…`. The block diff looked correct
  at both points, so nothing flagged it — only re-deriving the hash from the final file caught it.
  A digest is an exact claim; treat any hash quoted from memory as stale by default.
