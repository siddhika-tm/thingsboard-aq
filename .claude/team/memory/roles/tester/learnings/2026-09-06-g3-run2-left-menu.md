# G3 run-2 — left-menu-and-favicon, 2026-09-06

Frozen tree, exclusive access. 33 PASS, 1 PASS-with-limitation, 3 FAIL, 1 N/A(human).
All six run-1 findings verified fixed. Three NEW findings, one of them Critical.

## Learnings

- **A "static review at zero findings" says nothing about runtime.** The reviewer's pass, the lint
  gate and `BUILD SUCCESS` were all green while `/alarms/alarms`, `/alarms/alarm-rules`,
  `/notification/inbox` and `/resources/widgets-library` rendered **no left menu at all**. Only
  opening the routes in a browser found it. Re-learns the older lesson: structural proof is not
  visual proof — always sweep EVERY route the changed menu can reach, not just the ones a criterion
  names.
- **Restructuring a data model breaks its unguarded consumers, which live outside the diff.**
  Flattening `alarms`/`notification_inbox` to top level left `alarms_center` a `type:'link'` with no
  `pages`; `router-tabs.component.ts:113` does `found.pages.filter(...)` unguarded even though
  `findRootSection` two lines down is defensive (`section.pages?.length`). The defect file was NOT in
  the 26-file diff. **When a diff changes the shape of a shared model, grep every consumer of the
  removed/reshaped property** — the reviewer's file-scoped read cannot see them.
- **Measure the element that carries the declaration, and confirm you found it.** My first flyout
  probe measured `.tb-popover-inner` (the CDK ancestor) and reported bg `#ffffff`, `padding: 0`,
  `border-radius: 0` — three false findings. The declarations live on `.tb-toggle-menu-items`, whose
  measurements were exact. Read the SCSS selector first, then query that class by name.
- **A rule that matches can still be outranked — prove it by injection, both directions.** The
  flyout row matched `.tb-toggle-menu-items a.mat-mdc-button` (`el.matches() === true`) yet computed
  `8px 16px`; injecting the same declaration at higher specificity repainted it to `0 12px`, which
  identifies "outranked" rather than "not matching". The winner was pre-existing
  `popover.component.scss` `.tb-menu .tb-menu-content .mat-mdc-button:not(...)` (0,4,0 vs 0,2,1).
- **`width: auto` on an `inline-flex` anchor silently shrink-wraps.** The rail `<li>` was the correct
  48px while the anchor inside it measured 34px. Measuring only the `<li>` (or only the anchor)
  yields the wrong verdict — **walk the box chain from the anchor up to the shell** and compare each
  level against the intended geometry.
- **Distinguish "not set" from "set wrongly" before writing an aria finding.** Three routes showed
  zero `aria-current` in the menu, which looked like a binding defect; the real cause was that the
  menu had been WIPED on those routes (F-7). Comparing `aria-current` against the pre-existing
  `tb-active` on all 10 routes showed **zero mismatches** — the new binding is correct, and the
  anomaly belonged to a different, larger finding.
- **`ps -W` on this box prints memory, not PIDs** — `taskkill //PID <that number>` reports "process
  not found" while the dev server keeps serving. Use
  `Get-CimInstance Win32_Process | Where CommandLine -like '*<repo>*'` for real PIDs, and verify the
  port is closed afterwards rather than trusting the kill's exit code.
- **`git stash` on a frozen tree is correctly refused.** I reached for it to A/B the baseline; the
  permission classifier blocked it, and it would have violated the "no source edits" constraint.
  Static analysis of the diff (bare-id occurrence counts doubling) plus the runtime stack trace
  established causation without mutating anything.
- **A heredoc containing an apostrophe (`Jarvis's`, `user's`) breaks `bash <<'EOF'`** with
  "unexpected EOF while looking for matching `''`". Write long reports with the Write tool.

**Team-learning candidate:** `router-tabs.component.ts:113` dereferences `found.pages` unguarded
while `findRootSection` (:151) guards the same property. Any future menu-model reshape that leaves a
section pages-less crashes the SHARED `menuSections()` pipeline and blanks the whole side menu — not
just the tab strip. Grep consumers of `.pages` before reshaping `menu.models.ts`.
