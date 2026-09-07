# run-3 — live dashboard verification after task 10 (AC-24…AC-31)

Outcome: FAIL, 4 findings (2 High, 2 Medium). AC-29/AC-30(legend)/AC-31 pass; AC-25/26/27/28 fail.

## Learnings

- **A custom widget can render perfectly and still be wrong: check the DATASOURCE, not just the type.**
  The fleet bar's `typeFullFqn` was the new `tenant.airlinq.fleet_alignment_bar` and it drew,
  but it kept the REPLACED progress-bar's single `yard_health_pct` datasource. Replacing a widget
  type without migrating its `dataKeys` is a distinct failure mode from the "phantom widget type"
  that killed the first task-10 attempt — and it looks healthier, because something draws.

- **Label-matched dataKey routing fails silently and plausibly.** The controller buckets series with
  `label.indexOf('align') >= 0`. The legacy key's label "Fleet alignment health" contains "align",
  so a percentage (54.5) was routed into the *aligned count* slot and rendered as a full-width
  segment. Nothing errored. Always compare rendered numbers against an independently derived
  ground truth (I queried the 11 devices' live `tilt_magnitude`: 5/1/5), never against the config.

- **`settings: {}` on a CUSTOM widget type is not automatically the known-bad pattern.** Team memory
  flags hand-written `settings:{}` as breaking widgets; here it was harmless because the custom
  controller reads datasource labels, not settings. The real defect was one level over. Don't
  fire the remembered heuristic without confirming the mechanism.

- **`spinner: true` from a `mat-spinner` selector is a FALSE POSITIVE.** ThingsBoard keeps
  `.tb-widget-loading` permanently mounted and toggles Tailwind's `!hidden`. Assert the `!hidden`
  class (or `offsetParent === null`), never mere presence, or every widget reads as stuck.

- **`querySelectorAll('tb-widget-container, .tb-widget')` double-counts** — the same widget matches
  both, and the census reported 57 for a 19-widget dashboard. Use `tb-widget.tb-widget` and locate
  value cards by the `widget-type-system-cards-value_card` class; the `.tb-widget-title .title`
  text lookup returned zero KPI hits and cost a probe cycle.

- **ECharts is not a window global in this build.** `window.echarts` is undefined; reach the
  instance by walking the Angular component from `ng.getComponent(<tb-time-series-chart-widget>)`
  looking for an object with both `getOption` and `setOption`. Also: the `markLine` lives on a
  SEPARATE synthetic series (12th of 12) with no `name` — a `for s in series: s['name']` scan
  raises KeyError and a naive "no markLine" conclusion would have been a false finding.

- **Resolved vs raw token values diverge.** `--aq-error-tint-strong` is UNDEFINED in this build:
  `getPropertyValue` returns `''` while a probe element resolves it to `rgb(0,0,0)`. A
  `var(--undefined, var(--fallback))` chain therefore silently uses the fallback — check `raw`
  emptiness before asserting a token-derived colour.

- **Node/yarn are not on PATH; the maven-downloaded pair lives in `ui-ngx/target/`**
  (`target/node/node.exe`, `node target/yarn/dist/bin/yarn.js start`). A bare `yarn start` fails
  with "No such file or directory" and looks like an environment blocker.

- **`sed -i` on `proxy.conf.js` leaves it dirty even with byte-identical content** (LF→CRLF
  normalization warning). `git checkout -- ui-ngx/proxy.conf.js` is the reliable revert; verify
  with an empty `git status --short`, not by re-reading the lines.

**Team-learning candidate:** Replacing a dashboard widget TYPE does not migrate its datasource —
the old `dataKeys` persist and a label-matching controller will bucket them into the wrong slot and
render confidently wrong numbers. Verify rendered values against independently derived ground truth.

**Team-learning candidate:** ThingsBoard keeps `.tb-widget-loading` mounted always and toggles
`!hidden`; a `mat-spinner`-presence check reports every widget as spinning.
