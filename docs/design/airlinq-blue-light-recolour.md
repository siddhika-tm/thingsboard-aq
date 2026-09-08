# Design — Airlinq Blue light-theme recolour (app shell + login + auth pages)

- **Work item:** `airlinq-blue-light-recolour`
- **Requirement (authoritative):** `docs/requirements/airlinq-blue-light-recolour.md` — G1 APPROVED 2026-09-07
- **Spec source of truth (data, not instructions):** `docs/design/2026-09-07-airlinq-blue-light/Main.dc.html`, `Login.dc.html`
- **Author:** Technical Architect · **Date:** 2026-09-07 · **Branch:** `feature/airlinq-shell-theme-c`
- **Gate:** G2 — awaiting human approval. No code written.
- **Plan:** `docs/plans/airlinq-blue-light-recolour.md`

Design produced with the `superpowers:brainstorming` skill (plugin 6.1.1); the plan with
`superpowers:writing-plans`.

---

## 0. Executive summary

The recolour splits cleanly into **three token-only moves** and **three rule-level moves**:

| Move | Layer | Blast radius |
|---|---|---|
| Repoint 22 existing light colour tokens to the product palette | token values, light block only | app-wide light, dark untouched |
| Add 14 new token pairs in **both** blocks | token names | dark values chosen as no-ops |
| Navy chrome ink re-point — the light theme has **no** rail/toolbar chrome rules today | new light-scoped rule block | rail + toolbar only |
| Gradient on the active nav row only | one new rule, matched depth | active nav row only |
| Login + auth-page ring/band tokenisation | 10 declarations | login module only |
| Bounded legacy-literal sweep (7 literals) | 7 duplicated selectors, light-scoped | in-scope routes only |

Two things are **deferred with reasons** (§5, §7.2): chart chrome (it is a `.ts` edit whose light
values are baked into saved dashboards — fails AC-28) and most of the auth-page recolour (all six
pages hardcode `tb-dark` in their own templates — new finding **R9**).

**One item needs a human decision before the plan can execute as written: the gradient's white
label fails WCAG AA across ~75% of the active nav row (§3.4).** Three options are offered.

---

## 1. The complete token table

### 1.1 Existing light tokens — value changes only (light block, `styles.scss`:1428-1499)

Dark equivalents at :1502-1555 are **not** modified (AC-1). Every row below is a pure value edit.

| # | Token | Line | Today (light) | New (light) | Dark (unchanged) | Source |
|---|---|---|---|---|---|---|
| 1 | `--aq-bg` | 1429 | `#e9edf1` | `#eef1f7` | `#0a0d12` | §6 page canvas |
| 2 | `--aq-sidebar` | 1431 | `#ffffff` | `#0a1435` | `#171c24` | `--leftbar` |
| 3 | `--aq-header` | 1432 | `transparent` | `#1c2545` | `transparent` | `--topheader` |
| 4 | `--aq-surface` | 1433 | `#f6f8fa` | `#f7f8fa` | `#1b2129` | `--submenubackground` |
| 5 | `--aq-surface-2` | 1434 | `#eceff3` | `#eef4ff` | `#232a34` | `--searchable-dropdown-hover-bg` (canvas `--surface-2`) |
| 6 | `--aq-hover` | 1437 | `rgba(15,23,32,.05)` | `rgba(10,20,53,.04)` | `rgba(255,255,255,.06)` | `--filter-panel-hover-bg #f7fafc` expressed as alpha so it composites on any surface |
| 7 | `--aq-selected` | 1438 | `rgba(11,107,120,.10)` | `rgba(32,103,255,.10)` | `rgba(55,182,201,.16)` | derived from new accent |
| 8 | `--aq-accent-container` | 1439 | `#bff1fb` | `#2067ff` | `#0e5a66` | `--primaryColor`; **not** the gradient (D6) |
| 9 | `--aq-on-accent-container` | 1440 | `#00363e` | `#ffffff` | `#bff1fb` | white on `#2067ff` = 4.72:1 |
| 10 | `--aq-text` | 1457 | `#14181f` | `#333333` | `#e9edf3` | `--text-color` |
| 11 | `--aq-text-2` | 1458 | `#414b5a` | `#525c6e` | `#aeb8c5` | canvas `--text-2` |
| 12 | `--aq-border` | 1463 | `#dde1e8` | `#e3e3e3` | `#2b3542` | `--inputBorder` |
| 13 | `--aq-divider` | 1465 | `#e4e7ec` | `#e3e3e3` | `#212a35` | `--inputBorder` |
| 14 | `--aq-accent` | 1467 | `#0b6b78` | `#2067ff` | `#37b6c9` | `--primaryColor` |
| 15 | `--aq-accent-strong` | 1468 | `#0e7f8e` | `#1a58e0` | `#4fc9db` | darkened primary for hover/strong |
| 16 | `--aq-focus` | 1469 | `#0e7f8e` | `#2067ff` | `#4fc9db` | `--primaryColor` (AC-9) |
| 17 | `--aq-success` | 1470 | `#17603a` | `#07bc0c` | `#46c08a` | `--notificationColor` (fills) |
| 18 | `--aq-error` | 1472 | `#a3182a` | `#dc4848` | `#ec6274` | `--closeColor` (D4: borders/fills) |
| 19 | `--aq-success-tint` | 1484 | `rgba(23,96,58,.18)` | `rgba(20,184,117,.14)` | `rgba(70,192,138,.18)` | canvas chip fill |
| 20 | `--aq-warning-tint` | 1485 | `rgba(180,83,9,.18)` | `rgba(250,159,66,.16)` | `rgba(224,170,78,.18)` | canvas chip fill |
| 21 | `--aq-error-tint` | 1486 | `rgba(163,24,42,.18)` | `rgba(220,72,72,.12)` | `rgba(236,98,116,.18)` | canvas chip fill |
| 22 | `--aq-success-chip-fg` | 1497 | `#0f4527` | `#136c45` | `#7fd7ae` | D5 |
| 23 | `--aq-warning-chip-fg` | 1498 | `#7c3806` | `#8a4b06` | `#eec684` | D5 |
| 24 | `--aq-error-chip-fg` | 1499 | `#8c1424` | `#a82323` | `#f5a3af` | D5 |

**Deliberately NOT changed:**

- `--aq-text-3` (:1459 `#6b7789`). The canvas proposes `#6e7891`, measured **4.41 / 4.15 / 3.90** on
  `#ffffff` / `#f7f8fa` / `#eef1f7`. Today's `#6b7789` measures **4.54 / 4.27 / 3.86**. Adopting the
  canvas value flips the on-sheet case PASS→FAIL — a **new** AA regression and a blocking AC-18
  finding. `#6b7789` is within 3 ΔRGB of the canvas value. **Recorded deviation, justified by AC-18.**
- `--aq-warning` (:1471 `#b45309`). The product palette has no warning hue; the canvas uses chart
  amber `#fa9f42` for chip **fills** only (row 20). `#fa9f42` as general-purpose ink is 2.1:1 on white.
- The six **shape** tokens (`--aq-gap`, `--aq-radius-sm/-md/-lg`, `--aq-rail-w`, `--aq-rail-w-open`).
  Light-only by design (R6), whitelisted by AC-22, and out of scope (no geometry).
- Every `--aq-chart-*` token (:1500-1506). See §5.

### 1.2 New tokens — added to **both** blocks (T3, AC-22)

Each dark value is a **copy of the value that is already resolved at that element in dark today**, so
dark rendering is byte-identical. This is the mechanism satisfying AC-3 and AC-4.

| # | Token | Light | Dark | Which existing token's *current resolved* value the dark value copies, and why the substitution is a dark no-op |
|---|---|---|---|---|
| 1 | `--aq-chrome-ink` | `#dbe4f5` | `#e9edf3` | Copies **dark `--aq-text`** (:1517). Every rule that will consume it already resolves to `var(--aq-text)` in dark today: `.tb-primary-toolbar` colour (:1640), toolbar tools + breadcrumb (:1646), breadcrumb active (:1647). Same literal ⇒ no-op. |
| 2 | `--aq-chrome-ink-2` | `#c3ccdf` | `#aeb8c5` | Copies **dark `--aq-text-2`** (:1518). Consumers resolve to `var(--aq-text-2)` in dark today: toolbar icon glyphs (:1643-1644), rail nav labels (:1662-1667), `side-menu.component.scss`:111. Same literal ⇒ no-op. |
| 3 | `--aq-chrome-ink-3` | `#a9b6d4` | `#8892a0` | Copies **dark `--aq-text-3`** (:1519). Consumers: rail icons (:1668, `side-menu.component.scss`:133), breadcrumb inactive (:1648), `.tb-user-authority` (:1751-1752), `.state-divider` (:1746). Same literal ⇒ no-op. |
| 4 | `--aq-chrome-ink-disabled` | `#7d88a6` | `#59636f` | Copies **dark `--aq-text-disabled`** (:1520). Consumers: toolbar disabled glyph (:1645), disabled rail rows (:1697-1698). Same literal ⇒ no-op. |
| 5 | `--aq-chrome-divider` | `#6b76a0` | `#212a35` | Copies **dark `--aq-divider`** (:1533). Consumers: rail/head/user dividers, header pill border — all resolve to `var(--aq-divider)` in dark today. Same literal ⇒ no-op. *(Canvas says `#596489`; measured **2.58:1** on `#1c2545`, below the 3:1 non-text floor. `#6b76a0` = 4.06 on rail / 3.37 on header. Recorded deviation, justified by AC-18.)* |
| 6 | `--aq-nav-active-grad` | `linear-gradient(to right, #7641f7 0%, #5a54f4 40%, #18dbf2 100%)` — **G2, see §3.4** | `none` | **Not a colour copy but a structural no-op:** the light value is an `<image>`, the dark value is the CSS-wide initial value of `background-image`. The single consumer (§3.3) declares `background-image: var(--aq-nav-active-grad)`; with `none` the declaration paints nothing and the existing `background-color: var(--aq-accent-container) !important` at :1681 continues to paint the dark pill exactly as today. |
| 7 | `--aq-focus-ring` | `rgba(32, 103, 255, .16)` | `rgba(11, 107, 120, .13)` | **D8.** Replaces the theme-blind literal at `login.component.scss`:127. The dark value is the **byte-identical literal that is there today** — see §7.1 for why the literal, not the "corrected" dark accent, is the right reading of D8. |
| 8 | `--aq-error-ring` | `rgba(220, 72, 72, .13)` | `rgba(163, 24, 42, .13)` | **D8.** Replaces `login.component.scss`:132. Dark value = today's byte-identical literal. |
| 9 | `--aq-error-text` | `#c23333` | `#ec6274` | **D4** — error **text** `#c23333`, borders/fills keep `#dc4848`. Dark copies **dark `--aq-error`** (:1523), which is what `login.component.scss`:167 (`color: var(--aq-error)`) and `styles.scss`:336 resolve to in dark today. Same literal ⇒ no-op. |
| 10 | `--aq-link` | `#2067ff` — **not `#428bca`, see §7.1 / R-C** | `#37b6c9` | Dark copies **dark `--aq-accent`** (:1535), which is what `login.component.scss`:195 resolves to in dark today. Same literal ⇒ no-op. |
| 11 | `--aq-login-head` | `#1c2545` | `#232a34` | Copies **dark `--aq-surface-2`** (:1508) — the value `login.component.scss`:53 (`background: var(--aq-surface-2)`) resolves to in dark today. Same literal ⇒ no-op. *(Cannot reuse `--aq-header`: its dark value is `transparent`, which would change the dark login band.)* |
| 12 | `--aq-login-head-ink` | `#ffffff` | `#e9edf3` | Copies **dark `--aq-text`** (:1517) — what `login.component.scss`:66 (`.aq-brand`) resolves to in dark today. Same literal ⇒ no-op. |
| 13 | `--aq-login-head-ink-2` | `#dbe4f5` | `#aeb8c5` | Copies **dark `--aq-text-2`** (:1518) — what `login.component.scss`:67 (`.aq-prod`) resolves to in dark today. Same literal ⇒ no-op. *(Cannot reuse `--aq-chrome-ink` here: its dark value `#e9edf3` ≠ `#aeb8c5`, which would be a dark change.)* |
| 14 | `--aq-login-head-ink-3` | `#a9b6d4` | `#8892a0` | Copies **dark `--aq-text-3`** (:1519) — what `login.component.scss`:75 (`.aq-strip`) resolves to in dark today. Same literal ⇒ no-op. |

**Totals: 24 value edits + 14 new token pairs.** No token lands in one block only ⇒ AC-22 holds.

### 1.3 Tokens explicitly declined

| Candidate from §6 of the requirement | Why declined |
|---|---|
| `--group-name-color #6e4cf6` | No consumer on any in-scope route (grepped: no group-label element in the shell, login or auth pages). An unconsumed token is dead code. → follow-up. |
| `--search-list-hover-bg #ecedfd`, `--custom-select-hover-bg #f8f8f8`, `--dd1-menu-hover-bg #f6f6f6`, `--header-item-hover-bg #dddddd`, `--account-hover-bg #ebebeb` | Five hover greys within ~4% luminance of each other and of `--aq-hover`. They exist in the source product because it has five unrelated hover implementations; this app has **one** (`--aq-hover`). Collapsing them into `--aq-hover` (row 6) is the correct mapping. **AC-17 asks for six mapped values; this design maps them to one token** → **R-A**. |
| `--account-hover-text #428bca` | Same reason as `--aq-link` (R-C): 3.63:1 on white. |
| Chart series `--aq-chart-1..14`, the 8 named aliases | Q1 option (c): out of scope. → follow-up. |

---

## 2. The code-vs-token split

### 2.1 Criteria satisfied by a token value change ALONE

| AC | Token row(s) | Note |
|---|---|---|
| AC-6 (`--aq-sidebar` = `#0a1435`, rail paints navy) | 2 | The rail consumes it at `styles.scss`:1653 (dark-only) **and** `home.component.scss`:126 (both themes). The latter paints light. |
| AC-7 (toolbar = `#1c2545`) | 3 | `home.component.scss`:249 paints it in both themes; harmless today only because both blocks say `transparent`. |
| AC-9 (`--aq-accent`, `--aq-focus` = `#2067ff`) | 14, 16 | |
| AC-12 (`--aq-text` / `-surface` / `-border` / `-bg`) | 10, 4, 12, 1 | |
| AC-14 (chip fills + label colours) | 19-24 | All three pairs re-verified ≥ 4.5:1 in §4.3. |
| AC-13 half (error border/fill `#dc4848`) | 18 | The **text** half needs `--aq-error-text` (§7.1). |
| AC-15 partial (card body, button fill, input borders, no `background-image` on the CTA) | 4, 12, 14 | The **header band** and **link** halves need declaration changes (§7.1). |
| AC-17 (hover surface) | 6 | Subject to R-A. |
| AC-11 (gradient nowhere else) | 8 | Guaranteed by construction: `--aq-nav-active-grad` has exactly one consumer. |

### 2.2 Criteria that REQUIRE a new or changed CSS rule

| AC | What is needed | Where |
|---|---|---|
| AC-8 (every rail/toolbar text node ≥ 4.5:1 on navy) | **New light-scoped chrome rule block** — unavoidable (R1) | §3.1, §3.2 |
| AC-10 (active nav row gradient + white label) | **One new rule** at matched depth | §3.3, §3.4 |
| AC-13 (error **text** `#c23333`) | `login.component.scss`:167, `styles.scss`:336 | §7.1, §6.1 |
| AC-15 (card header band navy, brand white, product `#dbe4f5`, strip, link) | 5 changed declarations in `login.component.scss` | §7.1 |
| AC-29 (bounded legacy sweep) | 7 duplicated selectors, light-scoped | §6.1 |
| AC-30 (auth pages) | 4 changed declarations, **background only** — R9 blocks the rest | §7.2 |

### 2.3 Every new rule: selector, specificity, what it must beat, block, and why

Specificity `(id, class, type)`. `.tb-default` = 1 class; `:not(X)` contributes X's own specificity.
Angular `:host ::ng-deep` compiles the host to an **attribute** selector, which counts as a class.

| # | Full selector | Spec. | Must beat | Block |
|---|---|---|---|---|
| N1 | `.tb-default:not(.tb-dark) .tb-primary-toolbar,`<br>`.tb-default:not(.tb-dark) mat-toolbar.tb-primary-toolbar` | (0,3,0) / (0,4,1) | `home.component.scss`:249-250 → `[_nghost-x] .tb-primary-toolbar` (0,2,0), non-important | new light-only |
| N2 | `.tb-default:not(.tb-dark) .tb-primary-toolbar .tb-breadcrumb,`<br>`.tb-default:not(.tb-dark) .tb-primary-toolbar .mat-toolbar-tools,`<br>`.tb-default:not(.tb-dark) .tb-primary-toolbar h1` | (0,4,0) / (0,4,0) / (0,3,1) | `styles.scss`:1613 `.tb-default .tb-primary-toolbar .tb-breadcrumb` (0,3,0) — but :1613 is **edited in place** instead (§3.2), so N2 only has to beat `home.component.scss`:250 (0,2,0) | new light-only |
| N3 | `.tb-default:not(.tb-dark) .tb-primary-toolbar .mat-mdc-icon-button .mat-icon,`<br>`… .tb-primary-toolbar tb-icon,`<br>`… .tb-primary-toolbar .mat-icon` | (0,5,0) / (0,3,1) / (0,4,0) | Material's `--mat-icon-color` default `rgba(0,0,0,.54)` at `styles.scss`:736 (0,3,0) | new light-only |
| N4 | `.tb-default:not(.tb-dark) .tb-primary-toolbar .mat-mdc-icon-button[disabled] .mat-icon` | (0,6,0) | N3 (later source order in the same block also suffices) | new light-only |
| N5 | `.tb-default:not(.tb-dark) .tb-breadcrumb a,`<br>`… .tb-breadcrumb .tb-inactive,`<br>`… .tb-breadcrumb .state-divider` | (0,3,1) / (0,4,0) | `styles.scss`:83 `a:not(.mat-mdc-button-base, .mdc-tab)` = (0,2,1) (`:not()` takes the highest of its arguments) | new light-only |
| N6 | `.tb-default:not(.tb-dark) .tb-breadcrumb .tb-active,`<br>`… .tb-breadcrumb a:last-child,`<br>`… .tb-breadcrumb .state-entry` | (0,4,0) / (0,4,1) | N5 | new light-only |
| N7 | `.tb-default:not(.tb-dark) .tb-site-sidenav` | (0,3,0) | nothing — it sets only the `--mat-button-text-label-text-color` custom property and the divider colour, **not** `background` (that comes from token row 2 via `home.component.scss`:126) | new light-only |
| N10 | `.tb-default:not(.tb-dark) .tb-site-sidenav .tb-side-menu a.mat-mdc-button.mat-mdc-button-base.tb-active` | **(0,7,0)** | `side-menu.component.scss`:119 → `[_nghost-x] .tb-side-menu a.mat-mdc-button.mat-mdc-button-base.tb-active` **(0,6,0), non-important** | new light-only — this is the D7 rule, §3.3 |
| N11 | `.tb-default:not(.tb-dark) .tb-site-sidenav .tb-side-menu a.mat-mdc-button.mat-mdc-button-base:hover:not(.tb-active),`<br>`… .mat-mdc-button-base.tb-hovered:not(.tb-active)` | (0,8,0) | `side-menu.component.scss`:112-115 (0,7,0) | new light-only |
| N12 | `.tb-default:not(.tb-dark) .tb-site-sidenav .tb-user-authority,`<br>`.tb-default:not(.tb-dark) .tb-site-sidenav .tb-user-name` | (0,4,0) | `user-menu.component.scss` component rules — depth to be confirmed at implementation (plan task 4 step 3) | new light-only |

**Two rules were designed and then DELETED** because they cannot win — see §3.2:

| Deleted | Selector | Spec. | Loses to |
|---|---|---|---|
| ~~N8~~ | `.tb-default:not(.tb-dark) .tb-site-sidenav a.mat-mdc-button…` (nav labels) | (0,5,1) | `side-menu.component.scss`:111 → `[_nghost-x] .tb-side-menu a.mat-mdc-button.mat-mdc-button-base` **(0,5,1)** — equal specificity, and the global sheet is injected **before** component styles, so source order loses |
| ~~N9~~ | `.tb-default:not(.tb-dark) .tb-site-sidenav tb-icon, … .mat-icon` (rail icons) | (0,4,0) | `side-menu.component.scss`:127-133 → `[_nghost-x] .tb-side-menu a.mat-mdc-button.mat-mdc-button-base .mat-icon` **(0,5,1)** |

Final count: **nine** new rules (N1-N7, N10-N12), plus one edited existing rule (:1613), plus four
component-file token substitutions (§3.2).

---

## 3. The navy chrome: block scoping, ink re-point, and the gradient

### 3.1 Why `.tb-default:not(.tb-dark)`, and how dark is guaranteed unaffected

MEMORY line 8 / R5: `<body class="tb-default">` is **static**; `theme.service.ts` only adds/removes
`tb-dark`. A `.tb-default`-scoped rule therefore **also matches in dark**. The navy chrome rules must
not.

| Option | Mechanism | Verdict |
|---|---|---|
| A | Plain `.tb-default { … }` block plus a mirroring `.tb-dark { … }` block restoring today's dark values | **Rejected.** Doubles the rule count; every dark mirror must reproduce a value the dark block already produces — an invitation to drift. It also adds lines inside :1620-1800, straining AC-2. |
| B | `.tb-default:not(.tb-dark) { … }` | **CHOSEN.** One block. `:not(.tb-dark)` is false whenever `tb-dark` is present, so **not one declaration in the block reaches the dark theme**. A structural guarantee, not a value coincidence — exactly what AC-3/AC-4 need. It also adds a class of specificity, which helps N1-N6 out-rank the shallower upstream rules. |
| C | Shared block, relying on the new tokens' dark values being no-ops | **Rejected for rules** (kept for *tokens*). Works for colour but not for `background-image` presence, `border-bottom` presence, or `--mat-button-*` custom properties, where the dark block's rules and the new rules would interleave unpredictably. |

**Placement:** a new block immediately **after** the dark-only block closes at :1800 and **before**
the anatomy block at :1814. After :1800 so that on a specificity tie the light block wins in light
(and `:not(.tb-dark)` makes it inert in dark regardless); before :1814 so the shared anatomy rules
still own geometry.

**No line inside :1620-1800 is touched** ⇒ AC-2 holds with zero exceptions. The **dark token block
at :1502-1555 does receive the 14 new dark token definitions**, which is what T3/Q2 requires —
and which **AC-1 as literally written forbids**:

> **AC-1 vs T3 conflict.** AC-1 says no line in 1502-1555 may be added. T3/Q2 says every new colour
> token must be defined in **both** blocks, and the dark block *is* 1502-1555. AC-2 carries exactly
> this carve-out ("except the addition of new token definitions required by rule T3"); AC-1 does not.
> I read this as a drafting oversight and propose AC-1 inherit AC-2's carve-out. The functional
> guarantee AC-1 exists to protect — dark renders identically — is fully covered by AC-3 and AC-4,
> which this design satisfies by construction (§1.2). **→ R-B.**

### 3.2 The ink re-point: every rule that sends light ink onto rail or toolbar

Measured, today's light ink on the new navy surfaces — this is R1, quantified:

| Today's light ink | on rail `#0a1435` | on header `#1c2545` |
|---|---|---|
| `--aq-text` `#14181f` | **1.01:1** ✗ | **1.19:1** ✗ |
| `--aq-text-2` `#414b5a` | **2.04:1** ✗ | **1.70:1** ✗ |
| `--aq-text-3` `#6b7789` | **3.97:1** ✗ | **3.30:1** ✗ |

`styles.scss`:1613 is the **only** light-theme chrome ink rule that exists today. Lines 1639-1668,
1746, 1751-1752 and 1881 are all inside `.tb-dark {` (:1620-1800, confirmed by brace scan) and are
**left alone** — their light counterparts must be **created**, not edited.

| Source rule today | Scope today | Light behaviour today | Becomes |
|---|---|---|---|
| `styles.scss`:1613 `.tb-default .tb-primary-toolbar .tb-breadcrumb { color: var(--aq-text) }` | `.tb-default` ⇒ **both themes** | dark ink on (soon) navy — **broken** | **Edited in place** → `var(--aq-chrome-ink)`. Dark-safe: `--aq-chrome-ink`'s dark value `#e9edf3` **is** dark `--aq-text` (§1.2 row 1) — byte-identical. The only existing global rule that changes. |
| `styles.scss`:1639-1641 `.tb-primary-toolbar { background: var(--aq-header); color: var(--aq-text) }` | `.tb-dark` | **no light rule**; toolbar transparent, ink `--aq-text` via `home.component.scss`:249-250 | **N1**: `background: var(--aq-header)`, `color: var(--aq-chrome-ink)`. Beats `home.component.scss`:249-250 (0,2,0). |
| `home.component.scss`:249 `background: var(--aq-header)` | component, both themes | paints the toolbar | **Unchanged** — the token now carries navy (row 3). |
| `home.component.scss`:250 `color: var(--aq-text)` | component, both themes | sets toolbar ink | **Unchanged**; out-ranked by N1 in light, and by :1640 (`!important`) in dark. No component edit needed. |
| `styles.scss`:1643-1644 toolbar icon glyphs → `--aq-text-2` | `.tb-dark` | no light rule; Material default `rgba(0,0,0,.54)` (:736) | **N3** → `var(--aq-chrome-ink-2)` |
| `styles.scss`:1645 toolbar disabled glyph → `--aq-text-disabled` | `.tb-dark` | no light rule | **N4** → `var(--aq-chrome-ink-disabled)` |
| `styles.scss`:1646 toolbar tools + breadcrumb → `--aq-text` | `.tb-dark` | no light rule | **N2** → `var(--aq-chrome-ink)`, plus `h1` (page title, `home.component.scss`:255-258) |
| `styles.scss`:1647-1648 breadcrumb active / inactive | `.tb-dark` | no light rule; `a:not(...)` at :83 gives links `#106cc8` | **N5** (parent/inactive/`.state-divider` → `--aq-chrome-ink-2` / `-3`), **N6** (active/current/`.state-entry` → `--aq-chrome-ink`) |
| `styles.scss`:1653-1656 `.tb-site-sidenav { background: var(--aq-sidebar); --mat-button-text-label-text-color: var(--aq-text-2) }` | `.tb-dark` | no light rule; `home.component.scss`:126 paints the background | Background stays token-driven (row 2). **N7** sets the custom property → `var(--aq-chrome-ink-2)` and the divider → `var(--aq-chrome-divider)`. N7 deliberately does **not** set `background` — it would lose to `home.component.scss`:126 (0,3,1) and does not need to. |
| `styles.scss`:1662-1667 nav labels → `--aq-text-2` | `.tb-dark` | no light rule; **`side-menu.component.scss`:111 is what actually paints light** | **Component substitution** — see below |
| `styles.scss`:1668 rail icons → `--aq-text-3` | `.tb-dark` | no light rule; **`side-menu.component.scss`:133 paints light** | **Component substitution** |
| `styles.scss`:1677-1684 active pill | `.tb-dark` | **no light rule**; `side-menu.component.scss`:119-124 paints light | **N10** (§3.3) + component substitution for the ink |
| `styles.scss`:1746 `.tb-breadcrumb .state-divider` → `--aq-text-3` | `.tb-dark` | no light rule | **N5** |
| `styles.scss`:1751-1752 `.tb-user-authority` → `--aq-text-3` | `.tb-dark` | no light rule | **N12** → `var(--aq-chrome-ink-3)` |
| `styles.scss`:1881 table-toolbar glyphs | `.tb-dark` | not chrome — that toolbar sits on the **sheet**, not navy | **No change.** Outside the navy region. |

#### The N8/N9 mitigation — the load-bearing decision

`side-menu.component.scss`:111 and :133 are **component-scoped, non-`!important`, at (0,5,1)** once
`:host ::ng-deep` compiles. A global rule cannot beat them by matching depth: on a tie the global
sheet loses on source order (Angular injects component styles after `styles.scss`).

| Option | Verdict |
|---|---|
| Escalate with `!important` | **Forbidden** (T4, AC-23). |
| Go deeper in the global block (e.g. reach (0,6,1)) | Possible, but it is a specificity arms race against a file we also own, and it leaves two sources of truth for rail ink. Exactly the pattern MEMORY line 28 calls "the third cascade conflict". |
| **CHOSEN: substitute the token reference in the component file** | `side-menu.component.scss`:111 → `--mat-button-text-label-text-color: var(--aq-chrome-ink-2)`; :133 → `color: var(--aq-chrome-ink-3)`. A `.scss` edit, which §3 of the requirement scopes in ("the light-scoped rule blocks needed to carry navy chrome"). **Theme-safe** because `--aq-chrome-ink-2/-3` carry dark values identical to `--aq-text-2/-3` (§1.2 rows 2-3). It **removes** the conflict instead of winning it. |

The same substitution applies to `side-menu.component.scss`:120-124 (active-row ink →
`--aq-on-accent-container`, already correct once row 9 flips to `#ffffff` — **no edit needed**) and is
**declined** for `menu-link.component.scss`:48-50 (see the alarm-badge note in §4.1).

**N8 and N9 are therefore deleted from the plan.**

### 3.3 The D7 collision — how the gradient paints without `!important`

**First, a correction to the requirement's premise.** R4/D7 state the gradient must beat
`background-color: var(--aq-accent-container) !important` at `styles.scss`:1681. That declaration sits
inside the block `.tb-dark {` which opens at **:1620** and closes at **:1800** (verified by brace
scan: the only top-level `.tb-*` selector / closing brace pair in that span). **It does not apply in
the light theme at all.**

In light, the active nav row is painted by `side-menu.component.scss`:119-120, which compiles to:

```css
[_nghost-x] .tb-side-menu a.mat-mdc-button.mat-mdc-button-base.tb-active {
  background-color: var(--aq-accent-container);   /* NO !important */
}
```

specificity **(0,6,0)**, non-important. So the light problem is easier than stated, and the dark
problem does not exist.

**The rule (N10), in the new light-only block:**

```css
.tb-default:not(.tb-dark) .tb-site-sidenav .tb-side-menu
  a.mat-mdc-button.mat-mdc-button-base.tb-active {
  background-color: transparent;
  background-image: var(--aq-nav-active-grad);
}
```

Specificity **(0,7,0)** — one class deeper than the (0,6,0) it must beat, via `.tb-site-sidenav`.
**No `!important`** ⇒ AC-23 holds. This is the "match/exceed selector depth" discipline MEMORY line 17
prescribes.

**Why BOTH declarations are required (the point R4 raises).** A gradient is a `background-image`. It
does **not** override `background-color` — they are separate longhands, and the image simply paints
*over* the colour. With only `background-image` declared, the `#2067ff` accent-container colour stays
underneath: invisible while the gradient is opaque, but the element's computed `background-color`
would still be `rgb(32,103,255)`, and **that is a value AC-11's sibling checks read**. Declaring
`background-color: transparent` in the same rule at the same (0,7,0) beats the (0,6,0) colour
declaration outright, so computed `background-color` becomes `rgba(0, 0, 0, 0)` and computed
`background-image` becomes the gradient. That is exactly the pair AC-10 samples.

**Why dark is unaffected, twice over:** (a) `:not(.tb-dark)` makes the rule inert in dark; (b) even
if it applied, `--aq-nav-active-grad`'s dark value is `none`, so `background-image` is a no-op and
`background-color: transparent` at (0,7,0) would still lose to :1681's `!important`. Belt and braces.

**Why AC-11 holds by construction:** `--aq-nav-active-grad` has **exactly one** consumer, N10. Hover
(N11), the table selection toolbar (:1836), the pager active chip (:2023), the alarm badge
(`menu-link.component.scss`:48) and the user-menu active item (`user-menu.component.scss`:155) all
continue to read `--aq-accent-container`, a flat colour. `grep -c -- '--aq-nav-active-grad'` returning
2 (definition-light, definition-dark) + 1 (consumer) is the mechanical check.

### 3.4 ⚠ The gradient's white label fails AA — a human decision is required

Measured at the pixel positions the label actually occupies. Rail is 250px (`--aq-rail-w-open`); the
row is inset `margin: 2px 8px` ⇒ 234px; `padding: 0 12px` + 22px icon + 12px gap
(`side-menu.component.scss`:102-131) ⇒ the label starts at x=46 and can run to x≈222.

With the **canvas gradient** `linear-gradient(to right, #7641f7 0%, #18dbf2 100%)`:

| x | fraction t | colour | white contrast |
|---|---|---|---|
| 46 (label start) | 0.197 | `rgb(99,96,246)` | **4.65** ✓ |
| 94 | 0.229 | `rgb(96,100,246)` | **4.50** ← the AA cliff |
| 120 | 0.513 | `rgb(71,142,244)` | 3.20 ✗ |
| 160 | 0.684 | `rgb(59,164,244)` | 2.55 ✗ |
| 222 (label end) | 0.949 | `rgb(27,213,242)` | **1.80** ✗ |

White stays ≥ 4.5:1 for only the first **~48px** of a 176px label span. "Dashboards",
"Notifications", "Customers & users" all extend well past it. **AC-10 (gradient + white label) and
AC-8/AC-18 (every rail text node ≥ 4.5:1, no new AA regression) cannot both hold with the canvas
gradient.** The canvas acknowledges the problem ("the active row label is left-aligned away from the
cyan end") but left-alignment buys only those 48px.

This is a **new** failure: today's active pill is `--aq-on-accent-container #00363e` on
`--aq-accent-container #bff1fb` = **8.9:1**. So it is a blocking AC-18 finding, not pre-existing.

| | Option | Effect | AC-10 | AC-8/AC-18 | Fidelity |
|---|---|---|---|---|---|
| **G1** | Canvas gradient exactly; accept the AA failure as a human-accepted exception under AC-18's "explained and accepted by the human" clause | label unreadable over the cyan half | ✓ | ✗ (accepted) | exact |
| **G2** *(recommended)* | Keep direction and both named stops; add a mid stop so the cyan is compressed past the label span: `linear-gradient(to right, #7641f7 0%, #5a54f4 40%, #18dbf2 100%)`. Measured worst case over x=46..222 is **4.52:1** | reads as the same purple→cyan sweep; cyan lands in the last ~25%, behind the badge/ellipsis zone | ✓ (still `#7641f7 → #18dbf2`) | ✓ | very close |
| **G3** | Drop the gradient; flat `#2067ff` + white label (4.72:1) | loses D2's signature | ✗ | ✓ | weakest |

**Recommendation: G2.** It preserves both named stops and the direction, so the "same brand family"
judgement (AC-26) is unharmed, while every label pixel clears 4.5:1. It requires AC-10 to be read as
"the gradient from `#7641f7` to `#18dbf2`" rather than "a strictly two-stop gradient" — which I
believe is the intent. **The plan is written for G2 with the exact value in §1.2 row 6; if the human
picks G1 or G3, only that one token value changes (plan task 2, one line).** → **R-E**.

---

## 4. AC-8 evidence — every text node in rail and toolbar

Computed with the WCAG 2.x relative-luminance formula — the same maths as
`.claude/team/artifacts/dashboard-and-grid-design-fidelity/contrast-check.py`, which the sweep script
extends. Rail `#0a1435`; header `#1c2545`; rail hover = `rgba(255,255,255,.08)` over rail =
`rgb(30,39,69)`; active row = purple start `#7641f7`, worst readable point under G2 = 4.52.

### 4.1 Rail — 12 nodes

| Text node | Selector that will own it | Ink | Ratio | Floor | |
|---|---|---|---|---|---|
| Brand wordmark | `.tb-brand-wordmark` (`home.component.scss`, ADR 0001 addendum) | `--aq-chrome-ink` `#dbe4f5` | **14.11** | 4.5 | ✓ |
| Section label | `.tb-side-menu-section` (ADR 0003) | `--aq-chrome-ink-3` `#a9b6d4` | **8.87** | 4.5 | ✓ |
| Nav row label, idle | `side-menu.component.scss`:111 → `--aq-chrome-ink-2` `#c3ccdf` | **11.18** | 4.5 | ✓ |
| Nav row icon, idle | `side-menu.component.scss`:133 → `--aq-chrome-ink-3` | **8.87** | 3.0 (non-text) | ✓ |
| Nav row label, hover | N11 → `#ffffff` on `rgb(30,39,69)` | **14.71** | 4.5 | ✓ |
| Nav row icon, hover | N11 → `--aq-chrome-ink` | **11.50** | 3.0 | ✓ |
| **Nav row label, ACTIVE** | N10 → `#ffffff` on the gradient | **5.43** at purple start; **4.52** worst under G2 | 4.5 | ✓ *(G2 only — §3.4)* |
| Nav row label, disabled | `--aq-chrome-ink-disabled` `#7d88a6` | **5.11** | 3.0 (WCAG 1.4.3 exempts disabled) | ✓ |
| Alarm badge count | `menu-link.component.scss`:48-50 → `--aq-on-accent-container` `#ffffff` on `--aq-accent-container` `#2067ff` | **4.72** | 4.5 | ✓ |
| `.tb-menu-dot` (collapsed rail) | `menu-link.component.scss`:59 → `--aq-error` `#dc4848` on rail | **4.87** | 3.0 (non-text, number is visually hidden) | ✓ |
| User name | `user-menu.component.scss` → `--aq-chrome-ink` | **14.11** | 4.5 | ✓ |
| User authority | N12 → `--aq-chrome-ink-3` | **8.87** | 4.5 | ✓ |
| Rail divider (non-text) | N7 → `--aq-chrome-divider` `#6b76a0` | **4.06** | 3.0 | ✓ |

> **Alarm badge — canvas detail declined.** The canvas paints the badge white-on-`--close #dc4848`,
> which measures **4.15:1** — below 4.5 for an 11px/700 label, and a **new** regression (today it is
> `#00363e` on `#bff1fb` = 8.9:1). So `menu-link.component.scss`:48-50 is **left unchanged**; it keeps
> `--aq-accent-container`/`--aq-on-accent-container`, which become `#2067ff`/`#ffffff` = **4.72:1** ✓
> via token rows 8-9. Recorded as a declined canvas detail, justified by AC-18 → **R-F**.

### 4.2 Primary toolbar — 9 nodes

| Text node | Selector | Ink | Ratio | Floor | |
|---|---|---|---|---|---|
| Page title `h1` (20px/600 ⇒ large text) | N2 → `--aq-chrome-ink` | **11.73** | 3.0 | ✓ (also clears 4.5) |
| Breadcrumb current / `.tb-active` / `.state-entry` | N6 → `--aq-chrome-ink` | **11.73** | 4.5 | ✓ |
| Breadcrumb parent link / `.tb-inactive` | N5 → `--aq-chrome-ink-2` | **9.30** | 4.5 | ✓ |
| Breadcrumb `.state-divider` (non-text) | N5 → `--aq-chrome-ink-3` | **7.38** | 3.0 | ✓ |
| Toolbar tools text | N2 → `--aq-chrome-ink` | **11.73** | 4.5 | ✓ |
| Icon-button glyph | N3 → `--aq-chrome-ink-2` | **9.30** | 3.0 | ✓ |
| Icon-button glyph, hover | N3 hover → `#ffffff` | **15.00** | 3.0 | ✓ |
| Icon-button glyph, disabled | N4 → `--aq-chrome-ink-disabled` | **4.25** | 3.0 | ✓ |
| Outlined pill border (non-text) | N1 region → `--aq-chrome-divider` | **3.37** | 3.0 | ✓ |

**22 nodes enumerated, 22 pass** (the active-row label conditional on the §3.4 decision). Every ratio
above was computed, not estimated.

### 4.3 Chips re-verified on the new surfaces (AC-14)

| Chip | Label | Fill | over sheet `#ffffff` | over surface `#f7f8fa` |
|---|---|---|---|---|
| Success | `#136c45` | `rgba(20,184,117,.14)` | **5.64** ✓ | **5.34** ✓ |
| Error | `#a82323` | `rgba(220,72,72,.12)` | **6.12** ✓ | **5.78** ✓ |
| Warning | `#8a4b06` | `rgba(250,159,66,.16)` | **6.06** ✓ | **5.75** ✓ |

The `:hover` and `.selected` row composites must also be re-checked (the overlays composite *under*
the chip, per the existing tool's method). That is a plan verification step (task 8), not a design
assumption.

---

## 5. Chart chrome (Q1 conditional) — **DEFERRED**, with proof

Q1 permits chart chrome "only if token-driven and provably dark-neutral". It is **neither**.

`chartColorScheme` lives at
`ui-ngx/src/app/modules/home/components/widget/lib/chart/chart.models.ts`:32-65 — a TypeScript object
of `light`/`dark` string pairs for `threshold.line`, `threshold.label`, `axis.line`, `axis.label`,
`axis.ticks`, `axis.tickLabel`, `axis.splitLine`, `series.label`. Three disqualifying facts:

1. **It is not token-driven.** ECharts cannot read CSS custom properties — the comment at
   `styles.scss`:1417-1419 says exactly this. The `--aq-chart-*` tokens are kept *numerically in
   sync by hand*; the chart reads the `.ts` literals.
2. **Changing it is a `.ts` edit.** AC-24 does permit "a theme-aware colour map's `light` values", and
   this map *is* theme-aware — so the edit is technically in-bounds. But:
3. **The `.light` values are read at module load into `defaultSettings` and then persisted into saved
   widget configs.** Verified consumers: `bar-chart-widget.models.ts`:55
   (`axisTickLabelColor: chartColorScheme['axis.tickLabel'].light`), `chart.models.ts`:253
   (`labelColor: chartColorScheme['series.label'].light`), and the same `.light` pattern in
   `bars-chart.models.ts`, `polar-area-widget.models.ts`, `radar-chart.models.ts`,
   `radar-chart-widget.models.ts`, `range-chart-widget.models.ts`, `time-series-chart.models.ts`.
   These are **defaults baked into a widget's stored config at creation time**. So editing the map
   (a) does not change any already-saved widget on the demo dashboard, and (b) makes new and old
   widgets diverge. Critically, `.light` is used as the default **regardless of the active theme** —
   a widget created under the **dark** theme also stores the *light* literal. Editing `.light`
   therefore changes what a dark-theme user sees on a newly-created widget.

Fact (3) is the proof AC-28 requests, with the opposite sign: **dark-neutrality cannot be
established**. Per Q1's own instruction the chart-chrome change is **not made**. The light
`--aq-chart-*` tokens (:1500-1506) are also left alone, since changing them without the `.ts`
counterpart would break the documented numeric sync and produce a chart whose CSS-side and
canvas-side chrome disagree.

→ Recorded for the follow-up requirement alongside the series palette. **Series colours are untouched
in every task: `material.models.ts`, `utils.service.ts`'s `getMaterialColor`, and every
`chartColorScheme` value (light and dark) appear in no task** ⇒ AC-27 and AC-5 hold trivially.

---

## 6. The bounded legacy sweep (Q6)

Of the 74 literals I audited which are **actually rendered** on login / home dashboard / Devices /
Alarms / the six auth pages, **and** clash with Airlinq Blue. Conservative by design.

**The mechanism that makes AC-29 provable:** each entry is added to the new
`.tb-default:not(.tb-dark)` block by **duplicating the original selector at equal-or-greater depth**
and re-pointing the colour. The original declaration is **left in place**. In dark,
`:not(.tb-dark)` is false, the original literal still wins, and the computed value is byte-identical.
No `!important` is added anywhere.

### 6.1 IN — 7 literals

| # | Line | Declaration today | Where it is visible in scope | Becomes | Why it clashes |
|---|---|---|---|---|---|
| L1 | 43 | `body { background-color: #eee }` | Behind every route during load; at the edges of the auth pages | `var(--aq-bg)` | `#eee` against the new `#eef1f7` canvas is a visible seam |
| L2 | 83 | `a:not(.mat-mdc-button-base,.mdc-tab) { color: #106cc8 }` | Every link: login "Forgot your password?", breadcrumb parents, Alarms detail links | `var(--aq-link)` | `#106cc8` is a foreign blue beside `#2067ff` |
| L3 | 85 | `border-bottom: 1px solid rgba(64,84,178,.25)` | same anchors | `var(--aq-border)` | indigo underline, off-palette |
| L4 | 93 | `a:hover, a:focus { &:not(...) { border-bottom: 1px solid #4054b2 } }` | same anchors on hover | `var(--aq-link)` | indigo, off-palette |
| L5 | 336 | `.tb-error-message { color: rgb(221,44,0) }` | Login and all auth-page form errors; Devices/Alarms dialog validation | `var(--aq-error-text)` (`#c23333`) | orange-red beside `#dc4848`; also 4.6:1 vs `#c23333`'s 5.50:1 |
| L6 | 838 | `.mat-mdc-row.mat-mdc-selected:not(.tb-current-entity) { background-color: #ededed }` | Devices and Alarms grids on row select | `var(--aq-selected)` | neutral grey where all other selection is now blue |
| L7 | 804 | `background-color: var(--tb-hover-color, #f4f4f4)` | Devices / Alarms row hover fallback | `var(--tb-hover-color, var(--aq-hover))` — **fallback only** | grey hover beside the new `--aq-hover` |

L7 changes only the **fallback** inside an existing `var()`, so any consumer that actually sets
`--tb-hover-color` is unaffected.

### 6.2 OUT — 67 literals, recorded for the follow-up requirement

| Cluster | Lines | Why deferred |
|---|---|---|
| Material text/border approximations `rgba(0,0,0,.54/.44/.38/.26/.12/.06)` | 113, 190, 205, 215, 219, 225, 235, 242, 309, 508, 736, 740, 860, 901, 909, 1082, 1241, 1247, 1381, 1382, 1390 | 21 literals on form scaffolding, dialogs and widget-config surfaces that are **not** on the four in-scope routes. Each needs its own contrast check. High count, low visible payoff — exactly the "ambitious" set Q6 warns against. |
| `rgb(221,44,0)` error red, other sites | 196, 199, 311, 514, 517, 525 | `mat-error` internals. Reachable on login, but Material's own error colour overrides them in most states; needs runtime confirmation of which one actually paints. |
| `#444` / `#666` / `#6e6e6e` greys | 181, 371, 382, 391, 414, 499, 1190 | `.tb-title` labels, ACE doc tooltips, fullscreen button — off-route. |
| `#eee` / `#f7f7f7` / `#ededed` / `#ccc` surfaces | 253, 270, 271, 321, 349, 362, 1180, 1186 | `pre.tb-highlight`, `.tb-notice`, `.tb-autocomplete` divider, `.tb-progress-cover`, fullscreen chrome. Only `.tb-progress-cover` (:1180) is arguably in scope; it flashes for <1s. |
| Snackbars, tooltips, elevation, misc | 262, 281, 284-286, 341-343, 399, 425, 433, 653, 704, 712, 723, 1223, 1225 | Off-route, or non-colour (box-shadow elevation). |
| `styles.scss`:1742 `rgba(20,25,34,.72)` | 1742 | **Correction to R7:** this line is inside the `.tb-dark` block (:1620-1800), not "in the shared/light section". Brace scan confirms. **No action, no risk.** |

---

## 7. Login and the six auth pages

### 7.1 `login.component.scss` — 8 changed declarations

| Line | Today | Becomes | AC | Note |
|---|---|---|---|---|
| 53 | `.aq-head { background: var(--aq-surface-2) }` | `var(--aq-login-head)` | AC-15 | Navy band. **Cannot reuse `--aq-header`** — its dark value is `transparent`, which would change the dark login band. Hence token pair #11, dark = `#232a34` = today's resolved dark `--aq-surface-2`. |
| 66 | `.aq-brand { color: var(--aq-text) }` | `var(--aq-login-head-ink)` | AC-15 | Brand word white on navy: **15.00:1** ✓ |
| 67 | `.aq-prod { color: var(--aq-text-2) }` | `var(--aq-login-head-ink-2)` | AC-15 | Product name `#dbe4f5`: **11.73:1** ✓. **Cannot reuse `--aq-chrome-ink`** — dark `#e9edf3` ≠ today's `#aeb8c5`, which would be a dark change. Hence pair #13. |
| 75 | `.aq-strip { color: var(--aq-text-3) }` | `var(--aq-login-head-ink-3)` | AC-15 | Strip on navy: **7.38:1** ✓ |
| 127 | `box-shadow: 0 0 0 3px rgba(11,107,120,.13)` | `box-shadow: 0 0 0 3px var(--aq-focus-ring)` | D8, AC-3 | See the D8 reading below |
| 132 | `&:focus { box-shadow: 0 0 0 3px rgba(163,24,42,.13) }` | `var(--aq-error-ring)` | D8, AC-3 | ditto |
| 167 | `.aq-error { color: var(--aq-error) }` | `var(--aq-error-text)` | AC-13 | `#c23333` = **5.50:1** on sheet ✓ (`#dc4848` would be 4.15 ✗) |
| 195 | `.aq-forgot a { color: var(--aq-accent) }` | `var(--aq-link)` = `#2067ff` | AC-15 | See R-C below |
| 177 | `.aq-submit { color: #fff }` | **unchanged** | AC-15 | Correct in both themes (R3). White on `#2067ff` = **4.72:1** ✓. `background: var(--aq-accent)` at :176 already yields the flat blue with **no** `background-image` ⇒ D3 satisfied by token row 14 alone. |

**The D8 ambiguity, resolved.** Lines 127 and 132 are *theme-blind*: they hardcode the **light** teal
and crimson and therefore render the light-teal / light-crimson ring **in the dark theme too**. D8
says "with dark keeping its **current resolved values**". The current resolved dark value **is**
`rgba(11,107,120,.13)` / `rgba(163,24,42,.13)` — i.e. the bug. Two readings:

- **(i) literal:** dark keeps `rgba(11,107,120,.13)` / `rgba(163,24,42,.13)`.
- **(ii) intent:** dark gets the *correct* dark-accent ring `rgba(79,201,219,.13)` / `rgba(236,98,116,.13)`.

**I choose (i).** T1/AC-3 are absolute ("the two dumps are identical"), and reading (ii) is an
unrequested dark change smuggled in as a fix. §1.2 rows 7-8 therefore carry the today-literals as
their dark values. **The dark-ring bug is logged for the follow-up requirement.**

> **R-C — AC-15 names `#428bca` for "Forgot your password?"; it measures 3.63:1 on `#ffffff`.** At
> 12.5px/600 that is not large text, so 4.5:1 applies. Today the link is `--aq-accent` `#0b6b78` =
> **6.40:1**, so `#428bca` is a **new** AA regression and a blocking AC-18 finding. The plan uses
> `--aq-link` = `#2067ff` (**4.72:1** ✓) and records `#428bca` as a declined canvas detail. **AC-15
> explicitly names `#428bca`, so this needs the human's ruling.**

### 7.2 ⚠ The six auth pages — **R9, a new reachability finding**

All six hardcode **`tb-dark` in their own root template div**:

```
create-password.component.html:18             class="tb-password-content mat-app-background tb-dark …"
reset-password.component.html:18              (same)
reset-password-request.component.html:18      (same)
link-expired.component.html:18                class="tb-expired-link-content mat-app-background tb-dark …"
two-factor-auth-login.component.html:18       class="tb-two-factor-auth-login-content mat-app-background tb-dark …"
force-two-factor-auth-login.component.html:18 (same)
```

Consequences:

1. These six pages render in the **dark** Material palette **regardless of the user's theme**. That is
   why they carry `rgba(255,255,255,.8)` ink (`two-factor-auth-login.component.scss`:62, 80, 88, 90;
   `force-two-factor-auth-login.component.scss`:99, 104, 111, 113) — it is correct *for them*, and
   the requirement's guess that these "look dark-theme-oriented" is exactly right, for this reason.
2. Any `--aq-*` token referenced **inside** that div resolves to its **dark** value, because
   `.tb-dark` is an ancestor. "Same tokens as the login card" is therefore **not reachable by token
   reference**: `var(--aq-accent)` inside `create-password` yields `#37b6c9`, not `#2067ff`.
3. Removing `tb-dark` from the six templates is an **`.html` edit**, which AC-24 forbids and §3 puts
   out of scope. It is also not a recolour: it would change these pages' entire appearance and
   require re-verifying every element on them.
4. Only four SCSS files back all six pages — `password.component.scss` (shared by create-password,
   reset-password and reset-password-request, which have **no own SCSS**),
   `link-expired.component.scss`, `two-factor-auth-login.component.scss`,
   `force-two-factor-auth-login.component.scss`.

**What is reachable:** each page's `background-color: #eee`
(`password.component.scss`:22, `link-expired.component.scss`:22,
`two-factor-auth-login.component.scss`:23, `force-two-factor-auth-login.component.scss`:25) sits on
the element that **carries** `tb-dark`, not inside it — so a token there resolves against `<body>`'s
theme, i.e. correctly. But `#eee` is **theme-blind today**, so a bare swap to `var(--aq-bg)` would
change dark from `#eee` to `#0a0d12` — a dark change, breaching T1/AC-3.

| Option | |
|---|---|
| **A7** *(planned)* | Wrap the swap in `:host-context(body:not(.tb-dark))`, leaving `#eee` as the declaration for dark. Costs one nesting level per file, no `!important`, no template edit, and dark stays **byte-identical** (`#eee` → `#eee`). |
| B7 | Leave all four alone; the auth pages get no change and AC-30 is withdrawn. |

**A7 is planned (task 7).** It delivers the only reachable part of AC-30: the page canvas matches the
new light `#eef1f7` instead of `#eee`. **The rest of AC-30 — card header band, primary button, input
borders, error text on the auth pages — is NOT reachable without an `.html` edit and must be
deferred.** → **R-D**: either accept a reduced AC-30, or widen scope to permit removing `tb-dark` from
six templates (which needs its own ADR addendum and a far larger verification surface).

The `rgba(255,255,255,.8)` values are **left untouched**: they are correct for a permanently-`tb-dark`
context, they are not theme-blind *in effect*, and changing them without removing `tb-dark` would make
those pages unreadable.

---

## 8. Risk register

Ranked by likelihood × blast radius. Each names the criterion that catches it.

| # | Risk | Why it is likely *here* | Mitigation | Caught by |
|---|---|---|---|---|
| **R-1** | **A new chrome rule is present, correct, dual-scoped and still never applies** — the failure recorded four times (MEMORY 17, 18, 27, 28) | Nine new rules compete with component styles Angular injects **after** `styles.scss`; ties lose | §3.2: the two rules that would tie (N8/N9) are **deleted** in favour of editing the component file's token reference. For N1-N7, N10-N12 the margin is computed in §2.3 and is ≥ 1 class. Plan task 9 verifies by `getComputedStyle` **on the rendered page**, and any diagnosis by CSS **injection** — never by reading the file | AC-6, AC-7, AC-8, AC-10 |
| **R-2** | **The gradient makes the active nav label unreadable** | Measured: white fails AA past ~48px of a 176px label span | Human decision G1/G2/G3; plan written for **G2**, worst case 4.52:1 | AC-8, AC-18 |
| **R-3** | **Dark changes** because a new token's dark value is not actually today's resolved value | 14 new pairs, each dark value hand-picked | §1.2 documents per token **which existing token's current resolved value was copied and why the substitution is a no-op**. Plan task 1 captures the dark `--aq-*` dump and dark screenshots **before** any edit, as the baseline artefact | AC-3, AC-4 |
| **R-4** | **`.tb-default` rules leak into dark** (R5 / MEMORY 8) | The whole chrome block is light-intent | Structural, not value-based: every new rule is `.tb-default:not(.tb-dark)`, hence **inert** in dark by selector matching | AC-3, AC-4 |
| **R-5** | **AC-1 blocks the T3 token additions** — the dark token block *is* :1502-1555 | Requirement drafting: AC-2 has the carve-out, AC-1 does not | §3.1 flags it; needs a one-line ruling. Functionally covered by AC-3/AC-4 | AC-1 (needs amendment) → R-B |
| **R-6** | **AC-30 is largely unreachable** — six auth pages hardcode `tb-dark` | Discovered in this design; not among R1-R8 | §7.2: ship the reachable part (A7), defer the rest | AC-30 (needs reduction), AC-24 → R-D |
| **R-7** | **A canvas value is adopted that fails AA** — four found: `--text-3 #6e7891`, divider `#596489`, link `#428bca`, red alarm badge | The canvas was drawn to the product palette, never re-measured against this app's backgrounds | Each substituted with a measured alternative and recorded as a **declined canvas detail** with its ratio (§1.1, §1.2 row 5, §7.1, §4.1). AC-15 names `#428bca` explicitly ⇒ flagged | AC-18, AC-15 → R-C, R-F |
| **R-8** | **The legacy sweep changes dark** | All 7 literals are theme-blind today | Every entry is a **new light-only duplicate selector**; the original literal stays and still wins in dark. Computed-value diff at each affected element | AC-29 |
| **R-9** | **`--aq-accent-container` repoint leaks** into 6 unrelated surfaces | It has 6 consumers besides the nav pill | Intentional — all six should read Airlinq Blue. Each is contrast-checked: nav pill, selection toolbar (:1836), pager chip (:2023), alarm badge, avatar, user-menu item. White on `#2067ff` = 4.72:1 ✓ for all. Task 4 enumerates them | AC-11, AC-14, AC-18 |
| **R-10** | **Lint/build delta misread** as caused by this change | Baseline is already red (569 problems / 462 errors) | Measure the baseline **before** any edit (task 1); gate on **delta only** (MEMORY 9) | AC-19, AC-20 |
| **R-11** | **`color-mix()` sneaks in** via a "cleaner" tint | Four new rgba tints are hand-mixed | Pre-mixed rgba only, as the existing `*-tint` tokens already do; grep the built bundle | AC-21 |
| **R-12** | **A new `!important`** | The temptation at N10 is strong | N10 wins at (0,7,0) vs (0,6,0) without it (§3.3); diff grep | AC-23 |
| **R-13** | **A `.ts` edit creeps in** for chart chrome | It is superficially permitted by AC-24 | §5 proves it is not dark-neutral; **zero `.ts` files appear in any task** | AC-24, AC-27, AC-5 |

---

## 9. ADR assessment — one ADR is warranted

**Yes**, and it is *not* primarily about the gradient.

The durable architectural contract being changed is **"colour is token-only, and the light theme
carries no chrome rules."** This design introduces two patterns future work will copy:

1. **`.tb-default:not(.tb-dark)` as the sanctioned light-only rule scope.** This is the fourth
   cascade conflict in this codebase, and the first time a *structural* answer (make the rule unable
   to match) is chosen over a *specificity* answer (make the rule win). That choice deserves to be
   recorded, because the next person will otherwise reach for `!important` again.
2. **A surface-relative ink layer (`--aq-chrome-*`) as a new token category.** Until now every ink
   token was *page*-relative (`--aq-text*` assume a light sheet in light). Chrome ink is relative to
   *its own* surface, which is navy in light and near-black in dark — an inversion of the usual
   relationship. This changes how anyone reasons about `--aq-text*` and needs to be stated.

A gradient token alone (one token, one consumer) would **not** warrant an ADR.

Drafted at **`docs/adr/0004-theme-scoped-chrome-rules-and-chrome-ink-tokens.md`** — next number, the
current highest being 0003 (`0003-sectioned-menu-model.md`).

---

## 10. Decisions needed from the human before the plan executes

| # | Decision | Plan's assumed default |
|---|---|---|
| **R-A** | AC-17 lists six distinct hover values; this design collapses them to one `--aq-hover` (§1.3). Amend AC-17 to "the row/menu hover surface matches `--aq-hover`"? | collapsed to one token |
| **R-B** | AC-1 forbids adding lines to `styles.scss`:1502-1555, but T3/Q2 requires the 14 new dark token definitions there. Extend AC-2's existing carve-out to AC-1? | carve-out applies |
| **R-C** | AC-15 names `#428bca` for "Forgot your password?" — measured **3.63:1** on white (today 6.40:1 ⇒ new AA regression). Use `--aq-link` = `#2067ff` (4.72:1) instead? | `#2067ff` |
| **R-D** | AC-30: only the page background is reachable on the six auth pages (R9). Reduce AC-30 to the background, or widen scope to remove `tb-dark` from six templates? | reduce AC-30 |
| **R-E** | §3.4 gradient: **G1** (canvas exact, accept AA failure) / **G2** (three-stop, AA-safe, recommended) / **G3** (flat blue)? | **G2** |
| **R-F** | Canvas details declined on measured AA grounds: `--aq-text-3 #6e7891`, chrome divider `#596489`, red alarm badge. Accept? | accepted as declined |

---

## 11. Sign-off

| Gate | Status |
|---|---|
| G2 — design + implementation plan | **SUBMITTED** for human approval |

---

## G3 round-2 delta (2026-09-07) — BLOCKER-1, MAJOR-2, F5

Historical rows above are left as written; this section records what changed after them, so the
document as a whole stays a faithful record rather than a retrofitted one.

### Superseded rows

| Row | Status |
|---|---|
| Token table row **14** (`--aq-login-head-ink-3`) | **WITHDRAWN by D-F5.** Both definitions removed. The token's only consumer was `.aq-strip`, which is removed in the same change; the four sibling auth pages never used it. See requirement §9c D-F5. |
| Row **493** (`.aq-strip` → `--aq-login-head-ink-3`, 7.38:1) | **WITHDRAWN by D-F5.** The rule and the element it styled are both deleted. The recorded 7.38:1 was correct while the strip existed. |
| Rows **156 / 227 / 381** (N5/N6 naming `.state-entry` / `.state-divider`) | **CORRECTED.** Those classes are NOT part of `<tb-breadcrumb>` — they belong to `dashboard-page/states/*-state-controller` (MEMORY.md line 36), so the N5/N6 selectors never reached them and the 11.73:1 attributed to `.state-entry` at row 381 was **not** being achieved. They are now re-inked by their own dashboard-toolbar-scoped rules; see below. |

### New rules (G3 round 2)

All light-only (`:not(.tb-dark)`), no new `!important`, no geometry.

| # | Selector | Specificity | Beats | Measured (pixel decode) |
|---|---|---|---|---|
| **R1** | `…:not(.tb-dark) section.tb-dashboard-toolbar tb-dashboard-toolbar .state-entry` | (0,4,2) | `[_nghost-x] .entity-state-controller` (0,2,1), not `!important` | parents → `--aq-chrome-ink-2` **9.30:1** |
| **R2** | `… .state-entry.last-entry` | (0,4,3) | as R1 | title → `--aq-chrome-ink` **11.73:1** (was **1.33:1**) |
| **R3** | `… .state-divider` / `.state-divider.last-divider` | (0,4,2)/(0,4,3) | as R1 | `--aq-chrome-ink-3` **7.38:1** (non-text, 3:1 floor) |
| **R4** | `… .mat-mdc-select.default-state-controller` | (0,4,2) | `default-state-controller.component.scss`:47 custom property | `--mat-select-enabled-trigger-text-color` → **11.73:1** |
| **R5** | `…:not(.tb-dark) section.tb-dashboard-toolbar tb-dashboard-toolbar { --aq-text-3: … }` | (0,3,1) | *nothing* — it is a **token override**, not a competing declaration | timewindow label **7.38:1** (was **3.30:1**) |

**Why R5 is a token override.** The declaration that paints `.tb-timewindow-label` is the
**pre-existing shared** rule at `styles.scss`:1689,
`.tb-default { .tb-timewindow, .tb-timewindow-label { color: var(--aq-text-3) !important } }`.
It is `!important`, and `!important` beats a non-important rule at **any** specificity
(MEMORY.md line 17), so no new `color` rule could win without adding an `!important` — forbidden
this round. Narrowing :1689 is also wrong: it is shared with every in-widget timewindow and
predates this work. So R5 leaves the winning declaration alone and re-points the **token it
reads**, scoped to this header. Blast radius, enumerated over all 16 `var(--aq-text-3)`
consumers in the file: only :1689 is reachable inside
`section.tb-dashboard-toolbar tb-dashboard-toolbar`; the other light-block consumer, :1699
`.mat-mdc-header-cell`, renders in the dashboard **body** (verified on the real route as
`#525c6e`, unchanged); the remaining 13 sit inside the `.tb-dark` rule block and cannot match a
`:not(.tb-dark)`-scoped subtree. Dark verified: `--aq-text-3` inside the toolbar reads `#8892a0`,
**identical** to `<body>`, because the selector structurally cannot match when `tb-dark` is present.

### Method note — why these two were missed the first time

The navy sits on `div.mat-fab-toolbar-background`, a `position:absolute; z-index:21`
**sibling** layer, not an ancestor of the text. An ancestor-walking `bgOf()` therefore reports
`#eeeeee` as the backdrop for every ink on this surface — which produced 8 false FAILs and very
nearly masked these 2 real ones. The trustworthy measurement is the **painted pixel**: decode the
screenshot, take the glyph-core pixel inside the text rect and the modal pixel of a ring just
outside it. That method is now implemented in
`.claude/team/artifacts/2026-09-07-g3-round2-fix/pixel-decode.py` and its rows are carried in
`painted-sweep.py`.
