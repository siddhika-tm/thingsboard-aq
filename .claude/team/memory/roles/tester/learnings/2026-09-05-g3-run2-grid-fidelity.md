# G3 run 2 — dashboard-and-grid-design-fidelity (zero findings, gate opened)

Re-test after the Developer fixed all six run-1 findings. 53 PASS / 0 FAIL.

## What worked
- Reusing the run-1 harness wholesale (copy `harness/*.js`, sed the RUN path to run-2)
  made the before/after comparison exact and cost minutes, not hours.
- Driving the REAL widget component via `ng.getComponent(host)` let me exercise
  tones/severities/error paths that the live data never produces (all 8 alarms were
  CRITICAL, so warning+neutral tones would otherwise have gone untested).

## Traps hit and how they resolved
- **41px header row is NOT a 1px miss.** The header CELL is exactly 40px + a 1px
  bottom rule; the row box wraps both. Forcing 40px at max specificity still yields
  41px, proving no rule is at fault. Separately, /auditLogs+/oauth2 measure cell 39px
  / band 40px while /devices measures 40/41: in `display: table` a row's `height` is a
  MINIMUM and the browser distributes the cell border by +-1px. Proof it is not the
  diff: revert to upstream 56px and ALL pages behave identically (band 56, cell 55).
- **A route probe can match the previous page's still-mounted widget.** The "/users
  header is 9.5px" alarm was the home dashboard's alarms widget, not a /users grid
  (`inEntitiesTable:false`). Always assert `closest('tb-entities-table')` before
  reporting a per-route measurement. Bonus: that 9.5px IS the AC-31 label-size half
  living in server-side dashboardCss - blocked under D19, not a regression.
- **rxjs stubs from page.evaluate:** a hand-rolled `{subscribe,pipe}` throws
  `Unable to lift unknown Observable type`. Clone the prototype of a real instance:
  `Object.create(Object.getPrototypeOf(obs))` then set `_subscribe`.
- **Locate cells by HEADER ORDINAL, not by `columns[]` index.** A leading
  selection/action column shifts the arithmetic and silently reports the wrong
  column - my first probe run "proved" probe B on the Status column.

## Evidence discipline that paid off
- Lint equal totals (569) are meaningless alone; the file:severity:rule:message
  identity diff (harness/lintdiff.py) proved zero added AND zero removed.
- `mvn ... -DskipTests` + grep the log for BUILD SUCCESS *and* confirm ui-ngx actually
  ran `yarn build` (it can be skipped and still say SUCCESS).
- Anti-drift (D18) is worth proving empirically, not by reading the shared import:
  compared chip class+bg+fg+radius+font+dot across /alarms and the dashboard widget -
  byte-identical in both themes.
- Security on a widened surface: injected a hostile label through the widget's real
  translation path -> escaped text, 0 <img>, 0 handlers fired, both themes.
