
- `Team-learning candidate:` A TWO-LAYER fix is only as done as its weakest layer, and a code-only layer can measure as a NO-OP at every realistic size. D5's autoscale floor (`autoScaleMin = 0.70`) is verifiably in the served production bundle (minified `iN=160,aJ=80,rJ=.7`, `R=Math.max(ne/iN,rJ)`), yet the floor NEVER ENGAGES on the Container Operations KPI tiles: measured scale is 0.9894 @1600px, 0.7394 @1280px, 1.3875 @390px - all above 0.70. With the dashboard's ACTUAL stored `labelFont.size = 11` the painted label is 10.88 / 8.13 / 15.26px, i.e. BELOW the 11px floor at the two desktop widths. The design rationale itself says layer (b) (stored 16px label) is "load-bearing, not complementary" because at a stored 11px the required scale is 11/11 = 1.0. Lesson: verify the stored/config layer, not just the code layer, and read the real persisted value from the API (`/api/dashboard/<id>` -> `config.settings.labelFont.size`) rather than trusting the design doc's assumed value.
- Verifying a minified bundle needs the MINIFIER'S names, not the source's: greps for `autoScaleMin`, `squareLayoutSize` or `/160,0.7` all returned nothing while the code was present as `iN=160,aJ=80,rJ=.7`. Anchor the search on a stable STRING the minifier cannot rename (a CSS class like `value-card-content`, or a `setStyle(...,"transform",` call) then read outward. A failed grep for a source identifier is NOT evidence the change is absent from the bundle - that mistake nearly produced a false "stale chunk" diagnosis.
- On this laptop the local prod-serve (`prodserve.js` over `target/generated-resources/public`) proxies REST fine but NOT the telemetry WebSocket, so dashboard widgets spin forever and `tb-value-card-widget` never enters the DOM. Widget geometry/scale claims can still be proved by measuring the real `.tb-widget` panel boxes and reproducing the bundle's own arithmetic - no live data required. Do not conclude "widget absent from bundle" from an empty `querySelectorAll`.
- CRLF panic check, settled: a fully-CRLF worktree with `core.autocrlf=true` is NORMAL on Windows and commits normalised. The correct evidence is `git diff --numstat` (tight per-file counts), NEVER a worktree CR count - which reports whole-file churn that will never reach history.

## Findings-loop round 1 — left-menu-defect-fixes (2026-09-08)

- NEW MARKUP triggers the four-owner rail rule just as hard as new CSS. Round 0 added
  `.tb-menu-dot` / `.tb-menu-badge` spans to `menu-toggle.component.html` while their
  only rules lived in `menu-link.component.scss` — compiled to
  `[_nghost-<menu-link>] .tb-menu-badge`, unmatchable from menu-toggle's template. The
  existing memory note said "a rule must live in the OWNING component"; the missing
  half is "…and adding markup to component B means B needs the rule, even when an
  identical class is already styled in A". Grep the class in the OWNING stylesheet, not
  repo-wide, or a duplicate elsewhere reads as a false all-clear.
- `_nghost` vs `_ngcontent` decides whether a rule survives a CDK overlay, and the two
  scopes in one component file behave differently: a `:host ::ng-deep` rule emits
  `[_nghost-%COMP%] …` and needs the host as an ANCESTOR (fine in-rail, dead in the
  overlay); a GLOBAL rule in the same file emits `_ngcontent-%COMP%` on every compound
  and needs no host, so it reaches overlay-projected markup. For a component that
  renders into both places, pick the scope per ELEMENT, not per file.
- Verify a rule's OWNER from the bundle by finding the enclosing `styles:[` and then the
  nearest preceding `selectors:[["x"]]` — "nearest component selector before the rule"
  is NOT reliable (styles are emitted before the selectors line, so a naive
  before/after heuristic gives opposite answers).
- `isDevMode()`-guarded code is TREE-SHAKEN from a production build. Its absence from
  `main-*.js` is not evidence the edit is missing; prove it by building `--configuration
  development` and grepping there. A production-bundle-only check would have wrongly
  failed this round's F2 deliverable.
- ESLint 9 flat config defaults `reportUnusedDisableDirectives` to "warn", and this repo
  has no `no-console` rule — so a defensive `// eslint-disable-next-line no-console`
  ADDS a warning and breaks a zero-delta lint invariant. Confirmed: the baseline report
  already carries "Unused eslint-disable directive" warnings. Check the rule is actually
  configured before adding a disable for it.
- Never pipe `ng lint` through `tail` to read the verdict: the summary
  `567 problems (460 errors, 107 warnings)` is followed by trailing lines, and piping
  also masks the real exit code via PIPESTATUS. Redirect to a file, then grep.
- When auditing a specificity claim, measure the COMPILED selector and count attributes,
  classes and TYPES separately. The disputed D1 figure was (0,10,1); the artifact says
  (0,12,2) — 6 `_nghost`/`_ngcontent` attributes + 6 classes, and two element types
  (`mat-sidenav-container`, `mat-sidenav`). The conclusion (the rule wins) was
  unaffected, which is exactly why a wrong number survives review.
- A harness that parses two adjacent `Map` literals out of one source file will silently
  merge them. `defaultUserMenuMap` and `homeMenuMap` both key on `Authority.*`; slicing
  from the first map to `buildUserMenu` covered both and produced a phantom
  toggle-in-toggle "offender". Slice each map by its own brace/bracket extent and label
  which one you measured. The phantom turned out to be a REAL and deliberate
  arrangement in homeMenuMap — so the fix was a scope note, not a code change.
- A guard and its compensating assertion are one deliverable, not two. Landing the guard
  alone (F3) converted a loud crash into a silently wrong menu with a plausible height;
  the assertion is what keeps the invariant observable. Land them together or the guard
  is a regression.

## D3 round 2 (left-menu defect fixes: user-block glyph + collapsed-rail dot)
- `box-sizing: content-box` applies to BOTH axes, so it is never a "block axis only"
  choice. On the rail-foot user block it was load-bearing on the block axis (AC-15's
  56px = 12+32+12 with the hairline excluded) while silently breaking the inline axis:
  `width: 100%` resolved to a 250px CONTENT width inside a 250px rail and the 28px
  horizontal padding was added OUTSIDE it, for a 278px border box. Fix the one axis
  (`width: calc(100% - 28px)`, the inset derived from `padding-left + padding-right`),
  never flip `box-sizing` wholesale. Verify by reading `computedWidth` (222px) AND the
  border box (250px) - the declared value alone tells you nothing about which axis broke.
- A correct `margin-left: auto` can park an element OUTSIDE its container and still be
  the right declaration: it aligns to the border box's trailing edge, so if the border
  box overflows, so does the element. "The glyph is 24px past the rail" and "the flex
  alignment is wrong" look identical from the element's own rect; measure the element
  against the CONTAINER's rect (`glyphBeyondRailRight`), not against its parent.
- FOURTH distinct way `getComputedStyle` is right while the pixel is wrong, and the one
  that cost this round two extra cycles: an ancestor's `opacity: 0`. The collapsed-rail
  dot reported `opacity: 1` + the correct `--aq-error` background at every step, while
  its parent `span.mdc-button__label` was faded to 0 by side-menu's collapse rule. An
  ancestor opacity cannot be cancelled from the child, so this is never a CSS fix on the
  element - the element has to LEAVE the subtree. Always compute the EFFECTIVE opacity
  (product down the chain), not the element's own.
- mat-button's real projection contract, read from
  `@angular/material/fesm2022/button.mjs`, is
  `.material-icons / mat-icon / [matButtonIcon]`, each optionally `[iconPositionEnd]`.
  `mat-icon` there is an ELEMENT selector - `class="mat-icon"` matches NOTHING and the
  node stays inside the label. `matButtonIcon` is the attribute form and works on a
  plain `<span>`. Read the component's own template for slot selectors; guessing from
  the class names in the DOM gives the wrong answer.
- NG8011: Angular SKIPS content projection when the surrounding `@if` has more than one
  root node, and says so as a build WARNING, not an error. The dot silently stayed in
  the faded label and the build stayed green. Splitting into two `@if` blocks with the
  same predicate is the compiler's own prescribed fix. Two lessons: read the dev-server
  log after a template edit (the answer was printed verbatim), and a new NG-code warning
  also breaks a zero-lint-delta invariant.
- Dart Sass `mixed-decls`: a declaration placed AFTER nested rules in the same block
  changes emission order in Dart Sass 3. Compiling the component SCSS directly against
  the repo's own `node_modules/sass` catches it in seconds and is worth doing before any
  browser round-trip - it also proves the file compiles independently of the dev server.
- `ui-ngx/node_modules` can exist as an EMPTY directory (a previous cycle's junction
  removed), which makes `ls` report 0 entries while `find` still lists the path. Yarn
  1.22.22 lives at `ui-ngx/target/node/yarn/dist/bin/yarn.js` after any Maven build and
  installs from the populated `%LOCALAPPDATA%/Yarn/Cache` in ~100s offline - so a
  missing node_modules is not a blocker and not a reason to invent a verification route.
- `nohup cmd &` from the Bash tool is reaped when the wrapper shell exits; the process
  may nonetheless survive and hold the port, so a second launch fails with "port already
  in use" while the FIRST server is the live one. Check which log file is still growing
  before concluding the server died.
