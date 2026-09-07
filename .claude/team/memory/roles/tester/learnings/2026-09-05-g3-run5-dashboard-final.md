# G3 run-5 — dashboard design fidelity, final verification (PASS, zero findings)

## What happened
Re-tested AC-24 (toolbar timewindow pill) and AC-26 (Misaligned tile outline) after the
developer's D22/D23a fixes, plus a full smoke of AC-25/27/28/29/30/31. Both themes.
Result: PASS, zero findings, dashboard unmodified at version 42.

## Learnings

- **Test the DEPLOYED app directly via Playwright rather than proxying a local `yarn start`.**
  It is faster, avoids the `proxy.conf.js` LF->CRLF dirty-file trap entirely, and tests what
  users actually get. `channel: 'msedge'` against `http://10.221.89.67:8080` works fine over VPN;
  the overlay's claim that "headless screenshots of the live server do not bootstrap over VPN"
  did NOT hold — headed persistent context worked first try.

- **The production bundle strips Angular debug hooks: `window.ng` AND `window.echarts` are both
  absent.** Every `ng.getComponent`-based probe that works on the dev server returns "no ng" on
  the deployed app. Do not report this as a defect and do not fall back to trusting a previous
  run's config-based result.

- **When the chart option object is unreachable, read the rendered SVG — this build renders
  ECharts as SVG, not canvas.** `getContext('2d')` fails with "no canvas". Querying
  `svg path[stroke-dasharray]` gave stronger evidence than the config ever did: the markLine
  showed as `stroke="var(--aq-error)" stroke-dasharray="4,2"`, series as `stroke-width: 2`, and
  the axis as `stroke="var(--aq-chart-axis)"` — tokens unresolved in the attribute, so the binding
  itself is provable. Rendered output > stored config for any "does it actually draw" criterion.

- **Prove a scoped selector in BOTH directions.** D23a scoped the pill to `mat-toolbar
  .tb-timewindow`, so the test is not only "the toolbar pill has the pill" but also "the four
  in-widget instances still measure 0px radius / 0px border / 14px / 400". Split the node list by
  `closest('mat-toolbar')` and assert each half. Same for AC-26: assert the marked tile HAS the
  border and that the sibling tiles' entire subtrees have ZERO bordered elements.

- **A COOP console error on a plain-HTTP host is environmental, not an app defect.** Edge logs
  "Cross-Origin-Opener-Policy header has been ignored ... origin was untrustworthy" as `error`
  on every page load. Filter it by text before counting console errors, and say so explicitly in
  the report rather than reporting 3 errors or silently reporting 0.

- **`color(srgb r g b / a)` is how Edge serializes a `color-mix` result.** Convert back to hex to
  prove the token: light `0.639216 0.0941176 0.164706` = `#a3182a` = `--aq-error`;
  dark `0.92549 0.384314 0.454902` = `#ec6274`. Do not report an unexpected colour format as a
  mismatch without converting first.

- **A zero-count bucket is a free edge case — take it.** The dark run happened to sample
  Watch = 0, proving the segmented bar renders a 0% segment without breaking layout or dropping
  its legend entry. Telemetry drift between runs is an asset, not just a hazard.

- **Verify the marker's uniqueness from the stored config, not just the DOM.** Confirmed exactly
  1 of 19 widgets carries `widgetStyle.borderStyle === 'solid'` and it is the only widget with any
  `widgetStyle` — that is what makes the `[style*="border-style: solid"]` selector safe against
  future widget edits, and it is worth re-asserting every run.
