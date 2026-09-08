# Requirement (follow-up) — Airlinq Blue: deferred items

**Status:** DRAFT — not approved, not scheduled. Raised by the Developer at the
close of the `airlinq-blue-light-recolour` work item so nothing discovered
mid-implementation is lost.

**Parent work item:** `docs/requirements/airlinq-blue-light-recolour.md`,
`docs/design/airlinq-blue-light-recolour.md`, `docs/plans/airlinq-blue-light-recolour.md`
**ADR:** `docs/adr/0004-theme-scoped-chrome-rules-and-chrome-ink-tokens.md`

Each item below was deliberately excluded from the light-recolour round, with a
measured reason. None is a defect introduced by that round.

---

## F1 — Chart series palette is not theme-aware (already logged separately)

Tracked in full at `docs/requirements/chart-series-palette-theme-aware.md`.
Summary of why it is architecture work, not a token edit:

- The real series palette is the flat, non-theme-aware `materialColors`
  (`ui-ngx/src/app/shared/models/material.models.ts`, 140 entries), reached via
  `getMaterialColor(index)` — no theme parameter exists in the signature.
- `chartColorScheme[...].light` is **not** safe to edit: those values are read at
  MODULE LOAD into widget `defaultSettings` (`chart.models.ts`,
  `bar-chart-widget.models.ts`, ~6 more) and used as the default *regardless of
  the active theme*, so editing a `.light` value changes what **dark**-theme
  users see on newly created widgets.
- Series colours are **persisted** into saved widget configs
  (`widget-subscription.ts`), so recolouring is also a migration decision for
  every saved dashboard.

Also deferred with it: chart **chrome** (axis, grid, label, tooltip, cursor).
The `--aq-chart-*` tokens exist and are already theme-paired, but proving a
chart-chrome change on the deployed build was shown to be unreachable this
round — the production bundle strips `window.echarts`, so the option object
cannot be introspected, and the painted SVG only carries the resolved colour,
not which token produced it.

## F2 — The six auth pages hardcode `tb-dark` in their templates

`create-password`, `reset-password`, `reset-password-request`, `link-expired`,
`two-factor-auth-login`, `force-two-factor-auth-login` each set
`class="… mat-app-background tb-dark …"` on their **root div**
(`*.component.html:18`).

Consequences, all confirmed by measurement:

1. These pages render in the dark Material palette in **both** themes.
2. Any `--aq-*` token referenced *inside* that div resolves to its **dark**
   value, because `.tb-dark` is an ancestor. So "same tokens as the login card"
   is not reachable by token reference at all.
3. Their `rgba(255, 255, 255, .8)` inks are therefore **correct**, not bugs.

The light recolour round delivered only the reachable part: the root element's
own `background-color`, via `:host-context(body:not(.tb-dark))`, leaving the
base `#eee` as the dark declaration so dark stayed byte-identical.

**Still deferred:** card header band, primary button, input borders and error
text on those six pages. Reaching them means removing `tb-dark` from six
templates — an `.html` edit that changes each page's entire appearance and
needs its own design pass, contrast sweep and ADR addendum.

### ~~G3 UPDATE (2026-09-07): AC-30 is BLOCKED, not merely reduced~~ — **CLOSED / DONE at G4 (2026-09-08)**

> **STATUS: CLOSED. The recommended fix below has been PERFORMED, not deferred.**
>
> The human authorised it at **G4** as **D-NEW3** — an explicit, minimal, one-off exception to
> the frozen-block rule (which otherwise stands in full). The one-line narrowing described at
> the end of this entry was applied to `styles.scss` (the line is now **:1737**, not :1729 —
> the block moved; the canonical convention is to brace-match, never to hard-code the number):
>
> ```diff
> -  background-color: var(--aq-bg) !important;
> +  @at-root body#{&} { background-color: var(--aq-bg) !important; }
> ```
>
> compiling to exactly `body.tb-dark { background-color: var(--aq-bg) !important }`. The
> `@at-root body#{&}` spelling is forced by Dart Sass, which rejects a bare `body&`.
>
> **AC-30 is now MET in light** on the 4 reachable auth routes (pixel-decoded `#eef1f7`), with
> the 3 token-gated routes asserted by verified static equivalence rather than claimed as a
> runtime pass. **Dark is unchanged**, proven by rendering against a baseline server differing
> by exactly this one line: the dark auth page is **byte-for-byte pixel-identical**, and the
> dark app chrome shows **0 differing pixels of 2,073,479** outside the animated live alarm
> badge. The concern flagged below — "needs its own dark-unchanged proof over every other
> `.tb-dark` consumer" — was discharged by enumerating the exact set of elements that can
> possibly be affected (those matching `.tb-dark` but **not** `body.tb-dark`): **0 on all 11
> authenticated routes**, and exactly 1 (the auth root div, still dark) per auth route.
>
> Full record, cascade analysis and all five measured acceptance conditions: **D-NEW3** in
> `docs/requirements/airlinq-blue-light-recolour.md` §9c, digest change in §9d, AC-2 exception
> note and AC-30 status in §7.
>
> **What REMAINS open from the surrounding item** (not closed by D-NEW3): the rest of each auth
> page's inks — card header band, primary button, input borders, error text — which stay
> unreachable while the six templates hardcode `tb-dark` on their root div. That is still an
> `.html` edit needing its own design pass, contrast sweep and ADR addendum. See the
> "Still deferred" paragraph above this heading.

The original entry is retained below for traceability.


Round 3 was asked (G3 finding F3, human conditional ruling) to fix the auth-page
background **only if** a light-scoped selector exists that beats the element's own
token declaration. It does not. **AC-30 is therefore BLOCKED and rolls into this
follow-up.** The evidence, all taken on the real `/login/resetPasswordRequest`
route on a local dev server built from the working tree:

1. **The token hijack is real and was fixed.** `var()` resolves on the ELEMENT, and
   the auth root div carries `tb-dark`, which is a **bare class selector** that
   re-declares the whole dark token block on that very element. Measured:
   `--aq-bg` on `<body>` = `#eef1f7`, but `--aq-bg` **on the element** = `#0a0d12`.
   Round 3 introduced `--aq-auth-bg`, declared **only** in the light `.tb-default`
   token block and **never** inside `.tb-dark`, so the element cannot hijack it.
   Measured after the change: `--aq-auth-bg` on the element = `#eef1f7`. **The
   token mechanism works.** That change is kept in the tree — it is the correct
   authoring, and it makes the eventual fix a one-liner.

2. **A second, independent blocker then wins.** `styles.scss:1729`, inside the
   FROZEN `.tb-dark {` chrome block, is
   ```
   .tb-dark { background-color: var(--aq-bg) !important; }
   ```
   a **bare `.tb-dark`** selector with `!important` that matches the auth root div
   directly (not as an ancestor). Proven by class-toggle experiment on the real
   route: removing `tb-dark` from the element makes it paint `rgb(238,241,247)`
   = the correct light value; removing `mat-app-background` changes nothing.

3. **No permitted fix exists.** Proven by injection (diagnosis only):
   - A light rule at **(0,8,3)** carrying the literal value with **no
     `!important`** → element still paints `rgb(10,13,18)`. No non-`!important`
     rule can win at any specificity, because the winner is `!important`.
   - The same rule **with `!important`** → `rgb(238,241,247)`. Only `!important`
     works, and adding one is forbidden this round.

   The three ways through are all out of scope: add `!important` (forbidden),
   edit the frozen dark block at `:1729` to scope it away from this element
   (forbidden — it would change the dark chrome hash), or remove `tb-dark` from
   the six templates (`.html` edit, forbidden).

**Recommended fix — ✅ DONE at G4 as D-NEW3 (see the CLOSED banner at the top of this entry):** narrow
`styles.scss:1729` from the bare `.tb-dark` to a form that cannot match the auth
root div — e.g. `body.tb-dark` — which restores the rule's evident intent
("app background wherever a route leaves `<body>` exposed") while letting the
existing light `--aq-auth-bg` rule paint. That is a dark-block edit and needs its
own dark-unchanged proof over every other `.tb-dark` consumer, which is exactly
why it was not attempted inside a no-dark-change round.

## F3 — Dark focus/error ring bug on the login card (pre-existing)

`login.component.scss:127` and `:132` hardcoded the **light** teal and crimson
rings, so the dark theme painted a light-teal / light-crimson ring.

The recolour round **tokenised** these into `--aq-focus-ring` / `--aq-error-ring`
but deliberately set the **dark** values to those same literals verbatim
(`rgba(11, 107, 120, .13)` / `rgba(163, 24, 42, .13)`), because the governing
constraint was "dark keeps its current resolved values" and the current resolved
value *is* the bug. Fixing it would have been an unrequested dark change.

**Deferred fix:** point the dark values at the dark accent / error hues, i.e.
`rgba(79, 201, 219, .13)` and `rgba(236, 98, 116, .13)`. This is now a
one-line-per-token change because the tokens already exist in both blocks.

## F4 — ~67 remaining hardcoded colour literals in `styles.scss`

The recolour round swept only the 7 literals actually visible on the in-scope
routes (login, home dashboard, Devices, Alarms, the six auth pages). The rest
are catalogued in design §6.2 and reproduced here so the list survives:

| Cluster | Approx. lines (pre-change numbering) | Why deferred |
|---|---|---|
| Material text/border approximations `rgba(0,0,0,.54/.44/.38/.26/.12/.06)` | 113, 190, 205, 215, 219, 225, 235, 242, 309, 508, 736, 740, 860, 901, 909, 1082, 1241, 1247, 1381, 1382, 1390 | 21 literals on form scaffolding, dialogs and widget-config surfaces that are not on the in-scope routes. Each needs its own contrast check. |
| `rgb(221,44,0)` error red, other sites | 196, 199, 311, 514, 517, 525 | `mat-error` internals; Material's own error colour overrides them in most states, so which one actually paints needs runtime confirmation. |
| `#444` / `#666` / `#6e6e6e` greys | 181, 371, 382, 391, 414, 499, 1190 | `.tb-title` labels, ACE doc tooltips, fullscreen button — off-route. |
| `#eee` / `#f7f7f7` / `#ededed` / `#ccc` surfaces | 253, 270, 271, 321, 349, 362, 1180, 1186 | `pre.tb-highlight`, `.tb-notice`, `.tb-autocomplete` divider, `.tb-progress-cover`, fullscreen chrome. Only `.tb-progress-cover` is arguably in scope and it flashes for under a second. |
| Snackbars, tooltips, elevation, misc | 262, 281, 284-286, 341-343, 399, 425, 433, 653, 704, 712, 723, 1223, 1225 | Off-route, or non-colour (box-shadow elevation). |

Note `styles.scss` line numbers shifted by roughly +80 to +290 after the
recolour round's insertions; re-locate by literal, not by line.

## F5 — Declined canvas values, kept declined on measured AA grounds

These are **not** oversights. Each was measured and rejected because adopting it
would create a new WCAG AA failure. Any future round that wants them must also
solve the contrast.

| Canvas value | Where | Measured | Kept instead |
|---|---|---|---|
| `#428bca` | "Forgot your password?" link | **3.63:1** on white | `#2067ff` (4.72:1) |
| `#6e7891` | `--aq-text-3` body ink | 4.41 / 4.15 / **3.90** on white / `#f7f8fa` / `#eef1f7` | `#6b7789` (unchanged) |
| `#596489` | chrome divider on `#1c2545` | **2.58:1**, below the 3:1 non-text floor | `#6b76a0` (4.06 rail / 3.37 header) |
| `#7641f7 → #18dbf2` | active nav row gradient | white label falls to **1.80:1** by the end of the label span | capped at `#7641f7 → #2f6ff0`, worst 4.58:1 |

The gradient cap is the human's ruling (R-E) and the canvas artboards were
updated to match, so spec and code agree; the raw product hex `#18dbf2` is
recorded here as the deviation with its measured rationale.

## F6 — Six product hover greys collapsed to one mechanism

The source product carries `--search-list-hover-bg #ecedfd`,
`--custom-select-hover-bg #f8f8f8`, `--dd1-menu-hover-bg #f6f6f6`,
`--header-item-hover-bg #dddddd`, `--account-hover-bg #ebebeb` and
`--filter-panel-hover-bg #f7fafc` because it has five unrelated hover
implementations. This app has exactly **one** (`--aq-hover`). Per ruling R-A they
were collapsed into that single token, whose light value derives from
`--filter-panel-hover-bg`. If a future design genuinely needs per-surface hover
tints, that is a new requirement, not a token edit.

## F7 — `--group-name-color #6e4cf6` has no consumer

Grepped across the shell, login and auth pages: there is no group-label element
on any in-scope route. Adding the token would be dead code. Revisit if/when a
grouped-entity view lands.

## F8 — Off-toolbar breadcrumb ink on the light sheet (raised round 2)

`<tb-breadcrumb>` appears three times. Only `home.component.html:63` sits inside
`.tb-primary-toolbar` (navy `--aq-header`) and is in this item's scope.
`dashboard-page.component.html:81` and `widget-editor.component.html:52` render inside
the `<router-outlet>` at `home.component.html:114`, so they inherit the light **sheet**
(`--aq-sheet #ffffff`, or `#f7f8fa` behind the edit toolbar) — a different surface.

On the sheet the component default `rgba(0,0,0,0.76)` (`breadcrumb.component.scss:21`)
is already correct: measured **10.37:1** for parents/dividers (opacity .75 composited)
and **21:1** for the current entry on `#ffffff`. Nothing is failing, so nothing is
changed here. Round 2 finding NEW-1 was that the light chrome ramp had been emitted
with unscoped selector twins that reached these two instances and painted chrome ink
onto the white sheet (divider 2.03:1, current entry 1.28:1). The fix scoped all three
rules to `.tb-primary-toolbar`; it did not recolour the sheet breadcrumb.

If a future design does want the off-toolbar breadcrumb restyled, it is a **sheet-ink**
decision (dark-neutral proof, AA against `#ffffff` and `#f7f8fa`, and the
`componentBreadcrumbsTpl` wrapper `<span>` at `breadcrumb.component.html:60` must be
accounted for) and belongs in its own requirement.

## F9 — Wordmark overflows the collapsed 64px rail (raised G3 round 2, MINOR-3)

**Deliberately NOT fixed in the blue-light recolour round.** Logged here by human ruling.

**What it is.** The `AIRLINQ` wordmark (`home.component.html`, `.tb-logo-title`, owned by
`home.component` — `_ngcontent-ng-c935555661`) is **61px wide starting at x=26** in the
**collapsed** rail, i.e. it ends at **x=87**, while the collapsed rail ends at **x=72**. It
overflows its container by **~15px**. Measured on the real authenticated `/home` route; in the
**expanded** rail (250px wide, wordmark 61px at x=56, right edge 117) there is no overflow, so
the defect is specific to the collapsed state.

**Why it is out of scope for this round.** The geometry is **unchanged by this diff** — the
wordmark was always 61px in a 64px rail. What changed is only its **ink**: finding F1 raised it
from `#333333` on `#0a1435` = **1.43:1** (effectively invisible, which is why nobody had ever
seen it overflow) to `#dbe4f5` = **14.11:1**. Making pre-existing text legible *exposed* a
pre-existing layout bug; it did not create one. The fix is a **layout** change, and this round's
scope is colour only (no geometry, per the standing constraints), so changing it here would be
scope creep and would also break the round's "no geometry" invariant.

**Recommended fix.** **Hide the wordmark when the rail is collapsed.** The rail already
distinguishes the two states, so this is a visibility rule keyed off the collapsed state rather
than any resizing or truncation — the icon rail keeps the centred favicon as its brand mark, and
the wordmark returns when the rail expands. Prefer this over shrinking the font or ellipsising:
at 64px there is no width at which a seven-letter wordmark reads well, and an ellipsis
("AIRL…") is worse branding than no wordmark. The rule must live in **`home.component.scss`**,
because `home.component` owns that element — a rule written in `side-menu.component.scss` can
never match it (MEMORY.md line 31, the `_nghost` ownership trap that already cost one G3
BLOCKER).

**Whoever picks this up:** it is a geometry change, so it needs its own requirement, its own
before/after screenshots in **both** rail states and **both** themes, and a check that the
collapsed rail's vertical rhythm still reads correctly with the wordmark row absent.
