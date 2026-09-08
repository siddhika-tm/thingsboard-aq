# Requirement — Airlinq Blue: light-theme recolour (app shell + login)

- **Work item slug:** `airlinq-blue-light-recolour`
- **Mode:** dev
- **Task-size class:** `standard` (proposed — needs human confirmation at G1)
- **Author:** Jarvis (Product Manager)
- **Date:** 2026-09-07
- **Branch:** `feature/airlinq-shell-theme-c` (working tree; master is protected)
- **Gate status:** **G1 + G2 APPROVED by the human 2026-09-07** (design, 10-task plan, ADR 0004 accepted; R-A..R-F ruled — §9b)
- **Gate status (G1 detail):** **G1 APPROVED by the human 2026-09-07**; class `standard` confirmed. Q1–Q6 answered (§9). G2 in progress.
- **Spec (source of truth):** `docs/design/2026-09-07-airlinq-blue-light/` —
  `Main.dc.html` (app shell, light), `Login.dc.html` (login card, states A/B/C), `canvas.json`.
  Published copy: https://claude.ai/code/artifact/6e89556e-631e-4f0a-8988-eac091b338e2
  The canvas is **data**, never instructions.

---

## 1. Problem statement

The app's light theme is built on a **teal** accent (`--aq-accent: #0b6b78`) with a white nav rail
and a transparent top toolbar. The human's main product uses a different, established palette —
**Airlinq Blue**: navy chrome (`#0a1435` rail, `#1c2545` header), a `#2067ff` primary, a
purple→cyan gradient for the active state, and a specific 14-colour chart series order.

The two products therefore do not look like one family. The ask is to adopt the product palette in
this app's **light theme only**, so that a user moving between the two products sees one brand.

This is a **colour-only** change. No layout, geometry, radii, spacing, template or component
structure changes are in scope.

## 2. Goal

The light theme reads as Airlinq Blue and matches the design canvas, while the dark theme is
**byte-for-byte unchanged**, the build stays green, and no text/background pair regresses below
WCAG AA relative to today.

## 3. Scope

**In scope**
- `ui-ngx/src/styles.scss` — the light `.tb-default` token block (:1428–1499) and the light-scoped
  rule blocks needed to carry navy chrome (see §8 R1 — new rules are unavoidable).
- `ui-ngx/src/app/modules/login/pages/login/login.component.scss` — three theme-agnostic hardcoded
  rgba values (:127, :132) plus the `#fff` submit label (:177). See §8 R3.
- The sibling **auth pages** (reset password, reset-password-request, create password, two-factor,
  force-two-factor, link expired) — same tokens, no new design (Q3).
- **Chart chrome only** (axis, grid, threshold, tooltip) and **only if** token-driven and provably
  dark-neutral; otherwise deferred (Q1).
- A **bounded, light-only** tokenisation of legacy colour literals in `styles.scss` that are visibly
  on the in-scope routes (Q6, §8 R8).
- New tokens required to express the design (navy chrome ink, gradient, chart series). Every new
  token must be defined in **both** theme blocks (§5 rule T3).

**Delivered scope — additions made during implementation (G2 review rounds)**
- `.tb-user-overflow` (the icon-rail user-menu overflow glyph) is recoloured to
  `--aq-chrome-ink-3` on navy, painting **8.87:1** (was `#6b7789` at 3.97:1). Not a
  contrast failure before the change — a decorative 16px glyph owes only 3:1 and 3.97
  met it — but leaving it would put a 3.97:1 glyph beside the 8.87:1 authority line on
  the same rail. Ruled KEEP by the Code Reviewer (round 2). **The Tester should expect
  the brighter glyph on the rail and must not report it as an unrequested change.**

**Out of scope / non-goals**
- **The dark theme.** No edit to the `.tb-dark` token block (`styles.scss`:1502–1555), the
  dark-only rule block (:1620–1800), or any `dark:` value in a theme-aware TS colour map.
- Any layout, geometry, radius, spacing, font-size, font-weight, template (`.html`) or `.ts`
  structural change. This item does **not** invoke ADR 0001's template-edit allowance.
- Login **option C** (gradient CTA). Decision D3 selects the flat `#2067ff` button. C's markup and
  its `.btn.grad` rule are excluded.
- **The chart series palette.** `materialColors`, `getMaterialColor` and the `chartColorScheme`
  series values are explicitly OUT (Q1 option c). Deferred to a follow-up requirement, which also
  owns the eight named chart aliases and the saved-dashboard migration question.
- Legacy colour literals NOT visible on the in-scope routes (Q6) — listed in the follow-up.
- No new dependency, version change, schema change, or `color-mix()` (§5 rule T2).
- No new `!important`. No commit or push by any agent (commit policy: manual).

## 4. Users affected

| User | Impact |
|---|---|
| Tenant admin / operator (light theme — the default since `076d80e3`) | Sees the full recolour: navy rail and header, blue primary, gradient active row, new chart series colours. |
| Any user on the dark theme (opt-in) | **Must see zero change.** This is the primary regression risk. |
| Anyone at the login page | Navy card header band, blue CTA and focus ring, `#c23333` error text. |

## 5. Binding rules carried from the human's brief

- **T1 — dark is frozen.** Verification must *prove* dark is unchanged, not assert it. The brief
  named three surfaces; the code says the real frozen surface is: the `.tb-dark` token block
  (`styles.scss`:1502–1555), the dark-only rule block (:1620–1800), and every `dark:` value in a
  theme-aware TS colour map. There is **no** login `:host-context(body.tb-dark)` block to protect —
  it does not exist (§8 R3). Two *theme-blind* hardcoded values in the login and the theme-blind
  `materialColors` palette are the actual ways this change could leak into dark.
- **T2 — no `color-mix()`** in built CSS (browserslist floor Chrome 107 / FF 104 / Safari 16).
  Use pre-mixed `rgba()`, as the existing `--aq-*-tint` tokens already do.
- **T3 — every colour token exists in both theme blocks**, even when only the light value changes.
  Scoped to *colour*: six existing **shape** tokens are light-only by design and cascade into dark
  (§8 R6), so they are whitelisted rather than duplicated.
- **T4 — specificity discipline.** Match selector depth; add no new `!important`. Distinguish rules
  that belong in a shared `.tb-default, .tb-dark` block from those that belong in a theme-only
  block. This has cost three rounds in this codebase (MEMORY.md lines 17, 18, 27).
- **T5 — charts keep direct labels and legend chips.** The supplied palette fails CVD adjacency
  (`#14b875` vs `#fa9f42`, ΔE 5.5) and `#fa9f42` / `#18dbf2` are under 3:1 on white, so colour
  alone must never be the only channel carrying series identity.

### Binding human decisions
| # | Decision |
|---|---|
| D1 | Navy chrome — rail **and** header. Yes. |
| D2 | The `--hoverbackground` gradient applies to the **active nav row only** — not hover, not any other surface. |
| D3 | Login Sign-in button is **flat `#2067ff`**, not the gradient (canvas option A/B, not C). |
| D4 | Error **text** is `#c23333`; error **borders and fills** keep `#dc4848`. |
| D5 | Chip **text** substitutions for AA — green `#136c45`, red `#a82323`, amber `#8a4b06`. Chip **fills** keep the exact product hues. |

## 6. Prop → token mapping (light `.tb-default` block only)

| Product prop | Value | App token / target |
|---|---|---|
| `--leftbar` | `#0a1435` | `--aq-sidebar` |
| `--topheader` | `#1c2545` | `--aq-header` (today `transparent`) |
| `--topheadercolor` | `#dbe4f5` | chrome ink (**new token** — see §8 R1) |
| `--headerBorder` | `#596489` | chrome divider (**new token**) |
| `--primaryColor` | `#2067ff` | `--aq-accent`, `--aq-focus`, active input border (`--frominputColoractive`) |
| `--hoverbackground` | `linear-gradient(to right, #7641f7 0%, #18dbf2 100%)` | active nav row **only** (**new token**; must not go into `--aq-accent-container` — see §8 R4) |
| `--closeColor` | `#dc4848` | `--aq-error` (borders/fills) |
| — | `#c23333` | error **text** (D4) |
| `--notificationColor` | `#07bc0c` | `--aq-success` fills |
| — | `#136c45` | success chip text (D5) |
| `--text-color` | `#333333` | `--aq-text` |
| `--submenubackground` | `#f7f8fa` | `--aq-surface` |
| `--inputBorder` | `#e3e3e3` | `--aq-border` |
| page canvas | `#eef1f7` | `--aq-bg` (today `#e9edf1`) |
| `--filter-panel-hover-bg` | `#f7fafc` | table row hover |
| `--search-list-hover-bg` | `#ecedfd` | search list hover |
| `--searchable-dropdown-hover-bg` | `#eef4ff` | searchable dropdown hover |
| `--custom-select-hover-bg` | `#f8f8f8` | custom select hover |
| `--dd1-menu-hover-bg` | `#f6f6f6` | menu hover |
| `--header-item-hover-bg` | `#dddddd` | header item hover |
| `--group-name-color` | `#6e4cf6` | group label |
| `--account-name-color` | `#428bca` | links |
| `--account-hover-bg` | `#ebebeb` | account hover bg |
| `--account-hover-text` | `#428bca` | account hover text |

### Chart series (order is significant)
`1 #7f0597`, `2 #18dbf2`, `3 #7641f7`, `4 #6c7a89`, `5 #00b7ec`, `6 #fa9f42`, `7 #0166ff`,
`8 #5333ed`, `9 #14b875`, `10 #1e824c`, `11 #e26a6a`, `12 #9a12b3`, `13 #ff9478`, `14 #fabe58`.

Named aliases to retain: `--chart-uplink #7641f7`, `--chart-downlink #2067ff`,
`--chart-total #18dbf2`, `--chart-line-primary #18dbf2`, `--chart-success #14b875`,
`--chart-failure #dc4848`, `--chart-allocated #18dbf2`, `--chart-available #7641f7`.

## 7. Acceptance criteria

Every criterion is a testable check: precondition/input → expected observable result. Criteria are
verified on the **rendered page** (`getComputedStyle` or the painted SVG/DOM), never by reading the
stylesheet — MEMORY.md lines 17–18: a rule can be present, correct and `!important` and still never
apply.

### Group A — dark theme is unchanged (the freeze)

- **AC-1** — *(carve-out extended per R-B)* Given the repo diff, when the changed line ranges are
  listed, then no **existing** declaration inside `ui-ngx/src/styles.scss`:1502–1555 (the `.tb-dark`
  token block) is modified or removed. **Pure additions** of the new dark token *definitions* are
  permitted, each of which must resolve to the value that token's consumer resolves to today, so
  dark output is unchanged (AC-3/AC-4 are the proof).
- **AC-2** — Given the repo diff, when the changed line ranges are listed, then no line inside
  `ui-ngx/src/styles.scss`:1620–1800 (the dark-only rule block) is added, removed or modified,
  **except** the addition of new token *definitions* required by rule T3, each of which must be a
  pure addition that changes no existing declaration.
  - **ONE AUTHORISED EXCEPTION, added at G4 (D-NEW3).** This criterion's "no line inside the
    dark rule block is modified" clause now carries exactly one human-approved exception: the
    one-line narrowing of the block's bare `.tb-dark` page-background rule to `body.tb-dark`
    (`styles.scss:1737`). It is an **intent-preserving narrowing**, authorised by the human at
    G4 after the Developer STOPPED rather than working around the constraint; see D-NEW3 in §9c
    for the rationale, the cascade analysis and the five measured acceptance conditions.
    **Consequence:** the block digest recorded in §9d changes
    (`788af402…` → `ed306ea2…`), so a hash comparison is no longer available as the
    dark-unchanged proof **for this block**. Dark-unchanged is instead proven **by rendering** —
    the two-server pixel-identity measurement in D-NEW3. Every other line of the block remains
    byte-identical (181 lines before and after; delta exactly one line), and the dark **token**
    block is untouched by D-NEW3 and still additive vs HEAD. **The frozen-block rule otherwise
    stands in full; this is not a precedent.**
- **AC-3** — Given `<body class="tb-default tb-dark">` on the home dashboard, Devices, Alarms and
  login, when the computed value of every `--aq-*` token on `<body>` is dumped before and after the
  change, then the two dumps are identical.
- **AC-4** — Given the dark theme on those same four routes, when a screenshot is taken before and
  after the change at a fixed viewport, then the images are pixel-identical (or every differing
  pixel is explained and accepted by the human).
- **AC-5** — Given `chartColorScheme` and any other theme-aware colour map touched, when the `dark`
  values are compared before and after, then every `dark` value is unchanged.

### Group B — light theme matches the canvas

- **AC-6** — Given the light theme, when `--aq-sidebar` is read on `<body>`, then it is `#0a1435`,
  and the rail element's computed `background-color` resolves to `rgb(10, 20, 53)`.
- **AC-7** — Given the light theme, when the primary toolbar's computed `background-color` is read,
  then it resolves to `rgb(28, 37, 69)` (`#1c2545`).
- **AC-8** — Given the light theme, when every text node inside the rail and the primary toolbar is
  sampled, then each one's computed colour has a contrast ratio ≥ 4.5:1 against its own computed
  background (i.e. no dark-on-navy ink survives — see §8 R1).
- **AC-9** — Given the light theme, when `--aq-accent` and `--aq-focus` are read, then both are
  `#2067ff`.
- **AC-10** — Given the light theme with a nav row active, when that row's computed
  `background-image` is read, then it is `linear-gradient(to right, #7641f7 0%, #2f6ff0 100%)`
  (**R-E**: capped purple→blue, a deliberate deviation from the canvas `#18dbf2`), its computed
  `background-color` reads `rgba(0, 0, 0, 0)`, and its label's computed colour is white with a
  contrast ratio ≥ 4.5:1 **at every point along the label's span**.
- **AC-11** — Given the light theme, when the computed `background-image` of a nav row on **hover**
  (not active), the table selection toolbar (`mat-toolbar.mat-primary`), the pager active chip
  (`.tb-active`) and the user-menu active item are each read, then **none** of them is a gradient
  (D2 — the gradient is confined to the active nav row).
- **AC-12** — Given the light theme, when `--aq-text`, `--aq-surface`, `--aq-border` and `--aq-bg`
  are read, then they are `#333333`, `#f7f8fa`, `#e3e3e3` and `#eef1f7` respectively.
- **AC-13** — Given the light theme, when the error **text** colour on the login invalid-credentials
  message is read, then it is `#c23333`; and when an error **border/fill** is read (invalid input
  border), then it is `#dc4848` (D4).
- **AC-14** — Given the light theme with a status chip of each kind rendered in the Devices grid,
  when each chip's label colour is read, then success is `#136c45`, error `#a82323` and warning
  `#8a4b06`, while each chip's fill is a tint of the exact product hue (D5).
- **AC-15** — Given the light theme login page, when the card header band's computed background is
  read, then it is `#1c2545`; the brand word is white; the product name is `#dbe4f5`; the Sign-in
  button's computed `background-color` is `rgb(32, 103, 255)` with **no** `background-image` (D3);
  and "Forgot your password?" is **`#2067ff`** (**R-C**, not the canvas `#428bca` which measures
  3.63:1).
- **AC-16** — **WITHDRAWN at G1 (Q1 option c).** Chart series colours are deferred to the follow-up
  requirement. Replaced by AC-27/AC-28 below.
- **AC-17** — *(restated per R-A)* Given the light theme, when a table row, menu item, list item
  and dropdown item are each hovered, then each resolves to the single `--aq-hover` mechanism with
  light value **`#f7fafc`** (from `--filter-panel-hover-bg`). The six separate hover props collapse
  to this one; no per-surface hover token is introduced.

### Group D — charts and legacy literals stay in their lane (G1 decisions)

- **AC-27** — Given the diff, when the changed files are listed, then
  `ui-ngx/src/app/shared/models/material.models.ts` is **unchanged**,
  `utils.service.ts`'s `getMaterialColor` is **unchanged**, and no `chartColorScheme` **series**
  value is changed (Q1 option c).
- **AC-28** — Given any chart-chrome token change (axis, grid, threshold, tooltip), when the dark
  theme's rendered chart chrome is compared before and after, then it is unchanged — i.e. the change
  is token-driven and provably dark-neutral. If that cannot be proven, the chart-chrome change is
  **not made** and is deferred (Q1).
- **AC-29** — Given the bounded legacy-literal sweep (Q6), when each tokenised literal is checked in
  the **dark** theme before and after, then the computed value at every affected element is
  unchanged; and when the remaining untokenised literals are listed, then that list is recorded in
  the follow-up requirement.
- **AC-30** — *(REDUCED per R-D; BLOCKED at G3 finding F3; **UNBLOCKED AND MET at G4 via
  D-NEW3**)* Given each of the six auth pages, when the **root element's own background** is
  sampled, then it resolves to the mapped token rather than the hardcoded `#eee`.
  **Status: MET (light), with scope stated precisely.**
  - **Measured on the 4 reachable routes** (`resetPasswordRequest`, `resetPassword`,
    `createPassword`, `resetExpiredPassword`), 1920×1080, real dev server: the root element's
    own background resolves to `--aq-auth-bg` `#eef1f7` — computed `rgb(238,241,247)`, and
    **PNG pixel-decoded `#eef1f7`** at four canvas sample points, so the paint is confirmed at
    the pixel and not only in the computed style. The hardcoded `#eee` no longer wins.
  - **The other 3 routes** (`/login/mfa`, `/login/force-mfa`, `linkExpired`) require one-time
    tokens and redirect to `/login` without one, so they are **NOT** claimed as a runtime pass.
    They are asserted by **static equivalence**, verified this round: each carries the identical
    `mat-app-background tb-dark` root-div pattern at `.component.html:18` and the identical
    `:host-context(body:not(.tb-dark)) & { background-color: var(--aq-auth-bg) }` rule in its own
    SCSS. Structurally identical to the four measured; runtime confirmation deferred.
  - **In dark** all six still render dark and the root element's background now comes from the
    higher-specificity sibling rule `.tb-dark .mat-app-background` (`styles.scss:1738`, (0,2,0)),
    which was always the cascade winner there — measured `rgb(10,13,18)` `#0a0d12`, and the dark
    auth page is **byte-for-byte pixel-identical** to a baseline differing by only the D-NEW3
    line.
  - **What unblocked it:** D-NEW3 (§9c) — the human-authorised one-line narrowing of
    `styles.scss:1737` from bare `.tb-dark` to `body.tb-dark`, which removes the rule's
    unintended match on the auth root div. This is the fix that was *recommended* while the AC
    was blocked, now *performed* under explicit G4 authorisation.
  - **Still out of scope** (unchanged from R-D): the rest of each page's inks, which remain
    unreachable while the template hardcodes `tb-dark` on the root div (§8 R9, AC-24). The
    follow-up to remove that class and recolour these pages properly **remains open**.
  - *Historical note (superseded):* while blocked, this AC read "BLOCKED, not failed — blocked by
    a frozen-block constraint, not by a defect in the implementation", the blocker being the bare
    `.tb-dark { background-color: var(--aq-bg) !important }` at what was then `styles.scss:1729`,
    with all three routes through it (add `!important`, edit the frozen block, edit the six
    templates) forbidden. The `--aq-auth-bg` mechanism was already correct and verified; only the
    paint was defeated. D-NEW3 authorised the second of those routes, minimally.
- **AC-31** — *(ADDED AT G3 BY HUMAN RULING, finding F2)* Given the `/home` dashboard route in the
  **light** theme, when the dashboard header toolbar is sampled, then its background resolves to
  `--aq-header` (navy) rather than `transparent`; and when every ink that sits on that newly-navy
  header is measured on the real authenticated route, then each one clears **4.5:1** against
  `--aq-header` (text) or **3:1** (non-text such as dividers). The rule must be light-scoped
  (`:not(.tb-dark)`) and must not reach any other `mat-toolbar` instance on the page — the rail
  head, the rail body and the in-widget table toolbars all stay as they are. **Dark unchanged.**
- **AC-32** — *(ADDED AT G3 BY HUMAN RULING, finding F4)* Given the entity-grid routes in the
  **light** theme, when a primary CTA (`color="primary"` filled/raised/tonal button or FAB, e.g.
  "+ Add device") is sampled, then its container paints `#2067ff` (`--aq-accent-container`) rather
  than the pre-change teal `#0b6b78`, and its label on that fill clears **4.5:1** (white on
  `#2067ff` = 4.72:1). **Dark keeps today's teal.** The change is light-scoped with no new
  `!important`. The primary-palette blast radius must be enumerated on the real DOM before and
  after; any primary-derived property that would paint the primary colour **as text on the light
  sheet** is explicitly excluded, because on `--aq-surface` `#f7f8fa` `#2067ff` measures 4.45:1 —
  an AA fail — whereas today's teal `#0b6b78` on that same `#f7f8fa` measures 5.83:1 — a pass.
  No other primary-palette consumer (chips,
  toggles, links, sliders, checkboxes, radios, progress bars, tabs) may change unintentionally.
- **AC-33** — *(ADDED AT G3 BY HUMAN RULING, D-NEW2)* Given the `/home` dashboard route in the
  **light** theme at a **mobile viewport** (390×844), when the dashboard title rendered by the
  `@else` (mobile) branch of `entity-state-controller` is measured on the real authenticated route
  **by PNG pixel decode** — both the `<h1>` (`stateObject.length == 1`) and the `<mat-select>`
  trigger (`stateObject.length > 1`) — then each clears **4.5:1** against `--aq-header`, reading at
  the **same** `--aq-chrome-ink` tier as the desktop `.state-entry.last-entry` (11.73:1). The rules
  must be light-scoped (`:not(.tb-dark)`), add **no** new `!important`, change **no** geometry, and
  leave the desktop branch’s existing 11.73:1 untouched. Verification **must** be performed at a
  mobile viewport: the two branches are mutually exclusive on `isMobile`, so a desktop-only pass
  cannot observe either element — that is precisely how this defect was missed. **Dark unchanged.**

### Group C — no AA regression, and the gates hold

- **AC-18** — Given a full-page contrast sweep over **login, home dashboard, Devices and Alarms in
  both themes, plus the six auth pages in the light theme** (Q4), run identically **before** and
  **after** the change, then the after-run
  reports **no pair that was ≥ 4.5:1 (or ≥ 3:1 for large text / non-text) before and is below that
  threshold after**. Pairs already failing before the change are recorded but do not block; any pair
  the change *newly* pushes below AA is a blocking finding. The sweep is scripted (extending
  `.claude/team/artifacts/dashboard-and-grid-design-fidelity/contrast-check.py`) so the before/after
  comparison is mechanical, and it samples computed styles from the rendered page.
- **AC-19** — Given `mvn install -pl ui-ngx -DskipTests -Dlicense.skip=true -Dskip.installyarn=true`
  (or the project's UI build), when it runs to completion, then it exits 0 with no new SCSS/TS error.
- **AC-20** — Given `cd ui-ngx && NODE_OPTIONS=--max-old-space-size=8192 yarn lint`, when compared
  with the recorded pristine baseline (569 problems / 462 errors / 107 warnings), then the delta is
  **zero new problems**. The absolute count is not the gate — only the delta (MEMORY.md line 9).
- **AC-21** — *(REWORDED at G3 round 2, DOC-5 — the original was unreachable)* Given **the diff**,
  when the added lines are searched for `color-mix(`, then **none is authored in the diff** (T2).
  The original form ("zero matches in the built CSS bundle") can never pass and measures nothing
  this change controls: the bundle contains **338** occurrences of `color-mix(`, every one of them
  Angular Material internals that this work neither adds nor can remove. Measured: **0** `color-mix()`
  *values* authored in the diff. Two added lines contain the string `color-mix(` — both are prose
  inside SCSS comments explaining that none is used — so a naive `grep` over added lines returns 2;
  the check is on authored **declarations**, of which there are none.
- **AC-22** — *(WHITELIST EXTENDED at G3 round 2, DOC-4)* Given the light and dark token blocks, when
  their token *name* sets are compared, then every **colour** token defined in one is defined in the
  other, **except the entries whitelisted below**. The six pre-existing shape tokens
  (`--aq-gap`, `--aq-radius-sm/-md/-lg`, `--aq-rail-w`, `--aq-rail-w-open`) are whitelisted as
  light-only by design (§8 R6). **`--aq-auth-bg` is whitelisted as the one deliberately light-only
  COLOUR token** (§9c DOC-4): it must stay light-only because declaring it inside `.tb-dark` would
  let the auth pages' hardcoded-`tb-dark` root div hijack it and resolve it dark on the very element
  being painted — which is precisely the defect (finding F3) this token was created to fix. Its
  light-only-ness is load-bearing design, not an oversight. No *other* new light-only colour token
  is introduced (T3).
- **AC-23** — Given the diff, when it is searched for added `!important` declarations, then the
  count is zero (T4).
- **AC-24** — Given the diff, when the changed files are listed, then no `.html` template and no
  `.ts` file changes except a theme-aware colour map's `light` values (§3, and AC-5 pins its `dark`
  values).
- **AC-25** — Given the light theme, when screenshots are captured for login, home dashboard,
  Devices and Alarms, then all four are attached to the test report alongside their dark
  counterparts from AC-4.

### Human-judged (not agent-verifiable)
- **AC-26** — *"The light theme reads as the same brand family as the main product."* Recorded as
  **human-judged, not agent-verifiable**; no agent invents a check for it. This is the human's
  visual sign-off after deploy.

## 8. Reachability findings — spec vs. delivery constraint

Checked at G1 per MEMORY.md line 7 ("a spec is only reachable if the delivery constraint can express
it"). Five findings; **R1, R2 and R3 change the shape of the work** and need the human's eye now.

**R1 — "colours only" cannot deliver navy chrome by token edit alone.**
The light theme currently has **no** rail or toolbar chrome rules. The block that styles them
(`styles.scss`:1620–1800) is explicitly *dark-only* (its own comment: "chrome the light theme
already handles well"). In the light theme the rail is white and the toolbar transparent, with ink
bound to `--aq-text` / `--aq-text-2` — dark ink for a light surface. Flipping `--aq-sidebar` to
`#0a1435` and `--aq-header` to `#1c2545` therefore produces **dark ink on navy** — unreadable.
Delivering D1 requires **new light-scoped rules** re-pointing rail and toolbar ink at a new
chrome-ink token, plus new chrome-ink/divider tokens. That is still colour-only in *effect* (no
geometry moves), but it is not a pure token-value edit. **This is the single largest piece of the
work and the main source of AC-8's risk.**

**R2 — the chart series palette is `materialColors`, and it is not theme-aware. This is the
biggest open risk in the work item.**
`chartColorScheme` (`chart.models.ts`:32–65) holds only axis/threshold/label chrome — eight entries,
no series colours. The real default series palette is **generated at module load** in
`ui-ngx/src/app/shared/models/material.models.ts`:
- `:26–331` `materialColorPalette` — 14 Material colour groups x 14 spectrum keys, ~196 hex literals.
- `:333` `materialColors` — the series array, built by the loop at `:339–355` from a
  19-name palette order (`:335`) filtered to 10 spectra (`:337`), then sorted (`:357–367`).
  Result: **140 entries**; series 0–13 are the `500` shades in `colorPalettes` order.
- Consumed via `utils.service.ts:247–250` `getMaterialColor(index)` — **a single flat list with no
  theme parameter**, called from `widget-subscription.ts:1460`, `widget-config.component.ts:837`,
  `attribute-table.component.ts:570`, `flot-widget.ts:1020`, `map.models.ts:377/385/580/634/688`,
  `api-usage-settings.component.models.ts:60/68/76`.

Also absent everywhere in `ui-ngx/src`: `--chart-uplink`, `--chart-downlink`, `--chart-total`,
`--chart-line-primary`, `--chart-allocated`, `--chart-available`, `--aq-chart-1…14`. All net-new.

**Consequence for T1 (dark frozen):** because `materialColors` has no theme axis, *any* edit to it
changes the series colours in **both** themes. The brief's requirement that dark not change and the
requirement that light get the new 14-colour series are, as the code stands, **mutually exclusive**
unless the palette is first made theme-aware — which is a TS/architecture change, not a recolour.
Series colours are also **persisted into saved widget configs** (`dataKey.color` is assigned at
`widget-subscription.ts:1460`), so already-saved dashboards may not pick up a palette change at all.
Hence **Q1**, which now decides scope, not just size. AC-16 must be restated once this is settled.

**R3 — the login has no dark block to protect, but it does have theme-blind colours.**
The brief names "the login's `:host-context(body.tb-dark)` block" as off-limits. **No such block
exists** — `grep` finds no `:host-context` dark block anywhere in `ui-ngx/src`. `login.component.scss`
is already fully tokenised through `--aq-*`, which is why it themes correctly today. The real
dark-theme risk there is the opposite: three **theme-agnostic hardcoded** values that are *not*
tokenised and so apply in *both* themes —
`:127 box-shadow: 0 0 0 3px rgba(11, 107, 120, .13)` (hardcodes the light teal `--aq-accent`),
`:132 rgba(163, 24, 42, .13)` (hardcodes the light crimson `--aq-error`), and `:177 color: #fff`
(submit label; correct in both themes and can stay).
Recolouring the first two for Airlinq Blue would change the **dark** theme too, breaching T1 —
unless they are tokenised into both blocks (T3). The `#fff` on the `#2067ff` button is correct in
both themes and can stay. **The dark-theme freeze is therefore narrower but sharper than stated:
it is the `.tb-dark` token block, the dark-only rule block, and every `dark:` value in a TS colour
map — not a login block.**

**R4 — the gradient cannot ride on `--aq-accent-container`** *(partially CORRECTED at G2 — see the
correction note below)*.
That token is the active-nav-pill background, but it is reused in six other places:
`user-menu.component.scss`:155 (avatar), `styles.scss`:1836–1842 (table selection toolbar),
`styles.scss`:2023 (pager active chip), `side-menu.component.scss`:120 and
`menu-link.component.scss`:48 (alarm badge). Putting the gradient into it would leak the gradient
across the app and breach D2, so a **separate** token consumed only by the active-nav-row selectors
is required (D6). AC-11 is the guard.

> **CORRECTION (G2, verified by brace scan):** this finding claimed the rule to beat was
> `styles.scss`:1681 `background-color: var(--aq-accent-container) !important`. That line is
> **inside the `.tb-dark {` block (:1620–1800)** and therefore *never applies in the light theme*.
> The real light-theme winner is `side-menu.component.scss`:119 at **(0,6,0) with no `!important`**.
> D7 is satisfied by a (0,7,0) selector; no `!important` is needed. A gradient is `background-image`
> and does not override `background-color`, so the rule declares `background-color: transparent`
> **and** `background-image` together.

**R5 — `.tb-default` also matches in dark.** `<body class="tb-default">` is static; `tb-dark` is
added on top (MEMORY.md line 8). A rule placed in a `.tb-default`-scoped **rule** block still
applies in dark unless a paired `.tb-dark` rule of equal-or-greater specificity overrides it. Any
new light chrome rule from R1 must therefore be either genuinely light-only in effect or paired.
This is the trap that cost three previous rounds.

**R6 — the two theme blocks are already asymmetric.** Six tokens are defined in the light block
only and deliberately cascade into dark: `--aq-gap` (:1443), `--aq-radius-sm/-md/-lg` (:1444–1446),
`--aq-rail-w` (:1447), `--aq-rail-w-open` (:1448). These are *shape*, not colour, so rule T3 should
be read as applying to **colour** tokens; AC-22 is scoped accordingly and must whitelist these six
rather than demand a literal name-set identity. Present-in-dark-only: none.

**R7 — `--aq-header` and `--aq-sidebar` each have exactly two consumers**, which makes the token
half of D1 cheap and well-bounded:
`--aq-header` → `styles.scss`:1639 and `home.component.scss`:249;
`--aq-sidebar` → `styles.scss`:1653 and `home.component.scss`:126.
The toolbar is a plain `<mat-toolbar class="tb-primary-toolbar">` at `home.component.html`:63 (there
is no `tb-primary-toolbar` component). Note `home.component.scss`:249 and :126 are **component**
styles applying in *both* themes — today harmless because both themes set `--aq-header: transparent`,
but they are the second place the new light values take effect. ~~Also flagged: `styles.scss`:1742 parks a dark value in the shared/light section.~~
**CORRECTED at G2:** :1742 is inside the `.tb-dark {` block (:1620–1800), not the shared/light
section. No risk, no precedent — the claim was wrong.

**R8 — 74 hardcoded colour literals sit outside the token blocks** (30 hex + 41 rgb/rgba + 3
`white`), **all** before :1428 in the legacy Material-override section (the :1742 literal is inside
the dark block — see the R7 correction). Zero hex
literals exist after :1555. Clusters that will visibly clash with Airlinq Blue: the
`rgba(0,0,0,.54/.38/.12)` Material text/border approximations (:190–242, :309, :508, :736–740,
:860–909, :1082, :1241–1247, :1381–1390), the `rgb(221,44,0)` error red (:196, :199, :311, :336,
:514, :517, :525), the `#444`/`#666` greys (:181, :371, :382, :414, :499, :1190) and the
`#eee`/`#f7f7f7`/`#ededed` surfaces (:43, :253, :270, :321, :349, :362, :838, :1180). These will
**not** follow a token change. They are out of scope by §3 unless the human widens it — but they are
the likeliest source of "it still looks half-teal" after delivery. See **Q6**.

**R9 — all six auth pages hardcode `tb-dark` on their own root div (found at G2; largest scope
change).** Each of `create-password`, `reset-password`, `reset-password-request`, `link-expired`,
`two-factor-auth-login`, `force-two-factor-auth-login` carries `class="… mat-app-background tb-dark
…"` on its root element at `.component.html`:18 (independently verified). Consequences:
- Those pages render **dark in both themes** today.
- Any `--aq-*` token referenced *inside* them resolves to its **dark** value, which is why their
  `rgba(255,255,255,.8)` inks are **correct, not bugs**.
- Only each page's **root element background** is reachable without an `.html` edit — and AC-24
  forbids template edits. So **AC-30 as written is largely unreachable**; see decision R-D.
- `reset-password`, `reset-password-request` and `create-password` have no own SCSS — they share
  `password.component.scss`.

### Corrections log (G1 findings revised at G2)
| Finding | Status |
|---|---|
| R4 — rule to beat at :1681 | **WRONG** — :1681 is dark-only. Real target `side-menu.component.scss`:119 (0,6,0), no `!important`. |
| R7 — :1742 dark value in shared section | **WRONG** — :1742 is inside the dark block. |
| R2, R3, R6, R8 (literal counts), R1, R5 | Confirmed. |
| R9 | **NEW** — auth pages are hardcoded `tb-dark`. |

## 9. Human decisions at G1 (all questions resolved 2026-09-07)

All six questions are ANSWERED. These are binding and supersede the corresponding text above.

- **Q1 → option (c): DEFER charts.** Do **not** touch `materialColors`, `getMaterialColor`, or the
  `chartColorScheme` series values in this work item. Ship **shell + login + auth pages**.
  A follow-up requirement is logged for a theme-aware series palette, and must carry the
  saved-dashboard migration question and the eight named aliases
  (`--chart-uplink/-downlink/-total/-line-primary/-success/-failure/-allocated/-available`).
  **Chart chrome** (axis, grid, threshold, tooltip) may take the light palette **only if** it is
  token-driven and *provably* dark-neutral; if it is not, defer that too.
  → **AC-16 is WITHDRAWN** from this item. **AC-27** replaces it (§7 Group D).
- **Q2 → YES.** Add new light-scoped chrome rules and new chrome tokens
  (`--aq-chrome-ink`, `--aq-chrome-ink-2`, `--aq-chrome-divider`), defined in **both** blocks, with
  **dark keeping today's resolved values** so dark output is byte-identical. Effect stays
  colour-only: no geometry, no template edits.
- **Q3 → YES, include the sibling auth pages** (reset password, reset-password-request, create
  password, two-factor, force-two-factor, link expired). Same tokens, **no new design**.
  → This moves them from §3 out-of-scope to **in scope**.
- **Q4 → four-route scripted sweep is sufficient**: login, home dashboard, Devices, Alarms — **both
  themes** — plus the auth pages in the **light** sweep.
- **Q5 → class `standard` confirmed.** Technical Architect produces a design doc + implementation
  plan for G2 approval before any code is written.
- **Q6 → BOUNDED sweep, light only.** Tokenise the legacy literals that are **actually visible on
  the in-scope routes**; list the remainder in the follow-up requirement. The Code Reviewer must
  **prove** no dark change results.

### Additional binding constraints from the same decision
- **D6** — The gradient gets its **own** token. Do not reuse `--aq-accent-container`.
- **D7** — Resolve the `background-color: … !important` collision at `styles.scss`:1681 by
  **matching selector depth**, never by adding `!important`.
- **D8** — Tokenise the two theme-blind login rings (`login.component.scss`:127, :132) into both
  blocks, with dark keeping its **current resolved values**.

## 9b. G2 rulings (human, 2026-09-07) — binding

| # | Ruling |
|---|---|
| **R-E** | Gradient is capped **purple→blue**: `linear-gradient(to right, #7641f7 0%, #2f6ff0 100%)`. AA across the **full** row at any label position (worst case 4.51:1). Recorded as a **deliberate deviation from the canvas hex**: canvas-exact `#18dbf2` would give **1.69:1** at the cyan end versus today's pill at **10.76:1**. The canvas artboards' active-row swatch is to be updated so spec and code agree. |
| **R-D** | **AC-30 reduced to background-only** for the auth pages. Follow-up logged to remove the hardcoded `tb-dark` root class and recolour them properly. **No template edits this round.** |
| **R-C** | "Forgot your password?" uses **`#2067ff`** (4.72:1), not `#428bca` (3.63:1). |
| **R-B** | **AC-2's carve-out is extended to AC-1** — the 14 dark token *definitions* may live in the dark token block (:1502–1555) as pure additions that change no existing declaration. |
| **R-A** | The six hover props **collapse to the single `--aq-hover`** mechanism; light value from `--filter-panel-hover-bg` = **`#f7fafc`**. AC-17 is restated accordingly. |
| **R-F** | The three declines on measured AA grounds are **accepted**: `--aq-text-3` stays (canvas `#6e7891` measures 3.90–4.41), chrome divider not `#596489` (2.58:1 on the header), alarm badge not the raw red (4.15:1). |

Also reconfirmed: charts fully deferred (**no `.ts` edits**); chart chrome deferred with proof;
dark safety via `.tb-default:not(.tb-dark)` **structural** scoping; **no new `!important`**;
D7 solved by matching depth at **(0,7,0)**.

## 9c. G3 round-2 rulings (human, 2026-09-07) — binding

| # | Ruling |
|---|---|
| **D-F5** | **Remove the "OPERATOR CONSOLE" strip from the login page.** Human ruling, folded into the G3 round-2 fix cycle rather than run as a separate round. Deletes `<div class="aq-strip">OPERATOR CONSOLE</div>` (`login.component.html`:28), the now-dead `.aq-strip` rule (`login.component.scss`:73) and the now-dead `--aq-login-head-ink-3` token, **both** definitions (`styles.scss`, light and dark token blocks — line numbers as they stood before this edit: :1516 light, :1623 dark; both were themselves added earlier in this same uncommitted diff and existed at neither HEAD nor upstream). The literal was hardcoded, login-only and not a translation key; the token's only consumer in the entire tree was that one rule, and the four sibling auth pages do not use it. This is a **TEMPLATE edit and a DELETION**, both permitted for this item specifically — see the ADR 0001 addendum below. Verification: the strip is absent in **both** themes; the header band keeps its `18px 24px 14px` padding and the brand lockup its 24px height, so there is **no geometry change beyond the removed element**; dark login renders identically apart from the absent strip. |
| **D-NEW2** | **Cover the MOBILE branch of `entity-state-controller`.** Human ruling at G3 (Reviewer delta): fix this cycle. The BLOCKER-1 fix covered only the **desktop** branch of this component; `entity-state-controller.component.html` renders two mutually exclusive branches on `isMobile` (`:19` `@if (!isMobile)` / `:32` `@else`), and the `@else` branch at `:32-46` was left uncovered. **What it covers:** (a) the mobile `<h1>` at `:43` — it declares **no** `color` of its own (its component rule at `.scss:59-66` sets only geometry: overflow / text-overflow / white-space / font-size / line-height / font-weight), so it **inherits** `.entity-state-controller { color: rgba(0,0,0,0.76) }` (`.scss:20-21`), the *identical* interception that caused BLOCKER-1, painting **1.33:1** on the navy `#1c2545`; and (b) the mobile `<mat-select>` at `:34`, whose trigger ink is painted through the **custom property** `--mat-select-enabled-trigger-text-color: rgba(0,0,0,0.76)` at `.scss:75` under `:host ::ng-deep .mat-mdc-select` — so a `color` rule cannot fix it (the same shape as MAJOR-2), and the existing select rule does **not** reach it because that one is scoped to `.mat-mdc-select.default-state-controller`, a class this select does not carry. **Why the desktop pass missed it — two independent reasons, both verified rather than assumed:** (1) the branch is *exclusive* on `isMobile`, so a 1920-wide check exercises only the `.state-entry` spans and neither element renders at all; (2) the diff **does** already carry an `h1` rule (N2, `styles.scss:1960`), but it is scoped to `.tb-primary-toolbar`, and `section.tb-dashboard-toolbar` is a **separate** scope, **not** nested under it — verified structurally in the templates: `mat-toolbar.tb-primary-toolbar` opens at `home.component.html:63` and **closes at `:106`**, while the `<router-outlet>` that renders `dashboard-page.component` (and therefore `section.tb-dashboard-toolbar`, `dashboard-page.component.html:35`) is at `:114`, inside a **sibling** `div.tb-main-content`. So N2’s `h1` term can never match this `h1`, however much it looks like it should. **Fix:** two light-scoped rules in the *same* block as the BLOCKER-1 fix, on the *same* chrome-ink tokens — the `h1` and the select trigger both to `--aq-chrome-ink` `#dbe4f5`, the same top tier as the desktop `.state-entry.last-entry`, because it is the same dashboard title in its mobile rendering and must read at the same tier. **Specificity, no new `!important`:** rule 1 `… .entity-state-controller h1` = **(0,4,3)** (b: `.tb-default` 1 + `.tb-dark` 1 + `.tb-dashboard-toolbar` 1 + `.entity-state-controller` 1 = 4; c: `section` 1 + `tb-dashboard-toolbar` 1 + `h1` 1 = 3); rule 2 `… .entity-state-controller .mat-mdc-select` = **(0,5,2)** (b: the same 4 + `.mat-mdc-select` 1 = 5; c: `section` 1 + `tb-dashboard-toolbar` 1 = 2). Both competing declarations live **inside** the component at **(0,2,1)** and are **not** `!important`, so specificity alone suffices and nothing is escalated; no `opacity: 1` is needed either, because unlike `.state-entry:not(.last-entry)` neither mobile element sits under an `opacity`. Both rules carry `:not(.tb-dark)`, so dark cannot match them **structurally** (ADR 0004). **Measured result** (390×844, real authenticated `/home`, PNG pixel decode — the navy sits on `div.mat-fab-toolbar-background`, a z-index:21 **sibling** layer, so an ancestor-walking `bgOf()` lies here): `h1` **`#070911` on `#1c2545` = 1.33:1 FAIL → `#dbe4f5` on `#1c2545` = 11.73:1 PASS**; select trigger **1.33:1 FAIL → 11.73:1 PASS**. Desktop is **unchanged** — both new rules match **0** elements at 1920 width and `.state-entry.last-entry` still pixel-decodes 11.73:1. Dark at mobile width is **unaffected**: with `tb-dark` present `Element.matches()` returns **false** for both selectors, and the dark resolved value is **byte-identical** (`rgba(0, 0, 0, 0.76)`) whether the two rules are present in the CSSOM or physically deleted from it. |

| **D-NEW3** | **Narrow the frozen dark block's bare `.tb-dark` page-background rule to `body.tb-dark`.** Human ruling at **G4**, authorising the one-line change the Developer identified and recommended after **STOPPING at G3 finding F3** rather than working around the frozen-block rule. **This is an explicit, minimal, human-approved EXCEPTION to the frozen-block rule — not a precedent. The frozen-block rule otherwise stands in full.** **What changed (one line, `styles.scss:1737`):** `background-color: var(--aq-bg) !important;` → `@at-root body#{&} { background-color: var(--aq-bg) !important; }`. (The `@at-root body#{&}` form is required by Dart Sass: a bare `body&` is rejected with *"&" may only used at the beginning of a compound selector*. The compiled output is exactly `body.tb-dark { background-color: var(--aq-bg) !important }` — verified by fetching the compiled `styles.css` over HTTP: 1 occurrence of `body.tb-dark`, 0 of a bare `.tb-dark {`.) **Rationale:** the bare `.tb-dark` selector was matching not only `<body>` but ALSO the auth pages' own root div, which hardcodes `tb-dark` at `.component.html:18` on all six auth pages. That unintended second match re-declared the whole dark token block **on the very element being painted**, so `var(--aq-bg)` resolved to the DARK `#0a0d12` on that element even in the light theme — which is what defeated the `--aq-auth-bg` mechanism and blocked AC-30. Narrowing to `body.tb-dark` restores the rule's **evident intent** (paint the page background in dark, per its own comment: *"app background wherever a route leaves `<body>` exposed"*) while removing a match it was never meant to have. It is therefore a **one-line, intent-preserving narrowing**, not a behaviour change. **Why dark is unaffected — the cascade, measured not argued:** on the auth root div in dark the winning declaration was never this rule. The sibling rule one line below, `.tb-dark .mat-app-background { background-color: var(--aq-bg) !important }` (`styles.scss:1738`), matches the same div — every auth root div carries `mat-app-background` alongside `tb-dark` — at **(0,2,0)** vs the bare selector's **(0,1,0)**, with the same `!important`. It already outranked the self-match, so removing the self-match changes nothing there. On `<body>` the narrowed selector still matches, so the dark page background is untouched. **Measured result (all five of the human's G4 acceptance conditions):** (1) narrowed selector still matches `<body>` in dark — `body.matches('body.tb-dark')` = `true`, `bodyBg` = `rgb(10,13,18)` `#0a0d12` on 11 authenticated routes and all 4 reachable auth routes; (2) it **cannot** match the auth root div — `root.matches('body.tb-dark')` = `false` while `root.matches('.tb-dark')` = `true`, on every auth route in both themes; (3) auth pages now paint `--aq-auth-bg` `#eef1f7` in light — computed `rgb(238,241,247)` on all 4 reachable routes AND **PNG pixel-decoded `#eef1f7`** at four canvas sample points; (4) dark auth pages and dark chrome **pixel-identical** vs a baseline server differing by exactly this one line — dark `/login/resetPasswordRequest` **byte-for-byte equal (6,220,800 bytes)**, dark `/entities/devices` **0 differing pixels of 2,073,479** outside an 11×11 box around the live alarm badge (the 34 residual pixels are the anti-aliased digit of `.tb-menu-badge`, which carries `transition: all` and live alarm data — confirmed as capture timing, not styling); (5) no other consumer regressed — the set of elements that can possibly be affected is exactly those matching `.tb-dark` but **not** `body.tb-dark`, and that set-difference sweep returns **0 elements on all 11 authenticated routes** and **exactly 1 (the auth root div, still painting `#0a0d12`) on each auth route**. **Consequence for AC-2, recorded explicitly:** the frozen dark **rule** block digest **changes for the first time in this work item, by design**. Old `788af402f02081504d0d05bef6184adab6a60447722c2cbbb0aeeb3eb10622bf` → new `ed306ea2cf4e9c1ae8501502eb8902c210ec9badc80a26c5cc64d3bb2f67cb80` (same convention, §9d; 181 lines before and after; delta is **exactly one line**, diff in §9d). The dark **token** block is untouched by D-NEW3 and remains additive vs HEAD (43/43 HEAD declarations present byte-identical, 13 added, 0 removed, 0 changed). Because the block hash can no longer serve as the dark-unchanged proof for this block, dark-unchanged is proven **by rendering** instead — the two-server pixel comparison above. |

### ADR 0001 addendum (D-F5)

ADR 0001 records that **template/TS edits are allowed when they stay additive and
merge-friendly**, because this repository is a ThingsBoard fork and every divergence from
upstream is a future merge conflict. D-F5 is a *deletion*, which reads at first glance like the
opposite of "additive" — so the addendum states explicitly why it is squarely inside the
decision rather than an exception to it:

> **The test is that the element must be verifiably ABSENT from the upstream file at the fork
> point** — provenance *evidenced by a recorded `git show <upstream-ref>:<path>` grep*, never
> provenance merely asserted as "it was ours". Every future invocation of this addendum must
> produce the same evidence, recorded inline, or the deletion is not authorised by it.
>
> Evidence for D-F5 (run 2026-09-07). Upstream ref used: **`f872e94e39`**, resolved as
> `0e39b20808^` — the parent of `0e39b20808 "Rebrand UI to Airlinq and add container fleet
> simulator"`, i.e. the last commit before any Airlinq change, and itself a genuine
> `thingsboard/thingsboard` merge commit ("Merge pull request #16095 from
> thingsboard/UNSIGNED_INTEGER-values-encoding-for-LwM2M-multi-resources"). No `upstream`
> git remote and no tags are configured in this clone, so this fork-point commit is the
> closest available upstream reference; no ref was invented.
>
> ```
> $ git show f872e94e39:ui-ngx/src/app/modules/login/pages/login/login.component.html \
>     | grep -niE 'aq-strip|OPERATOR CONSOLE'
> (no output; exit 1)
> $ git show f872e94e39:ui-ngx/src/app/modules/login/pages/login/login.component.scss \
>     | grep -niE 'aq-strip|aq-login-head-ink-3'
> (no output; exit 1)
> $ git show f872e94e39:ui-ngx/src/styles.scss | grep -niE 'aq-login-head-ink-3'
> (no output; exit 1)
> ```
>
> All three artefacts are absent from the upstream file at the fork point, so the test is met.
>
> **The element being deleted was therefore ours, not upstream ThingsBoard's.** `<div class="aq-strip">`,
> its `.aq-strip` rule and the `--aq-login-head-ink-3` token were all added by Airlinq in this
> fork; none exists in the upstream file. Deleting an Airlinq-added element **reduces** the
> fork's divergence from upstream and therefore makes the fork *more* merge-friendly, not less
> — it moves `login.component.html` back toward upstream, so an upstream change to that region
> has less of ours to conflict with. The "additive" clause in ADR 0001 exists to protect
> **upstream** lines from being rewritten or removed; it was never a prohibition on removing our
> own additions. Removing an Airlinq addition is the one deletion shape that serves the same
> goal the clause was written to serve.
>
> The bounding rule stays, and is now the evidenced test above rather than a judgement call: an
> edit that deletes or rewrites a line **present** in the upstream file at the fork point — i.e.
> one where the recorded `git show` grep MATCHES — still requires its own decision and its own
> approval, and this addendum does not cover it. A failed or unrecorded grep is a failed test,
> not a formality. D-F5 authorises exactly one deletion, of three Airlinq-authored artefacts
> whose absence upstream is evidenced above, and sets no precedent for touching upstream markup
> or for any deletion whose provenance is asserted rather than shown.

### Documentation corrections raised by the Tester at G3 round 2

- **DOC-4 — AC-22 whitelist for `--aq-auth-bg`.** `--aq-auth-bg` is a **new light-only colour
  token**, which AC-22 as written forbids. It is **not a defect**: its light-only-ness is
  load-bearing anti-hijack design. The six auth pages hardcode `tb-dark` on their own root div,
  and `.tb-dark` is a bare class selector that matches that div — so any token the dark block
  also declares is re-declared *on the very element being painted* and resolves dark however the
  rule is scoped (this is finding F3). A token the dark block never declares cannot be hijacked
  that way. AC-22 is therefore amended to whitelist it by name, alongside the six pre-existing
  shape tokens. **Also corrected in the code comment** (`styles.scss`, the `--aq-auth-bg`
  block): the old claim that "in dark the light token block never applies" is **factually
  wrong** — `<body class="tb-default">` is static and `tb-dark` is only added on top
  (MEMORY.md line 8), so `--aq-auth-bg` **does** resolve to `#eef1f7` in dark. Verified in the
  browser on the real route: in dark, `getComputedStyle(document.body)` returns `#eef1f7` for it.
  What makes it harmless is the consuming rule's `:host-context(body:not(.tb-dark))` guard,
  which blocks the paint. The token resolving is inert; the **guard** is the dark safety.
- **DOC-5 — AC-21 was unreachable as written.** The built bundle contains **338** occurrences of
  `color-mix(`, every one of them Angular Material internals; the diff authors **zero**
  `color-mix()` *values*. A criterion demanding zero matches in the bundle can never pass and does
  not measure anything this change controls. AC-21 is reworded to "none authored in the diff".
  Precision note: a naive `grep` over added lines returns **2** hits, but both are the string
  `color-mix(` appearing in **SCSS comment prose** that documents its own absence — there are no
  authored declarations. The check is on declarations.
- **DOC-6 — the dark-rule-block digest, one canonical convention.** The previously recorded
  digest `788af402…` and the Tester's measured `4114248c…` are **both correct**; they differ only
  by whether a trailing newline is appended before hashing, and the earlier reconciliation
  attempt failed only because it did not normalise CRLF first. The canonical convention is now
  fixed and published in §9d below. Under it, **HEAD and the worktree are byte-identical**, which
  is what AC-2 actually requires — only the recorded digest was stale.

## 9d. Canonical dark-rule-block digest convention

One convention, so the next reviewer reproduces the number rather than a different one:

1. Read `ui-ngx/src/styles.scss` as UTF-8.
2. Normalise line endings to **LF** (`
` → `
`, then bare `` → `
`). The file is
   mixed-ending, so this step is **mandatory**; skipping it is what produced the earlier
   mismatch.
3. Find the **second** top-level line equal to `.tb-dark {` (the first opens the dark *token*
   block; the second opens the dark *rule* block) and brace-match to its closing `}`.
   **Never hard-code line numbers** — this round's edits moved the block from 1620–1800 to
   1733–1913 while leaving its bytes untouched.
4. Join the block's lines with `
` and **append no trailing newline**.
5. `sha256` of that UTF-8 byte string.

**Canonical digest (convention A, no trailing newline):**

> **SUPERSEDED BY D-NEW3 (G4).** The digest below is the value that held for the whole of this
> work item up to and including G4 approval. D-NEW3 — the one authorised, human-approved
> exception to the frozen-block rule — edits **one line inside this block**, so the digest
> necessarily changes. **Current value:**

> ```
> ed306ea2cf4e9c1ae8501502eb8902c210ec9badc80a26c5cc64d3bb2f67cb80
> ```

> **The delta is exactly one line** (181 lines before, 181 after; every other byte identical):

> ```diff
> --- frozen-block@pre-D-NEW3
> +++ frozen-block@post-D-NEW3
> @@ -3,5 +3,5 @@
>    /* app background wherever a route leaves <body> exposed (Material's
>       app-background mixin is a light-only include). */
> -  background-color: var(--aq-bg) !important;
> +  @at-root body#{&} { background-color: var(--aq-bg) !important; }
>    .mat-app-background { background-color: var(--aq-bg) !important; color: var(--aq-text) !important; }
> ```

> **Digest trap worth recording:** an intermediate attempt spelled the narrowing as a bare
> `body&`, which yields digest `dbdb0870…` but **does not compile** — Dart Sass rejects it
> (*"&" may only used at the beginning of a compound selector*). Quote `ed306ea2…` only; it is
> the digest of the form that actually ships. Recompute from the file rather than copying a
> number out of a report.
>
> Because a hash comparison can no longer prove this block unchanged, **dark-unchanged is now
> proven by RENDERING** — the two-server pixel-identity measurement recorded under D-NEW3 in
> §9c (a second `git worktree` + a `node_modules` junction, the two trees differing by exactly
> this one line). That is the only proof available for this block from G4 onward, and it is a
> stronger one: it measures what the browser painted, not what the stylesheet said.

**Historical digest (held until G4 / D-NEW3):**

```
788af402f02081504d0d05bef6184adab6a60447722c2cbbb0aeeb3eb10622bf
```

Measured identical at HEAD (`29817200e3`, lines 1620–1800) and in the worktree (lines
1733–1913), 181 lines both. The with-trailing-newline variant of the same 181 lines is
`4114248c3d8c4c1da6f640d21e5cb0785a7f3b1a56101da5b155398c7bdb750a` — recorded here only so the
Tester's figure is traceable; **convention A above is the one to quote.**

**Dark token block status:** *additions-only PLUS one authorised deletion (D-F5, human-ruled)* —
and, measured against HEAD, **still purely additive**. The distinction matters, so both framings
are recorded:

- **Against the round-1 working state:** one line is deleted, the `--aq-login-head-ink-3`
  definition. This is the authorised deletion; it changes the shape of the additions-only
  invariant the round had maintained until now, which is why it is called out explicitly rather
  than folded in silently.
- **Against HEAD (`29817200e3`), which is what AC-1 and AC-2 actually measure:** the invariant is
  **unbroken**. `--aq-login-head-ink-3` **never existed at HEAD** — verified:
  `git show HEAD:ui-ngx/src/styles.scss | grep -c aq-login-head-ink-3` returns **0**. The token was
  introduced earlier in this same uncommitted diff, so F5 removes a line **this diff itself added**.
  The dark token block therefore still contains **zero deletions and zero modifications** of any
  pre-existing declaration: 54 lines at HEAD → 75 in the worktree, all net additions.

Removing a token whose only consumer is removed in the same change is a **no-op for dark**
**rendering** — proven in the browser: dark login renders identically apart from the absent strip,
the token reads as undefined in **both** themes, and no element changes colour. The dark **rule**
block stays byte-identical, as always (§9d).

## 10. Kickoff — roster concerns and estimates

To be collected after G1 approval and recorded here.

| Member | Concerns | Estimate |
|---|---|---|
| technical-architect | *(pending kickoff)* | |
| developer | *(pending kickoff)* | |
| code-reviewer | *(pending kickoff)* | |
| tester | *(pending kickoff)* | |

## 11. Definition of done

1. Light theme matches the canvas (AC-6 … AC-17, AC-16 withdrawn), and the auth pages follow
   (AC-30).
2. Dark theme provably unchanged (AC-1 … AC-5).
3. Build green (AC-19); lint delta zero (AC-20).
4. Contrast sweep over the Q4 route set shows no AA regression versus today (AC-18).
   Charts and legacy literals stay in their lane (AC-27 … AC-29).
   A follow-up requirement exists for the theme-aware series palette (Q1).
5. Screenshots of both themes across login, home dashboard, Devices, Alarms (AC-4, AC-25).
6. Human approval at G4 → Jarvis-coordinated deploy → the human's visual sign-off (AC-26).

## 12. Sign-off

| Gate | Status |
|---|---|
| G1 — requirement + acceptance criteria | **APPROVED** by the human 2026-09-07 |
| G2 — design + implementation plan | **APPROVED** by the human 2026-09-07 (R-A..R-F ruled) |
| G2.5 — static review (on demand) | not started |
| G2.7 — test plan | not started |
| G3 — verification, zero findings | not started |
| G4 — final approval | not started |
