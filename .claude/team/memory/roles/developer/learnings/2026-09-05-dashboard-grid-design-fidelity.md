# 2026-09-05 — dashboard-and-grid-design-fidelity (plan tasks 1–9)

## Context
Implemented the entity-table/dashboard design-canvas fidelity work: token rescoping,
tint + alarm-severity tokens, a new `tb-status-chip` component, always-visible search +
count badge, selection dismiss, and a windowed numbered pager.

## What was learned

### Build / toolchain
- `yarn` is NOT on PATH. Use the build-local pair: `ui-ngx/target/node/node.exe` and
  `node ui-ngx/target/node/yarn/dist/bin/yarn.js`. Prepend `ui-ngx/target/node` to PATH.
- `yarn lint` OOMs at the default 4 GB heap on this repo. `NODE_OPTIONS=--max-old-space-size=8192`
  is required or it dies with "Reached heap limit" (exit 134) — which looks like a lint failure
  but is not.
- Fast inner loop: `node node_modules/typescript/bin/tsc -p tsconfig.json --noEmit` (~2 min)
  vs a full `mvn install -pl ui-ngx` (~6 min). BUT tsc does NOT check Angular templates —
  a template type error only surfaces in the Maven/ng build. Use tsc to iterate, Maven to gate.
- Raw `tsc -p tsconfig.json` reports unrelated noise (vite `#types/*`, spec files missing
  jest/mocha globals). Filter to the touched files rather than chasing a zero-error total.

### Repo baseline realities (measure before asserting)
- `yarn lint` is **already red on a pristine tree**: 569 problems / 462 errors / 107 warnings.
  No CI workflow runs `yarn lint` at all. So an AC demanding "zero lint errors" is unmeetable;
  the meaningful gate is "zero NEW problems" — prove it by stashing your change and diffing
  the before/after totals AND the per-file entries.
- `mvn license:check` is **already failing** on 7 pre-existing UNTRACKED files (the design-canvas
  `.dc.html` artboards and `.superpowers/` scratch). Do NOT run `license:format` to "fix" it —
  that injects Apache headers into the design spec itself. Verify instead that none of the
  missing-header files are yours.
- The full `mvn install -pl application -am` (tests on) fails in `netty-mqtt` because
  Testcontainers needs Docker, which is not installed. Unrelated to UI work; use `-DskipTests`
  for the reactor build and gate UI work on the ng build + lint delta.

### Angular specifics
- A **string** `[class]="'prefix-' + x"` binding REPLACES the static `class` attribute in
  Angular ≥15 — it would have silently dropped the base `tb-status-chip` class and killed the
  chip geometry. Use discrete `[class.foo]="cond"` bindings (also a closed, developer-controlled
  set of names, which is what ADR 0002 wants for security).
- Adding a new column class needs FOUR edits, not two. The plan named only two:
  1. the `EntityTableColumnType` string union,
  2. the `EntityColumn<T>` union,
  3. **`EntityColumnsType` / `EntityColumnType`** — the `Partial<A & B & C>` intersection the
     template binds against (else TS2339 "property does not exist" on the template),
  4. **every call site's local/return annotation** typed `Array<EntityTableColumn<X>>` must be
     widened to `Array<EntityColumn<X>>` (else TS2740 "missing properties").
- `cellContent()` returns `''` for any column that is not `EntityTableColumn`/`EntityLinkTableColumn`,
  so a new column type is automatically OFF the `bypassSecurityTrustHtml` path, and its cells
  never touch `cellContentCache` (so they cannot render stale). Likewise `cellStyle()` only
  applies `cellStyleFunction` for `EntityTableColumn`, so a `BaseEntityTableColumn` subclass
  gets width-only styling and no `style=""` colour. Worth verifying rather than assuming.

### Verification habits that paid off
- Extracting the pager windowing algorithm into a standalone node script and testing the
  boundary cases (total=1,2,7,8,20,100 × first/middle/last page) caught nothing broken but
  proved D3's fixed-width claim instead of asserting it.
- Independently re-derived the D7 "expected no-op" claim (body class static + zero colour
  literals in the block) before trusting it.

## Do differently next time
- Establish the lint/licence/test baseline on a pristine tree FIRST, before writing any code.
  It converts "the gate is red, is it me?" from a panic into a one-line comparison.
- When a plan says "add a type to a union", grep for every `Array<ThatType>` annotation in the
  call sites before building — it saves a 6-minute build round-trip per missed site.
