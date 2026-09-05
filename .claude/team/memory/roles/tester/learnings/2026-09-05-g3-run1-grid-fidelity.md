# 2026-09-05 — G3 run 1, dashboard-and-grid-design-fidelity

## Context
Executed the human-approved G2.7 case list against the working-tree UI on a local
`yarn start` proxied to the live tenant. 48 pass / 5 fail. The five failures were
invisible to the build, to lint, and to the reviewer's static pass.

## What was learned

### 1. "The rule exists" is not "the rule applies" — measure the COMPUTED value
Four of five findings were correctly-written CSS that never took effect because a
pre-existing rule nested one level deeper won on specificity:
`.tb-default .mat-mdc-table .mat-mdc-header-row` (0,3,0) beats
`.tb-default .mat-mdc-header-row` (0,2,0) — and the new block even carried
`!important`, which does NOT rescue a lower-specificity selector against another
`!important`. A grep for `height: 40px` finds the rule and proves nothing.
**Always assert `getComputedStyle`, never the stylesheet text.**

### 2. Prove a specificity diagnosis in the browser, don't just reason about it
Cheap decisive experiment: inject the same declaration at higher specificity
(add a `.PROBE` class) and re-read the computed value. If it snaps to the intended
value, the rule is right and outranked; if not, the rule itself is wrong. Same for
`!important` blockers — remove the offending class and re-measure. This turned
"I think specificity is the cause" into a proof with a one-line repro for the developer.

### 3. `document.styleSheets` is unreliable for attribution in Angular
`cssRules` came back empty for component-scoped and lazily-injected sheets, so the
"which rule wins" walk returned `[]`. The DOM experiment above is the robust
substitute.

### 4. Selector families differ per build — probe both
This build renders `<mat-row>` custom elements, NOT `<tr class="mat-mdc-row">`.
A `tr`-only selector silently timed out and looked like "the page never loaded".
Always use `'mat-row, tr.mat-mdc-row'` (and the header/cell equivalents).

### 5. Scope DOM probes to the panel under test
Device details drawer tabs sit in the DOM alongside the background grid, so an
unscoped `document.querySelectorAll` reported the *background* table and produced
four identical, meaningless rows. Scope to `.mat-mdc-tab-body-active`. Identify the
real container by walking the ancestor chain, don't guess the class name.

### 6. Verify a "leak" is visible before calling it a finding
The dark-leak probe flagged two opaque-white elements on `/notification/inbox`.
Both were `mat-button-toggle-focus-overlay` at `opacity: 0` — invisible, and
untouched by the diff. Check `opacity`/`visibility` AND whether the diff touches it
before raising anything.

### 7. Compare lint by file:line:rule, not by count — but expect benign shifts
Counts matched the baseline exactly (569), yet three entries differed. They were the
same three problems in the same file shifted +4 lines by inserted markup above them.
Identity comparison catches a real swap; line-shift tolerance stops a false finding.

### 8. A pre-existing env failure can mask the criterion entirely
`mvn install` without `-DskipTests` aborted at `netty-mqtt` (Docker absent, known)
**before reaching ui-ngx** — so it said nothing about the diff. Re-run with
`-DskipTests` to actually compile the changed module. Also: a wrapper that echoes
`BUILD_EXIT=$?` after a redirect reports the echo's status, not the build's — read
`BUILD SUCCESS`/`BUILD FAILURE` from the log itself.

### 9. Suspected-defect cases can exonerate
C-40 (the pager clamp I flagged as possibly High) passed: every reachable shrink path
resets `pageIndex = 0` upstream. Corroborated independently by the sort test. Weighing
reachability before assigning severity avoided a false High.

### 10. Prior memory was right three more times
Neutral chip uses `--aq-hover` not a tint; the badge hides at total 0; the range is
deliberately unbolded. All three would have been false findings had I tested the AC text
instead of the implemented behaviour. Composited contrast sampling also reproduced the
design's worst cases to 2dp (4.72 / 4.79), confirming that method.

## Do differently next time
- Build the computed-value + specificity-probe harness FIRST; it found 4 of 5 findings.
- For any "element has size/border/colour X" criterion, budget a cascade probe, not a grep.
- Re-check env prerequisites against team memory before declaring a blocker (JDK/Maven
  were present at `d:/tmp/tools`, off the default PATH — my earlier "no JDK 25" note was stale).
