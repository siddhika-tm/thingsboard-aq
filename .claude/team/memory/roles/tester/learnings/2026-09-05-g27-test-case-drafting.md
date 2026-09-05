# 2026-09-05 — Drafting the G2.7 case list (dashboard-and-grid-design-fidelity)

## Context
Drafted the G2.7 test-case list for a wide shared-component UI change (entity grid anatomy,
status chips, always-visible search, numbered pager) across light + dark themes. Draft-only:
no build, no browser, no execution.

## What was learned

- **Read the implemented code before writing expected results, not just the ACs.** Three
  assertions would have been wrong if taken from the requirement alone: AC-20's bold emphasis was
  deliberately dropped, the count badge is hidden at total 0, and the neutral chip uses
  `--aq-hover` rather than a `*-tint` token. A case list written from the AC text alone would
  have produced false findings and burned a review loop.
- **Enumerate the real consumer set; never trust the stated blast radius.** The requirement said
  "at least 7 additional tables" and the design "10+"; the actual count is **46** (39 routed +
  7 wrapper). Delegating that inventory to a search subagent was cheap and changed the shape of
  the regression tier (risk-stratified subset instead of an unbounded sweep).
- **Applicability flags must be derived, not read.** `selectionEnabled` is ANDed at runtime with
  the enabled group-action count, and Delete is auto-appended when `entitiesDeleteEnabled` is
  true. So "config says selectionEnabled: true" does not mean checkboxes render, and "delete only"
  does mean a selection bar exists. Marking N/A from the config flag alone would mis-scope
  AC-7/13/14/15.
- **Check environment prerequisites at DRAFT time, not at execution time.** Found JDK 25 and
  Maven entirely absent (only JDK 22) — AC-35 is unexecutable. Surfacing that in the draft let
  the human decide before the run instead of it becoming a mid-run STOP.
- **Write both sides of a deviation.** Where the implementation knowingly departs from an AC
  (AC-20), write one case asserting the actual behaviour and one recording the as-written
  failure, and route the choice to the human. Never silently assert either version.
- **Static contrast recomputation is not the same evidence as composited contrast.** The tint
  composites over cell-level `!important` hover/selected overlays, so the sampled pixel is the
  only honest measurement — 5 tones x 2 themes x 3 row states = 30 combinations.

## What to do differently next time
- Start every case list by diffing the working tree and reading the new components; budget ~30%
  of drafting time for that before writing a single case.
- Always run the prerequisite probe (VPN, toolchain, browser, tracked-config edits) as step one
  of drafting and report unmet items in the deliverable.
- Watch for tracked config files that must be edited to test (`ui-ngx/proxy.conf.js` is tracked
  and NOT gitignored) — add an explicit "tree left clean" case.
